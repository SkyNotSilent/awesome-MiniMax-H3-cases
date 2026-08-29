import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ensureFaststart, inspectFaststart } from './video-faststart.mjs'

const approvedIds = [
  'official-t2va-starship',
  'official-fl2va-ramen',
  'official-ref2va-lamb',
]
const apply = process.argv.includes('--apply')
const root = resolve(import.meta.dirname, '..')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const selected = approvedIds.map((id) => cases.find((item) => item.id === id))
if (selected.some((item) => !item || item.sourceType !== 'official')) throw new Error('Approved official video set no longer matches public data.')

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
const tempDirectory = await mkdtemp(join(tmpdir(), 'h3-official-faststart-'))
const backupPrefix = `videos/_backup-faststart-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')}`
const results = []

async function download(key, destination) {
  const response = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }))
  if (!response.Body) throw new Error(`Empty object body for ${key}`)
  await pipeline(response.Body, createWriteStream(destination))
}

async function verifyRemote(key, expectedBytes) {
  const head = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }))
  if (Number(head.ContentLength) !== expectedBytes) throw new Error(`Remote size mismatch for ${key}`)
  const range = await client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key, Range: 'bytes=0-1048575' }))
  if (!range.ContentRange?.startsWith('bytes 0-')) throw new Error(`Range request was not honored for ${key}`)
  const bytes = Buffer.from(await range.Body.transformToByteArray())
  const rangePath = join(tempDirectory, `${key.split('/').at(-1)}.range`)
  await writeFile(rangePath, bytes)
  const inspection = await inspectFaststart(rangePath)
  if (!inspection.moov || !inspection.mdat || inspection.moov.offset > inspection.mdat.offset) {
    throw new Error(`Remote object is not faststart: ${key}`)
  }
}

try {
  for (const item of selected) {
    const key = `videos/${item.id}.mp4`
    const backupKey = `${backupPrefix}/${item.id}.mp4`
    const originalPath = join(tempDirectory, `${item.id}.mp4`)
    await download(key, originalPath)
    const prepared = await ensureFaststart(originalPath, tempDirectory)
    const outputStats = await stat(prepared.path)
    if (!apply) {
      results.push({ id: item.id, state: prepared.changed ? 'needs-remux' : 'already-faststart', bytes: outputStats.size })
      continue
    }

    await client.send(new CopyObjectCommand({
      Bucket: storage.bucket,
      Key: backupKey,
      CopySource: encodeURI(`${storage.bucket}/${key}`),
      MetadataDirective: 'COPY',
    }))
    try {
      await client.send(new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: createReadStream(prepared.path),
        ContentLength: outputStats.size,
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: { source: item.sourceUrl, caseid: item.id, faststart: 'true' },
      }))
      await verifyRemote(key, outputStats.size)
      results.push({ id: item.id, state: prepared.changed ? 'remuxed' : 'verified', bytes: outputStats.size, backupKey })
    } catch (error) {
      await client.send(new CopyObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        CopySource: encodeURI(`${storage.bucket}/${backupKey}`),
        MetadataDirective: 'COPY',
      }))
      throw error
    }
  }
  console.log(JSON.stringify({ apply, backupPrefix: apply ? backupPrefix : null, results }, null, 2))
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}
