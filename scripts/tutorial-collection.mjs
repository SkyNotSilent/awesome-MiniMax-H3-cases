import { access, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const tutorialCategories = new Set(['getting-started', 'comfyui', 'prompt', 'acceleration', 'long-video', 'audio', 'training'])
const requiredChecks = ['originalAuthor', 'targetsH3', 'stepsExecutable', 'commandsVerified', 'bilingualComplete', 'posterCached', 'sourceActive']

export function xStatusId(url = '') {
  return String(url).match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i)?.[1] ?? null
}

export function tutorialCandidateKey(candidate) {
  return xStatusId(candidate?.source?.url) ?? candidate?.id ?? null
}

function localizedComplete(value, list = false) {
  if (!value || typeof value !== 'object') return false
  if (list) return ['zh', 'en'].every((language) => Array.isArray(value[language]) && value[language].length > 0 && value[language].every((item) => typeof item === 'string' && item.trim()))
  return ['zh', 'en'].every((language) => typeof value[language] === 'string' && value[language].trim())
}

export function candidateErrors(candidate, publishedGuides = []) {
  const errors = []
  const statusId = xStatusId(candidate?.source?.url)
  if (!candidate?.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id)) errors.push('invalid-id')
  if (candidate?.contentType !== 'community') errors.push('community-only')
  if (!tutorialCategories.has(candidate?.category)) errors.push('invalid-category')
  if (candidate?.source?.platform !== 'x') errors.push('community-source-must-be-x')
  if (!statusId) errors.push('original-x-status-required')
  if (!candidate?.source?.author || !candidate?.source?.publishedAt || !candidate?.source?.originalLanguage) errors.push('incomplete-source')
  for (const field of ['title', 'outcome', 'audience', 'hardware']) if (!localizedComplete(candidate?.[field])) errors.push(`incomplete-${field}`)
  for (const field of ['prerequisites', 'steps', 'caveats']) if (!localizedComplete(candidate?.[field], true)) errors.push(`incomplete-${field}`)
  if (!Array.isArray(candidate?.commands)) errors.push('invalid-commands')
  if (!candidate?.posterUrl?.startsWith('/tutorial-posters/')) errors.push('invalid-poster')
  if (!Array.isArray(candidate?.tags) || candidate.tags.length === 0) errors.push('missing-tags')
  if (!Array.isArray(candidate?.relatedResourceIds)) errors.push('invalid-related-resources')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate?.verifiedAt ?? '')) errors.push('invalid-verified-date')
  for (const check of requiredChecks) if (candidate?.verification?.[check] !== true) errors.push(`unverified-${check}`)

  const duplicate = publishedGuides.find((item) => item.id === candidate?.id || (statusId && xStatusId(item?.source?.url) === statusId))
  if (duplicate) errors.push('duplicate')
  return [...new Set(errors)]
}

export function partitionCandidates(candidates, publishedGuides = []) {
  const seen = new Set()
  const ready = []
  const blocked = []
  for (const candidate of candidates) {
    const key = tutorialCandidateKey(candidate)
    if (!key || seen.has(key)) {
      blocked.push({ ...candidate, reviewStatus: 'blocked', errors: ['duplicate-candidate'] })
      continue
    }
    seen.add(key)
    const errors = candidateErrors(candidate, publishedGuides)
    if (errors.length) blocked.push({ ...candidate, reviewStatus: 'blocked', errors })
    else ready.push(candidate)
  }
  return { ready, blocked }
}

export function toPublicTutorial(candidate, addedAt = new Date().toISOString()) {
  const {
    id, contentType, category, title, outcome, audience, hardware, prerequisites,
    steps, commands, caveats, posterUrl, tags, relatedResourceIds, source,
    engagement, verifiedAt,
  } = candidate
  return {
    id, contentType, category, title, outcome, audience, hardware, prerequisites,
    steps, commands, caveats, posterUrl, tags, relatedResourceIds, source,
    ...(engagement ? { engagement } : {}),
    verifiedAt,
    addedAt,
  }
}

export async function posterExists(root, posterUrl) {
  try {
    await access(resolve(root, 'public', posterUrl.replace(/^\//, '')))
    return true
  } catch {
    return false
  }
}

async function runCli() {
  const root = resolve(import.meta.dirname, '..')
  const ledgerPath = resolve(root, '.review/tutorials/candidates.json')
  const publicPath = resolve(root, 'data/tutorial-guides.json')
  const publish = process.argv.includes('--publish')
  const limitArg = process.argv.find((value) => value.startsWith('--limit='))
  const limit = Math.max(1, Number(limitArg?.split('=')[1] ?? 20))
  const candidates = JSON.parse(await readFile(ledgerPath, 'utf8'))
  const published = JSON.parse(await readFile(publicPath, 'utf8'))
  const { ready: structurallyReady, blocked } = partitionCandidates(candidates, published)
  const ready = []
  for (const candidate of structurallyReady) {
    if (await posterExists(root, candidate.posterUrl)) ready.push(candidate)
    else blocked.push({ ...candidate, reviewStatus: 'blocked', errors: ['poster-file-missing'] })
  }

  const selected = ready.slice(0, limit)
  if (publish && selected.length) {
    const publicItems = selected.map(toPublicTutorial)
    await writeFile(publicPath, `${JSON.stringify([...published, ...publicItems], null, 2)}\n`)
    const selectedIds = new Set(selected.map((item) => item.id))
    const nextLedger = [
      ...candidates.filter((item) => !selectedIds.has(item.id)),
      ...selected.map((item) => ({ id: item.id, source: item.source, reviewStatus: 'published', publishedAt: new Date().toISOString() })),
    ]
    await writeFile(ledgerPath, `${JSON.stringify(nextLedger, null, 2)}\n`)
  }

  console.log(JSON.stringify({ checked: candidates.length, ready: ready.length, published: publish ? selected.length : 0, blocked: blocked.length }, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runCli()
}
