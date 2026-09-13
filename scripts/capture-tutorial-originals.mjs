// Captures the complete public original of each tutorial source into
// data/tutorial-originals/{id}.json and mirrors its media.
//
//   node scripts/capture-tutorial-originals.mjs [--only id,id] [--apply]
//   railway bucket credentials --bucket h3-videos --json \
//     | node scripts/capture-tutorial-originals.mjs --apply --credentials-stdin
//
// A failed or deleted source never removes an existing capture.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { collectOriginalMedia, rewriteOriginalMedia, tutorialOriginalErrors, xPayloadToOriginal } from './tutorial-original.mjs'
import { fetchMarkdownOriginal, supportsMarkdownSource } from './tutorial-original-markdown.mjs'
import { createVideoStore, mirrorImage, mirrorVideo, retry } from './tutorial-media.mjs'

const root = resolve(import.meta.dirname, '..')
const guidesPath = resolve(root, 'data/tutorial-guides.json')
const originalsDirectory = resolve(root, 'data/tutorial-originals')
const USER_AGENT = 'awesome-minimax-h3-cases/1.0 tutorial-original'

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

const apply = process.argv.includes('--apply')
const onlyIds = new Set((argumentValue('--only') || '').split(',').map((value) => value.trim()).filter(Boolean))

async function readCredentials() {
  if (!process.argv.includes('--credentials-stdin')) {
    const env = process.env
    if (!env.VIDEO_S3_ENDPOINT) return null
    return { endpoint: env.VIDEO_S3_ENDPOINT, accessKeyId: env.VIDEO_S3_ACCESS_KEY_ID, secretAccessKey: env.VIDEO_S3_SECRET_ACCESS_KEY, bucket: env.VIDEO_S3_BUCKET, region: env.VIDEO_S3_REGION, forcePathStyle: env.VIDEO_S3_FORCE_PATH_STYLE === 'true' }
  }
  let payload = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) payload += chunk
  const value = JSON.parse(payload)
  return { endpoint: value.endpoint, accessKeyId: value.accessKeyId, secretAccessKey: value.secretAccessKey, bucket: value.bucketName, region: value.region, forcePathStyle: value.urlStyle === 'path' }
}

async function fetchXOriginal(guide, capturedAt) {
  const statusId = guide.source.url.match(/status\/(\d+)/)?.[1]
  if (!statusId) throw new Error('X source has no status id')
  const payload = await retry(`Fetch X thread ${statusId}`, async () => {
    const response = await fetch(`https://api.fxtwitter.com/2/thread/${statusId}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json()
    if (!body.status && !body.thread?.length) throw new Error('Source unavailable')
    return body
  })
  return xPayloadToOriginal(payload, { tutorialId: guide.id, capturedAt, language: guide.source.originalLanguage })
}

async function readExisting(id) {
  try {
    return JSON.parse(await readFile(resolve(originalsDirectory, `${id}.json`), 'utf8'))
  } catch {
    return null
  }
}

function contentSignature(original) {
  return JSON.stringify({ ...original, capturedAt: null })
}

async function mirrorMedia(original, { store, tempDirectory, sourceUrl }) {
  const mirrored = new Map()
  for (const item of collectOriginalMedia(original)) {
    if (item.kind === 'image') {
      mirrored.set(item.key, await mirrorImage({ root, tutorialId: original.tutorialId, key: item.key, url: item.url }))
    } else {
      if (!store) throw new Error('Video storage credentials are required for sources with video')
      const video = await mirrorVideo({ store, key: item.key, url: item.url, variants: item.variants, sourceUrl, tempDirectory })
      console.log(`  video ${item.key}: ${video.state}`)
      mirrored.set(item.key, video)
    }
  }
  return mirrored
}

async function capture(guide, { store, tempDirectory }) {
  const capturedAt = new Date().toISOString()
  const draft = guide.source.platform === 'x'
    ? await fetchXOriginal(guide, capturedAt)
    : await fetchMarkdownOriginal(guide, capturedAt)
  const media = collectOriginalMedia(draft)
  if (!apply) return { id: guide.id, state: 'dry-run', kind: draft.kind, sections: draft.sections.length, media: media.length }
  const original = rewriteOriginalMedia(draft, await mirrorMedia(draft, { store, tempDirectory, sourceUrl: guide.source.url }))
  const errors = tutorialOriginalErrors(original)
  if (errors.length) throw new Error(errors.slice(0, 5).join('; '))
  const existing = await readExisting(guide.id)
  if (existing && contentSignature(existing) === contentSignature(original)) return { id: guide.id, state: 'unchanged', kind: original.kind, capturedAt: existing.capturedAt }
  await writeFile(resolve(originalsDirectory, `${guide.id}.json`), `${JSON.stringify(original, null, 2)}\n`)
  return { id: guide.id, state: existing ? 'updated' : 'captured', kind: original.kind, capturedAt }
}

const guides = JSON.parse(await readFile(guidesPath, 'utf8'))
const unknown = [...onlyIds].filter((id) => !guides.some((guide) => guide.id === id))
if (unknown.length) throw new Error(`Unknown tutorial ids: ${unknown.join(', ')}`)
const targets = guides.filter((guide) => (!onlyIds.size || onlyIds.has(guide.id)) && (guide.source.platform === 'x' || supportsMarkdownSource(guide)))
const credentials = await readCredentials()
const store = credentials ? createVideoStore(credentials) : null
const tempDirectory = await mkdtemp(join(tmpdir(), 'h3-tutorial-original-'))
const results = []
try {
  for (const guide of targets) {
    try {
      const result = await capture(guide, { store, tempDirectory })
      results.push(result)
      console.log(`${result.state.padEnd(9)} ${guide.id} ${result.kind}`)
    } catch (error) {
      results.push({ id: guide.id, state: 'failed', error: error?.message || String(error) })
      console.error(`failed    ${guide.id}: ${error?.message || error}`)
    }
  }
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}

if (apply) {
  const captured = new Map(results.filter((result) => result.capturedAt).map((result) => [result.id, result]))
  const next = guides.map((guide) => {
    const result = captured.get(guide.id)
    return result ? { ...guide, original: { kind: result.kind, capturedAt: result.capturedAt } } : guide
  })
  if (JSON.stringify(next) !== JSON.stringify(guides)) await writeFile(guidesPath, `${JSON.stringify(next, null, 2)}\n`)
}
const failed = results.filter((result) => result.state === 'failed')
console.log(JSON.stringify({ total: targets.length, failed: failed.length, failures: failed }, null, 2))
if (failed.length) process.exitCode = 1
