import { access, copyFile, mkdir, rename, rm } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import { acquirePublishLock, candidatesPath, publishStagingRoot, readJson, resolvePublishStagingPath, root, writeJsonAtomic } from './review-paths.mjs'
import { prepareStagedCommit, updatePrivateCandidates, verifyVideoRoute } from './staged-publish.mjs'

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

const apply = process.argv.includes('--apply')
const stagingPath = resolvePublishStagingPath(argumentValue('--staging'))
const siteBaseUrl = (process.env.SITE_BASE_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
const casesPath = resolve(root, 'data/cases.json')
const publicPosterRoot = resolve(root, 'public/posters/x')
const runId = basename(stagingPath, '.json')
const stagedPosterRoot = resolve(publishStagingRoot, runId, 'posters')

const stagedCases = await readJson(stagingPath)
const publicCases = await readJson(casesPath)
const candidates = await readJson(candidatesPath, [])
if (!Array.isArray(stagedCases)) throw new Error('Staging file must contain an array of cases')

const plan = await prepareStagedCommit({
  stagedCases,
  publicCases,
  verifyVideo: (item) => verifyVideoRoute({ siteBaseUrl, caseId: item.id }),
  posterExists: async (item) => {
    const fileName = basename(item.posterUrl || '')
    if (!fileName) return false
    try {
      await access(resolve(stagedPosterRoot, fileName))
      return true
    } catch {
      try {
        await access(resolve(publicPosterRoot, fileName))
        return true
      } catch {
        return false
      }
    }
  },
})

if (!apply) {
  console.log(JSON.stringify({
    status: 'dry-run',
    staging: relative(root, stagingPath),
    ready: plan.ready.length,
    alreadyCommitted: plan.alreadyCommitted.length,
    failed: plan.failed.map(({ item, reason }) => ({ id: item.id, reason })),
  }, null, 2))
  process.exit(plan.failed.length && !plan.ready.length && !plan.alreadyCommitted.length ? 2 : 0)
}

const releaseLock = await acquirePublishLock()
try {
  await mkdir(publicPosterRoot, { recursive: true })
  for (const item of plan.ready) {
    const fileName = basename(item.posterUrl)
    const source = resolve(stagedPosterRoot, fileName)
    const target = resolve(publicPosterRoot, fileName)
    try {
      await access(target)
    } catch {
      const temporaryTarget = `${target}.${process.pid}.tmp`
      await copyFile(source, temporaryTarget)
      await rename(temporaryTarget, target)
    }
  }

  if (plan.ready.length) await writeJsonAtomic(casesPath, [...publicCases, ...plan.ready])

  const nextCandidates = updatePrivateCandidates({ candidates, ...plan })
  await writeJsonAtomic(candidatesPath, nextCandidates)

  for (const item of [...plan.ready, ...plan.alreadyCommitted]) {
    if (item.posterUrl) await rm(resolve(stagedPosterRoot, basename(item.posterUrl)), { force: true })
  }
  if (plan.failed.length) {
    await writeJsonAtomic(stagingPath, plan.failed.map(({ item }) => item))
  } else {
    await rm(stagingPath, { force: true })
    await rm(resolve(publishStagingRoot, runId), { recursive: true, force: true })
  }

  const status = plan.failed.length ? (plan.ready.length || plan.alreadyCommitted.length ? 'partial' : 'blocked') : 'committed'
  console.log(JSON.stringify({
    status,
    runId,
    published: plan.ready.length,
    alreadyCommitted: plan.alreadyCommitted.length,
    failed: plan.failed.map(({ item, reason }) => ({ id: item.id, reason })),
    publicCases: publicCases.length + plan.ready.length,
  }, null, 2))
  if (status === 'blocked') process.exitCode = 2
} finally {
  await releaseLock()
}
