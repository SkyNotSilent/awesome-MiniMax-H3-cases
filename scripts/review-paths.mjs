import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

export const root = resolve(import.meta.dirname, '..')
export const reviewRoot = resolve(root, '.review')
export const candidatesPath = resolve(reviewRoot, 'candidates.json')
export const publishStagingRoot = resolve(reviewRoot, 'publish-staging')

export function createPublishRunId(now = new Date(), randomId = randomUUID()) {
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `${timestamp}_${randomId.slice(0, 8)}`
}

export function resolvePublishStagingPath(value) {
  if (!value) throw new Error('--staging requires a path')
  const path = resolve(root, value)
  const pathWithinReview = relative(publishStagingRoot, path)
  if (!pathWithinReview || pathWithinReview.startsWith(`..${sep}`) || pathWithinReview === '..' || pathWithinReview.includes(`${sep}..${sep}`)) {
    throw new Error('Staging files must stay inside .review/publish-staging')
  }
  if (!path.endsWith('.json')) throw new Error('Staging file must use a .json extension')
  return path
}

export async function readJson(path, fallback = undefined) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (fallback !== undefined && error?.code === 'ENOENT') return fallback
    throw error
  }
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporaryPath, path)
}

export async function acquirePublishLock() {
  await mkdir(publishStagingRoot, { recursive: true })
  const lockPath = resolve(publishStagingRoot, '.commit.lock')
  let handle
  try {
    handle = await open(lockPath, 'wx')
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`)
  } catch (error) {
    await handle?.close()
    if (error?.code === 'EEXIST') throw new Error('Another staged publication is already running', { cause: error })
    throw error
  }
  await handle.close()
  return async () => rm(lockPath, { force: true })
}
