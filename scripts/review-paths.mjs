import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { hostname } from 'node:os'

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
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  const handle = await open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`)
    await handle.sync()
  } finally { await handle.close() }
  try { await rename(temporaryPath, path) } finally { await rm(temporaryPath, { force: true }) }
}

export async function acquirePublishLock(repositoryRoot = root) {
  const lockRoot = resolve(repositoryRoot, '.review/publish-staging')
  await mkdir(lockRoot, { recursive: true })
  const lockPath = resolve(lockRoot, '.commit.lock')
  const token = randomUUID()
  let handle
  try {
    handle = await open(lockPath, 'wx')
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, hostname: hostname(), token, createdAt: new Date().toISOString() })}\n`)
  } catch (error) {
    await handle?.close()
    if (error?.code === 'EEXIST') throw new Error('Publication writer busy: another operation is already running. Inspect .review/publish-staging/.commit.lock; recover only a confirmed dead local owner with node scripts/recover-publish-lock.mjs --apply.', { cause: error })
    throw error
  }
  await handle.close()
  let released = false
  return async () => {
    if (released) return
    const owner = await readJson(lockPath)
    if (owner.token !== token) throw new Error('Writer lock ownership changed; refusing to remove it')
    await rm(lockPath)
    released = true
  }
}


export function rowVersion(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

// Network work happens outside the lock. Changed or deleted inputs must be reviewed again.
export async function mergeReviewedRows(path, before, after, repositoryRoot = root) {
  const release = await acquirePublishLock(repositoryRoot)
  try {
    const current = await readJson(path)
    const originals = new Map(before.map(item => [item.id, item]))
    if (after.some(item => !originals.has(item.id))) throw new Error('Review result contains an unknown input ID')
    const changes = new Map(after.filter(item => rowVersion(item) !== rowVersion(originals.get(item.id))).map(item => [item.id, item]))
    const conflicts = current.filter(item => changes.has(item.id) && rowVersion(item) !== rowVersion(originals.get(item.id))).map(item => item.id)
    for (const id of changes.keys()) if (!current.some(item => item.id === id)) conflicts.push(id)
    if (conflicts.length) throw new Error(`Input changed during review; rerun for: ${conflicts.join(', ')}`)
    await writeJsonAtomic(path, current.map(item => changes.get(item.id) ?? item))
  } finally { await release() }
}

export async function recoverPublishLock(repositoryRoot = root) {
  const lockPath = resolve(repositoryRoot, '.review/publish-staging/.commit.lock')
  // Serialize recovery; never infer death from elapsed time.
  const guard = await open(`${lockPath}.recovery`, 'wx')
  try {
    const original = await readFile(lockPath, 'utf8')
    const owner = JSON.parse(original)
    if (owner.hostname !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error('Cannot establish local lock ownership; manual investigation required')
    try {
      process.kill(owner.pid, 0)
      throw new Error('Lock owner is still active')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
    if (await readFile(lockPath, 'utf8') !== original) throw new Error('Lock changed during recovery')
    await rm(lockPath)
  } finally {
    await guard.close()
    await rm(`${lockPath}.recovery`, { force: true })
  }
}
