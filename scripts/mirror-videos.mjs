import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { lookup as dnsLookup } from 'node:dns'
import https from 'node:https'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'

const root = resolve(import.meta.dirname, '..')
const casesPath = resolve(root, 'data/cases.json')
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

async function sourceFor(item) {
  const official = officialSources.get(item.id)
  if (official) return official
  const postId = item.sourceUrl.match(/status\/(\d+)/)?.[1]
  if (!postId) throw new Error('Missing X post id')
  const payload = await retry(`Fetch metadata for ${item.id}`, async () => {
    const response = await fetch(`https://api.fxtwitter.com/status/${postId}`, { headers: { 'User-Agent': 'awesome-minimax-h3-cases/1.0 video-mirror' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  })
  const video = payload.tweet?.media?.videos?.[0] ?? payload.tweet?.media?.all?.find((entry) => entry.type === 'video')
  const variants = (video?.variants || []).filter((entry) => entry.content_type === 'video/mp4' && entry.url)
  const best = variants.sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0]?.url || video?.url
  if (!best) throw new Error('No downloadable MP4 variant')
  return best
}

async function mirror(item) {
  const key = `videos/${item.id}.mp4`
  const present = await exists(key)
  if (present.exists) return { id: item.id, key, bytes: present.bytes, state: 'existing' }
  if (!apply) return { id: item.id, key, bytes: 0, state: 'missing' }

  const filePath = join(tempDirectory, `${item.id}.mp4`)
  const stagedSource = sourceDirectory ? resolve(sourceDirectory, `${item.id}.mp4`) : null
  let staged = false
  if (stagedSource) {
    try {
      await access(stagedSource)
      await pipeline(createReadStream(stagedSource), createWriteStream(filePath))
      staged = true
    } catch {
      // Fall back to the original public media source below.
    }
  }
  if (!staged) {
    const sourceUrl = await sourceFor(item)
    await retry(`Download ${item.id}`, async () => {
      const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'awesome-minimax-h3-cases/1.0 video-mirror' } })
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      await pipeline(Readable.fromWeb(response.body), createWriteStream(filePath))
    })
  }
  const fileStats = await stat(filePath)
  if (fileStats.size < 10_000) throw new Error(`Downloaded file is too small (${fileStats.size} bytes)`)
  await retry(`Upload ${item.id}`, () => client.send(new PutObjectCommand({
    Bucket: storage.bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: fileStats.size,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { source: item.sourceUrl, caseid: item.id },
  })))
  await rm(filePath, { force: true })
  return { id: item.id, key, bytes: fileStats.size, state: 'uploaded' }
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
  const uploaded = [...results.values()].filter((result) => result.state === 'uploaded')
  const existing = [...results.values()].filter((result) => result.state === 'existing')
  console.log(JSON.stringify({ total: targets.length, uploaded: uploaded.length, existing: existing.length, failed: failed.length, uploadedBytes: uploaded.reduce((sum, result) => sum + result.bytes, 0), failures: failed }, null, 2))
  if (failed.length) process.exitCode = 1
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}
