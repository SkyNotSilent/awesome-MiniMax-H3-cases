import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { lookup as dnsLookup } from 'node:dns'
import https from 'node:https'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { resolvePublishStagingPath } from './review-paths.mjs'
import { isPlaybackProfileCompliant, PLAYBACK_PROFILE, preparePlaybackFile, probeVideo, summarizeProbe } from './video-playback-profile.mjs'
import { ensureFaststart } from './video-faststart.mjs'
import { fetchXVideoSources } from './video-x-source.mjs'

const root = resolve(import.meta.dirname, '..')
function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

const stagingArgument = argumentValue('--staging')
const casesPath = stagingArgument ? resolvePublishStagingPath(stagingArgument) : resolve(root, 'data/cases.json')
const apply = process.argv.includes('--apply')
const concurrency = Number(process.env.VIDEO_MIRROR_CONCURRENCY || 4)
const credentialsFromStdin = process.argv.includes('--credentials-stdin')
const onlyIds = new Set((process.env.VIDEO_MIRROR_ONLY || '').split(',').map((value) => value.trim()).filter(Boolean))
const sourceDirectory = process.env.VIDEO_MIRROR_SOURCE_DIR ? resolve(process.env.VIDEO_MIRROR_SOURCE_DIR) : null
const storageResolveIp = process.env.VIDEO_S3_RESOLVE_IP?.trim() || null
const officialSources = new Map([
  ['official-t2va-starship', 'https://huggingface.co/MiniMaxAI/MiniMax-H3/resolve/main/assets/t2va.mp4'],
  ['official-fl2va-ramen', 'https://huggingface.co/MiniMaxAI/MiniMax-H3/resolve/main/assets/fl2va.mp4'],
  ['official-ref2va-lamb', 'https://huggingface.co/MiniMaxAI/MiniMax-H3/resolve/main/assets/ref2va.mp4'],
])

let stdinPayload = ''
if (credentialsFromStdin) {
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) stdinPayload += chunk
}
const stdinCredentials = credentialsFromStdin ? JSON.parse(stdinPayload) : null
const storage = {
  endpoint: stdinCredentials?.endpoint || process.env.VIDEO_S3_ENDPOINT,
  accessKeyId: stdinCredentials?.accessKeyId || process.env.VIDEO_S3_ACCESS_KEY_ID,
  secretAccessKey: stdinCredentials?.secretAccessKey || process.env.VIDEO_S3_SECRET_ACCESS_KEY,
  bucket: stdinCredentials?.bucketName || process.env.VIDEO_S3_BUCKET,
  region: stdinCredentials?.region || process.env.VIDEO_S3_REGION || 'auto',
  forcePathStyle: (stdinCredentials?.urlStyle || '') === 'path' || process.env.VIDEO_S3_FORCE_PATH_STYLE === 'true',
}

for (const [key, value] of Object.entries(storage)) {
  if (key !== 'forcePathStyle' && !value) throw new Error(`Missing video storage setting: ${key}`)
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error('VIDEO_MIRROR_CONCURRENCY must be between 1 and 12.')

const endpointHostname = new URL(storage.endpoint).hostname
const requestHandler = storageResolveIp
  ? new NodeHttpHandler({
      httpsAgent: new https.Agent({
        keepAlive: true,
        lookup(hostname, options, callback) {
          const isStorageHostname = hostname === endpointHostname || hostname.endsWith(`.${endpointHostname}`)
          if (!isStorageHostname) return dnsLookup(hostname, options, callback)
          if (options?.all) return callback(null, [{ address: storageResolveIp, family: 4 }])
          return callback(null, storageResolveIp, 4)
        },
      }),
    })
  : undefined

const client = new S3Client({
  endpoint: storage.endpoint,
  region: storage.region,
  forcePathStyle: storage.forcePathStyle,
  credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
  requestHandler,
})
const cases = JSON.parse(await readFile(casesPath, 'utf8'))
const targets = onlyIds.size ? cases.filter((item) => onlyIds.has(item.id)) : cases
const unknownIds = [...onlyIds].filter((id) => !cases.some((item) => item.id === id))
if (unknownIds.length) throw new Error(`Unknown case ids in VIDEO_MIRROR_ONLY: ${unknownIds.join(', ')}`)
const tempDirectory = await mkdtemp(join(tmpdir(), 'h3-video-mirror-'))
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
  throw new Error(`${label}: ${lastError?.message ?? lastError}`)
}

async function exists(key) {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }))
    return { exists: true, bytes: Number(head.ContentLength || 0) }
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode
    if (status === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') return { exists: false, bytes: 0 }
    throw error
  }
}

async function verifyUploadedObject(key, expectedBytes) {
  const head = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }))
  if (Number(head.ContentLength || 0) !== expectedBytes) throw new Error(`Remote size mismatch for ${key}`)
  const range = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key, Range: 'bytes=0-1' }))
  if (!range.ContentRange?.startsWith('bytes 0-1/')) throw new Error(`Remote Range request failed for ${key}`)
  if (range.Body) await range.Body.transformToByteArray()
}

async function sourcesFor(item) {
  const official = officialSources.get(item.id)
  if (official) return { original: official, playbackCandidates: [] }
  const sources = await retry(`Fetch metadata for ${item.id}`, () => fetchXVideoSources(item))
  if (!sources) throw new Error('Missing X post id')
  return sources
}

async function downloadUrl(url, destination, label) {
  await retry(label, async () => {
    const response = await fetch(url, { headers: { 'User-Agent': 'awesome-minimax-h3-cases/1.0 video-mirror' } })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
  })
}

async function downloadObject(key, destination) {
  await retry(`Download stored ${key}`, async () => {
    const response = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }))
    if (!response.Body) throw new Error('Object response has no body')
    await pipeline(response.Body, createWriteStream(destination))
  })
}

async function nativePlaybackCandidate(item, urls) {
  for (let index = 0; index < urls.length; index += 1) {
    const candidatePath = join(tempDirectory, `${item.id}.native-${index}.mp4`)
    try {
      await downloadUrl(urls[index], candidatePath, `Download playback variant for ${item.id}`)
      const summary = summarizeProbe(await probeVideo(candidatePath))
      if (!isPlaybackProfileCompliant(summary)) continue
      return preparePlaybackFile(candidatePath, tempDirectory)
    } catch (error) {
      console.warn(`Playback variant rejected for ${item.id}: ${error?.message || error}`)
    }
  }
  return null
}

async function mirror(item) {
  const sourceKey = `videos/${item.id}.mp4`
  const playbackKey = `${PLAYBACK_PROFILE.prefix}/${item.id}.mp4`
  const [sourcePresent, playbackPresent] = await Promise.all([exists(sourceKey), exists(playbackKey)])
  if (sourcePresent.exists && playbackPresent.exists) {
    return { id: item.id, sourceKey, playbackKey, bytes: sourcePresent.bytes, playbackBytes: playbackPresent.bytes, state: 'existing' }
  }
  if (!apply) {
    return {
      id: item.id,
      sourceKey,
      playbackKey,
      bytes: sourcePresent.bytes,
      playbackBytes: playbackPresent.bytes,
      state: sourcePresent.exists ? 'missing-playback' : 'missing-source-and-playback',
    }
  }

  const filePath = join(tempDirectory, `${item.id}.mp4`)
  const stagedSource = sourceDirectory ? resolve(sourceDirectory, `${item.id}.mp4`) : null
  let staged = false
  if (!sourcePresent.exists && stagedSource) {
    try {
      await access(stagedSource)
      await pipeline(createReadStream(stagedSource), createWriteStream(filePath))
      staged = true
    } catch {
      // Fall back to the original public media source below.
    }
  }
  let sources = null
  if (!sourcePresent.exists && !staged) {
    sources = await sourcesFor(item)
    await downloadUrl(sources.original, filePath, `Download ${item.id}`)
  } else if (sourcePresent.exists) {
    await downloadObject(sourceKey, filePath)
  }
  const downloadedStats = await stat(filePath)
  if (downloadedStats.size < 10_000) throw new Error(`Downloaded file is too small (${downloadedStats.size} bytes)`)
  const preparedSource = await ensureFaststart(filePath, tempDirectory)
  const sourceStats = await stat(preparedSource.path)
  if (!sourcePresent.exists) {
    await retry(`Upload source ${item.id}`, () => client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: sourceKey,
      Body: createReadStream(preparedSource.path),
      ContentLength: sourceStats.size,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: { source: item.sourceUrl, caseid: item.id, faststart: 'true', tier: 'source' },
    })))
    await retry(`Verify source ${item.id}`, () => verifyUploadedObject(sourceKey, sourceStats.size))
  }

  if (!playbackPresent.exists) {
    if (!sources && item.sourceType !== 'official') {
      try {
        sources = await sourcesFor(item)
      } catch (error) {
        console.warn(`Native playback lookup failed for ${item.id}; transcoding stored source: ${error?.message || error}`)
      }
    }
    const playback = await nativePlaybackCandidate(item, sources?.playbackCandidates ?? [])
      ?? await preparePlaybackFile(preparedSource.path, tempDirectory)
    await retry(`Upload playback ${item.id}`, () => client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: playbackKey,
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
        preparation: playback.state,
      },
    })))
    await retry(`Verify playback ${item.id}`, () => verifyUploadedObject(playbackKey, playback.bytes))
    return {
      id: item.id,
      sourceKey,
      playbackKey,
      bytes: sourceStats.size,
      playbackBytes: playback.bytes,
      state: sourcePresent.exists ? 'uploaded-playback' : 'uploaded-source-and-playback',
      playbackState: playback.state,
    }
  }
  return { id: item.id, sourceKey, playbackKey, bytes: sourceStats.size, playbackBytes: playbackPresent.bytes, state: 'uploaded-source' }
}

async function worker() {
  while (cursor < targets.length) {
    const index = cursor++
    const item = targets[index]
    try {
      const result = await mirror(item)
      results.set(item.id, result)
      console.log(`[${results.size}/${targets.length}] ${result.state} ${item.id} ${result.bytes}`)
    } catch (error) {
      results.set(item.id, { id: item.id, state: 'failed', error: error?.message || String(error) })
      console.error(`[${results.size}/${targets.length}] failed ${item.id}: ${error?.message || error}`)
    }
  }
}

try {
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker))
  const failed = [...results.values()].filter((result) => result.state === 'failed')
  if (apply) {
    const mirrored = cases.map((item) => {
      const result = results.get(item.id)
      return !result || result.state === 'failed' ? item : { ...item, mediaUrl: `/media/${item.id}.mp4` }
    })
    const tempCasesPath = `${casesPath}.tmp`
    await writeFile(tempCasesPath, `${JSON.stringify(mirrored, null, 2)}\n`)
    await rename(tempCasesPath, casesPath)
  }
  const uploaded = [...results.values()].filter((result) => result.state.startsWith('uploaded'))
  const existing = [...results.values()].filter((result) => result.state === 'existing')
  console.log(JSON.stringify({ total: targets.length, uploaded: uploaded.length, existing: existing.length, failed: failed.length, uploadedBytes: uploaded.reduce((sum, result) => sum + result.bytes, 0), uploadedPlaybackBytes: uploaded.reduce((sum, result) => sum + (result.playbackBytes || 0), 0), failures: failed }, null, 2))
  if (failed.length) process.exitCode = 1
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}
