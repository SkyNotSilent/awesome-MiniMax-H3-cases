// Mirrors media referenced by captured tutorial originals.
// Images become local WebP files; videos use the same bucket tiers as cases.
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { ensureFaststart } from './video-faststart.mjs'
import { isPlaybackProfileCompliant, PLAYBACK_PROFILE, preparePlaybackFile, probeVideo, selectNativePlaybackVariants, summarizeProbe } from './video-playback-profile.mjs'

const USER_AGENT = 'awesome-minimax-h3-cases/1.0 tutorial-original'
export const IMAGE_MAX_WIDTH = 1600
const IMAGE_QUALITY = 80
const MIN_VIDEO_BYTES = 10_000

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

export async function retry(label, work, attempts = 4) {
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

export function mediaFileName(key) {
  const name = String(key).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  if (!name) throw new Error(`Invalid media key: ${key}`)
  return name
}

// X serves reduced images by default; `large` is enough for the 1600px mirror.
export function largestImageUrl(value) {
  const url = new URL(value)
  if (url.hostname === 'pbs.twimg.com' && url.pathname.startsWith('/media/')) url.searchParams.set('name', 'large')
  return url.href
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function mirrorImage({ root, tutorialId, key, url, fetchImpl = fetch, directory = 'tutorial-media' }) {
  const src = `/${directory}/${tutorialId}/${mediaFileName(key)}.webp`
  const destination = resolve(root, `public${src}`)
  if (!(await fileExists(destination))) {
    const body = await retry(`Download image ${key}`, async () => {
      const response = await fetchImpl(largestImageUrl(url), { headers: { 'User-Agent': USER_AGENT } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    })
    await mkdir(dirname(destination), { recursive: true })
    await sharp(body).rotate().resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true }).webp({ quality: IMAGE_QUALITY }).toFile(destination)
  }
  const { width, height } = await sharp(destination).metadata()
  return { src, width, height }
}

export function createVideoStore(storage) {
  for (const key of ['endpoint', 'accessKeyId', 'secretAccessKey', 'bucket']) {
    if (!storage?.[key]) throw new Error(`Missing video storage setting: ${key}`)
  }
  const client = new S3Client({
    endpoint: storage.endpoint,
    region: storage.region || 'auto',
    forcePathStyle: Boolean(storage.forcePathStyle),
    credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
  })
  async function head(key) {
    try {
      const response = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }))
      return Number(response.ContentLength || 0)
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode
      if (status === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') return null
      throw error
    }
  }
  async function put(key, path, metadata) {
    const { size } = await stat(path)
    await retry(`Upload ${key}`, () => client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: createReadStream(path),
      ContentLength: size,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: metadata,
    })))
    const stored = await head(key)
    if (stored !== size) throw new Error(`Remote size mismatch for ${key}`)
    const range = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key, Range: 'bytes=0-1' }))
    if (!range.ContentRange?.startsWith('bytes 0-1/')) throw new Error(`Remote Range request failed for ${key}`)
    if (range.Body) await range.Body.transformToByteArray()
    return size
  }
  return { head, put }
}

async function download(url, destination) {
  await retry(`Download ${url.split('?')[0]}`, async () => {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
  })
  const { size } = await stat(destination)
  if (size < MIN_VIDEO_BYTES) throw new Error(`Downloaded video is too small (${size} bytes)`)
}

async function nativePlayback(name, variants, tempDirectory) {
  const candidates = selectNativePlaybackVariants(variants)
  for (let index = 0; index < candidates.length; index += 1) {
    const path = join(tempDirectory, `${name}.native-${index}.mp4`)
    try {
      await download(candidates[index].url, path)
      if (!isPlaybackProfileCompliant(summarizeProbe(await probeVideo(path)))) continue
      return await preparePlaybackFile(path, tempDirectory)
    } catch (error) {
      console.warn(`Playback variant rejected for ${name}: ${error?.message || error}`)
    }
  }
  return null
}

// Tutorial videos share the case route: /media/{name}.mp4 redirects to the playback tier.
export async function mirrorVideo({ store, key, url, variants, sourceUrl, tempDirectory }) {
  const name = `tutorial-${mediaFileName(key)}`
  const sourceKey = `videos/${name}.mp4`
  const playbackKey = `${PLAYBACK_PROFILE.prefix}/${name}.mp4`
  const [sourceBytes, playbackBytes] = await Promise.all([store.head(sourceKey), store.head(playbackKey)])
  const result = { src: `/media/${name}.mp4` }
  if (sourceBytes && playbackBytes) return { ...result, state: 'existing' }

  const metadata = { source: sourceUrl, tutorialmedia: name, faststart: 'true' }
  const originalPath = join(tempDirectory, `${name}.mp4`)
  await download(url, originalPath)
  const prepared = await ensureFaststart(originalPath, tempDirectory)
  if (!sourceBytes) await store.put(sourceKey, prepared.path, { ...metadata, tier: 'source' })
  if (!playbackBytes) {
    const playback = await nativePlayback(name, variants, tempDirectory) ?? await preparePlaybackFile(prepared.path, tempDirectory)
    await store.put(playbackKey, playback.path, { ...metadata, tier: 'playback', profile: PLAYBACK_PROFILE.name, preparation: playback.state })
  }
  return { ...result, state: 'uploaded' }
}

// After a capture is written, remove mirrored images it no longer references.
export async function pruneMirroredImages({ root, directory, id, keep }) {
  const folder = resolve(root, `public/${directory}/${id}`)
  const names = await readdir(folder).catch(() => [])
  const removed = []
  for (const name of names) {
    const src = `/${directory}/${id}/${name}`
    if (keep.has(src)) continue
    await rm(resolve(folder, name), { force: true })
    removed.push(src)
  }
  return removed
}

