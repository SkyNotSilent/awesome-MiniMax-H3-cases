import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import {
  isPlaybackProfileCompliant,
  playbackProfileViolations,
  PLAYBACK_PROFILE,
  preparePlaybackFile,
  probeVideo,
  summarizeProbe,
} from './video-playback-profile.mjs'
import { fetchXVideoSources } from './video-x-source.mjs'

const root = resolve(import.meta.dirname, '..')
const apply = process.argv.includes('--apply')
const verifyOnly = process.argv.includes('--verify-only')
const replace = process.argv.includes('--replace')
const concurrency = Number(process.env.VIDEO_PLAYBACK_CONCURRENCY || 2)

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

const onlyArgument = argumentValue('--only') || process.env.VIDEO_PLAYBACK_ONLY || ''
const onlyIds = new Set(onlyArgument.split(',').map((value) => value.trim()).filter(Boolean))
const limit = Number(argumentValue('--limit') || 0)
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('VIDEO_PLAYBACK_CONCURRENCY must be between 1 and 8.')
if (!Number.isInteger(limit) || limit < 0) throw new Error('--limit must be a non-negative integer.')

const storage = {
  endpoint: process.env.VIDEO_S3_ENDPOINT,
  accessKeyId: process.env.VIDEO_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.VIDEO_S3_SECRET_ACCESS_KEY,
  bucket: process.env.VIDEO_S3_BUCKET,
  region: process.env.VIDEO_S3_REGION || 'auto',
  forcePathStyle: process.env.VIDEO_S3_FORCE_PATH_STYLE === 'true',
}
for (const [name, value] of Object.entries(storage)) {
  if (name !== 'forcePathStyle' && !value) throw new Error(`Missing video storage setting: ${name}`)
}

const client = new S3Client({
  endpoint: storage.endpoint,
  region: storage.region,
  forcePathStyle: storage.forcePathStyle,
  credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
})
const allCases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const unknownIds = [...onlyIds].filter((id) => !allCases.some((item) => item.id === id))
if (unknownIds.length) throw new Error(`Unknown case ids: ${unknownIds.join(', ')}`)
let targets = onlyIds.size ? allCases.filter((item) => onlyIds.has(item.id)) : allCases
if (limit) targets = targets.slice(0, limit)

const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')
const reportDirectory = resolve(root, '.review/video-playback-migrations')
const reportPath = resolve(reportDirectory, `${runId}.json`)
const tempDirectory = await mkdtemp(join(tmpdir(), 'h3-playback-migration-'))
const results = new Map()
let cursor = 0

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

async function retry(label, work, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(attempt * 700)
    }
  }
  throw new Error(`${label}: ${lastError?.message || lastError}`)
}

async function headObject(key) {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }))
    return {
      exists: true,
      bytes: Number(head.ContentLength || 0),
      etag: head.ETag || null,
      metadata: head.Metadata || {},
    }
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || ['NotFound', 'NoSuchKey'].includes(error?.name)) return { exists: false }
    throw error
  }
}

async function signedObjectUrl(key) {
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: storage.bucket,
    Key: key,
    ResponseContentType: 'video/mp4',
  }), { expiresIn: 3_600 })
}

async function downloadObject(key, destination) {
  await retry(`Download ${key}`, async () => {
    const response = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }))
    if (!response.Body) throw new Error('Object response has no body')
    await pipeline(response.Body, createWriteStream(destination))
  })
}

async function downloadUrl(url, destination, label) {
  await retry(label, async () => {
    const response = await fetch(url, { headers: { 'User-Agent': 'awesome-minimax-h3-cases/1.0 playback-migration' } })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
  })
}

async function remoteAtomHeader(key, offset, totalBytes) {
  const end = Math.min(totalBytes - 1, offset + 15)
  const response = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key, Range: `bytes=${offset}-${end}` }))
  if (!response.ContentRange?.startsWith(`bytes ${offset}-`)) throw new Error(`Object did not honor atom Range at ${offset}: ${key}`)
  const bytes = Buffer.from(await response.Body.transformToByteArray())
  if (bytes.length < 8) throw new Error(`MP4 atom header is truncated at ${offset}: ${key}`)
  let size = bytes.readUInt32BE(0)
  const type = bytes.toString('ascii', 4, 8)
  let headerSize = 8
  if (size === 1) {
    if (bytes.length < 16) throw new Error(`Extended MP4 atom header is truncated at ${offset}: ${key}`)
    size = Number(bytes.readBigUInt64BE(8))
    headerSize = 16
  } else if (size === 0) {
    size = totalBytes - offset
  }
  if (!Number.isSafeInteger(size) || size < headerSize || offset + size > totalBytes) {
    throw new Error(`Invalid MP4 atom ${type} at ${offset}: ${key}`)
  }
  return { type, offset, size }
}

async function inspectRemoteFaststart(key, totalBytes) {
  const atoms = []
  let offset = 0
  while (offset + 8 <= totalBytes && atoms.length < 100) {
    const atom = await remoteAtomHeader(key, offset, totalBytes)
    atoms.push(atom)
    const moov = atoms.find((entry) => entry.type === 'moov')
    const mdat = atoms.find((entry) => entry.type === 'mdat')
    if (moov && mdat) return moov.offset < mdat.offset
    offset += atom.size
  }
  return false
}

async function verifyRemotePlayback(key, expectedBytes) {
  const head = await headObject(key)
  if (!head.exists) throw new Error(`Playback object is missing: ${key}`)
  if (expectedBytes && head.bytes !== expectedBytes) throw new Error(`Remote size mismatch for ${key}: ${head.bytes} != ${expectedBytes}`)
  if (head.metadata.profile !== PLAYBACK_PROFILE.name || head.metadata.tier !== 'playback') {
    throw new Error(`Playback metadata is invalid for ${key}`)
  }
  if (!await inspectRemoteFaststart(key, head.bytes)) throw new Error(`Playback object is not faststart: ${key}`)
  const summary = summarizeProbe(await probeVideo(await signedObjectUrl(key)))
  const violations = playbackProfileViolations(summary)
  if (violations.length) throw new Error(`Remote playback profile is invalid for ${key}: ${violations.join('; ')}`)
  return { ...head, summary }
}

async function uploadPlayback(item, playback, preparation) {
  const key = `${PLAYBACK_PROFILE.prefix}/${item.id}.mp4`
  await retry(`Upload ${key}`, () => client.send(new PutObjectCommand({
    Bucket: storage.bucket,
    Key: key,
    Body: createReadStream(playback.path),
    ContentLength: playback.bytes,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      source: item.sourceUrl,
      caseid: item.id,
      faststart: 'true',
      tier: 'playback',
      profile: PLAYBACK_PROFILE.name,
      preparation,
    },
  })))
  await retry(`Verify ${key}`, () => verifyRemotePlayback(key, playback.bytes), 8)
}

async function copyCompliantSource(item, sourceKey, sourceHead, summary) {
  const playbackKey = `${PLAYBACK_PROFILE.prefix}/${item.id}.mp4`
  await retry(`Copy ${sourceKey} to ${playbackKey}`, () => client.send(new CopyObjectCommand({
    Bucket: storage.bucket,
    Key: playbackKey,
    CopySource: encodeURI(`${storage.bucket}/${sourceKey}`),
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000, immutable',
    MetadataDirective: 'REPLACE',
    Metadata: {
      source: item.sourceUrl,
      caseid: item.id,
      faststart: 'true',
      tier: 'playback',
      profile: PLAYBACK_PROFILE.name,
      preparation: 'copied',
      sourceetag: (sourceHead.etag || '').replaceAll('"', ''),
    },
  })))
  await retry(`Verify ${playbackKey}`, () => verifyRemotePlayback(playbackKey, sourceHead.bytes), 8)
  return { bytes: sourceHead.bytes, output: summary, state: 'copied' }
}

async function nativePlayback(item) {
  let sources
  try {
    sources = await retry(`Fetch playback variants for ${item.id}`, () => fetchXVideoSources(item))
  } catch (error) {
    return { playback: null, warning: error?.message || String(error) }
  }
  if (!sources) return { playback: null, warning: null }
  for (let index = 0; index < sources.playbackCandidates.length; index += 1) {
    const candidatePath = join(tempDirectory, `${item.id}.native-${index}.mp4`)
    try {
      await downloadUrl(sources.playbackCandidates[index], candidatePath, `Download native playback for ${item.id}`)
      const summary = summarizeProbe(await probeVideo(candidatePath))
      if (!isPlaybackProfileCompliant(summary)) continue
      return { playback: await preparePlaybackFile(candidatePath, tempDirectory), warning: null }
    } catch (error) {
      console.warn(`Native playback rejected for ${item.id}: ${error?.message || error}`)
    }
  }
  return { playback: null, warning: null }
}

async function migrate(item) {
  const sourceKey = `videos/${item.id}.mp4`
  const playbackKey = `${PLAYBACK_PROFILE.prefix}/${item.id}.mp4`
  const [sourceHead, playbackHead] = await Promise.all([headObject(sourceKey), headObject(playbackKey)])
  if (!sourceHead.exists) throw new Error(`Source object is missing: ${sourceKey}`)

  if (playbackHead.exists && playbackHead.metadata?.profile === PLAYBACK_PROFILE.name && !replace) {
    try {
      await retry(`Verify existing ${playbackKey}`, () => verifyRemotePlayback(playbackKey, playbackHead.bytes), 8)
      return { id: item.id, state: 'existing', sourceBytes: sourceHead.bytes, playbackBytes: playbackHead.bytes }
    } catch (error) {
      if (verifyOnly || !apply) throw error
      console.warn(`Existing playback will be rebuilt for ${item.id}: ${error?.message || error}`)
    }
  }
  if (verifyOnly) throw new Error(`Playback object is missing or has the wrong profile: ${playbackKey}`)

  const sourceUrl = await signedObjectUrl(sourceKey)
  const source = summarizeProbe(await retry(`Probe ${sourceKey}`, () => probeVideo(sourceUrl)))
  const sourceFaststart = await inspectRemoteFaststart(sourceKey, sourceHead.bytes)
  const audit = {
    id: item.id,
    state: isPlaybackProfileCompliant(source) && sourceFaststart ? 'would-copy' : 'would-optimize',
    sourceBytes: sourceHead.bytes,
    source,
    sourceFaststart,
  }
  if (!apply) return audit

  if (isPlaybackProfileCompliant(source) && sourceFaststart) {
    const copied = await copyCompliantSource(item, sourceKey, sourceHead, source)
    return { ...audit, state: copied.state, playbackBytes: copied.bytes, output: copied.output }
  }

  const native = await nativePlayback(item)
  if (native.playback) {
    await uploadPlayback(item, native.playback, `native-${native.playback.state}`)
    return {
      ...audit,
      state: `native-${native.playback.state}`,
      playbackBytes: native.playback.bytes,
      output: native.playback.output,
      warning: native.warning,
    }
  }

  const originalPath = join(tempDirectory, `${item.id}.source.mp4`)
  await downloadObject(sourceKey, originalPath)
  const playback = await preparePlaybackFile(originalPath, tempDirectory)
  await uploadPlayback(item, playback, playback.state)
  return {
    ...audit,
    state: playback.state,
    playbackBytes: playback.bytes,
    output: playback.output,
    encoder: playback.encoder,
    warning: native.warning,
  }
}

async function writeReport() {
  await mkdir(reportDirectory, { recursive: true })
  const ordered = targets.map((item) => results.get(item.id)).filter(Boolean)
  const failures = ordered.filter((result) => result.state === 'failed')
  const payload = {
    runId,
    apply,
    verifyOnly,
    replace,
    profile: PLAYBACK_PROFILE,
    total: targets.length,
    completed: ordered.length,
    failed: failures.length,
    sourceBytes: ordered.reduce((sum, result) => sum + (result.sourceBytes || 0), 0),
    playbackBytes: ordered.reduce((sum, result) => sum + (result.playbackBytes || 0), 0),
    results: ordered,
  }
  await writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`)
  return payload
}

async function worker() {
  while (cursor < targets.length) {
    const index = cursor++
    const item = targets[index]
    try {
      const result = await migrate(item)
      results.set(item.id, result)
      console.log(`[${results.size}/${targets.length}] ${result.state} ${item.id} ${result.playbackBytes || result.sourceBytes || 0}`)
    } catch (error) {
      results.set(item.id, { id: item.id, state: 'failed', error: error?.message || String(error) })
      console.error(`[${results.size}/${targets.length}] failed ${item.id}: ${error?.message || error}`)
    }
  }
}

try {
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker))
  const report = await writeReport()
  console.log(JSON.stringify({
    report: reportPath,
    total: report.total,
    completed: report.completed,
    failed: report.failed,
    sourceBytes: report.sourceBytes,
    playbackBytes: report.playbackBytes,
  }, null, 2))
  if (report.failed) process.exitCode = 1
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}
