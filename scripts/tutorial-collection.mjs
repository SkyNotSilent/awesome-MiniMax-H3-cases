import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { projectTutorial, tutorialContractErrors, tutorialSourceKey } from './tutorial-contract.mjs'
import { acquirePublishLock, writeJsonAtomic } from './review-paths.mjs'
import { ensureFeedbackDraft } from './submission-feedback.mjs'

export const tutorialCategories = new Set(['getting-started', 'comfyui', 'prompt', 'acceleration', 'long-video', 'audio', 'training'])
const requiredChecks = ['originalAuthor', 'targetsH3', 'stepsExecutable', 'commandsVerified', 'bilingualComplete', 'posterCached', 'sourceActive']

export function xStatusId(url = '') {
  return tutorialSourceKey({ platform: 'x', url })?.slice(2) ?? null
}

export function tutorialCandidateKey(candidate) {
  return tutorialSourceKey(candidate?.source ?? {}) ?? candidate?.id ?? null
}

function localizedComplete(value, list = false) {
  if (!value || typeof value !== 'object') return false
  if (list) return ['zh', 'en'].every((language) => Array.isArray(value[language]) && value[language].length > 0 && value[language].every((item) => typeof item === 'string' && item.trim()))
  return ['zh', 'en'].every((language) => typeof value[language] === 'string' && value[language].trim())
}

export function candidateErrors(candidate, publishedGuides = []) {
  const errors = []
  const sourceKey = tutorialSourceKey(candidate?.source ?? {})
  if (!candidate?.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.id)) errors.push('invalid-id')
  if (!['community', 'foundation'].includes(candidate?.contentType)) errors.push('invalid-content-type')
  if (!tutorialCategories.has(candidate?.category)) errors.push('invalid-category')
  if (!sourceKey) errors.push('invalid-original-source')
  if (!candidate?.source?.author || !candidate?.source?.originalLanguage) errors.push('incomplete-source')
  for (const field of ['title', 'outcome', 'audience', 'hardware']) if (!localizedComplete(candidate?.[field])) errors.push(`incomplete-${field}`)
  for (const field of ['prerequisites', 'steps', 'caveats']) if (!localizedComplete(candidate?.[field], true)) errors.push(`incomplete-${field}`)
  if (!Array.isArray(candidate?.commands)) errors.push('invalid-commands')
  if (!candidate?.posterUrl?.startsWith('/tutorial-posters/')) errors.push('invalid-poster')
  if (!Array.isArray(candidate?.tags) || candidate.tags.length === 0) errors.push('missing-tags')
  if (!Array.isArray(candidate?.relatedResourceIds)) errors.push('invalid-related-resources')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate?.verifiedAt ?? '')) errors.push('invalid-verified-date')
  for (const check of requiredChecks) if (candidate?.verification?.[check] !== true) errors.push(`unverified-${check}`)

  const duplicate = publishedGuides.find((item) => item.id === candidate?.id || (sourceKey && tutorialSourceKey(item?.source ?? {}) === sourceKey))
  if (duplicate) errors.push('duplicate')
  errors.push(...tutorialContractErrors(toPublicTutorial(candidate)))
  return [...new Set(errors)]
}

export function partitionCandidates(candidates, publishedGuides = []) {
  const seen = new Set()
  const seenIds = new Set()
  const ready = []
  const blocked = []
  for (const candidate of candidates) {
    const key = tutorialCandidateKey(candidate)
    if (!key || seen.has(key) || seenIds.has(candidate?.id)) {
      blocked.push({ ...candidate, reviewStatus: 'blocked', errors: ['duplicate-candidate'] })
      continue
    }
    seen.add(key)
    seenIds.add(candidate.id)
    const errors = candidateErrors(candidate, publishedGuides)
    if (errors.length) blocked.push({ ...candidate, reviewStatus: 'blocked', errors })
    else ready.push(candidate)
  }
  return { ready, blocked }
}

export function toPublicTutorial(candidate, addedAt = new Date().toISOString()) {
  return projectTutorial({ ...candidate, addedAt: candidate.addedAt ?? addedAt })
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
  const release = publish ? await acquirePublishLock(root) : async () => {}
  try {
    const candidates = JSON.parse(await readFile(ledgerPath, 'utf8'))
    const published = JSON.parse(await readFile(publicPath, 'utf8'))
    if (publish) for (const item of published) await ensureFeedbackDraft(root, 'tutorial', item)
    const { ready: structurallyReady, blocked } = partitionCandidates(candidates, published)
    const ready = []
    for (const candidate of structurallyReady) {
      if (await posterExists(root, candidate.posterUrl)) ready.push(candidate)
      else blocked.push({ ...candidate, reviewStatus: 'blocked', errors: ['poster-file-missing'] })
    }

    const selected = ready.slice(0, limit)
    if (publish && selected.length) {
      const publicItems = selected.map(candidate => toPublicTutorial(candidate, new Date().toISOString()))
      await writeJsonAtomic(publicPath, [...published, ...publicItems])
      for (const item of publicItems) await ensureFeedbackDraft(root, 'tutorial', item)
      const selectedIds = new Set(selected.map((item) => item.id))
      const nextLedger = [
        ...candidates.filter((item) => !selectedIds.has(item.id)),
        ...selected.map((item) => ({ id: item.id, source: item.source, reviewStatus: 'published', publishedAt: new Date().toISOString() })),
      ]
      await writeJsonAtomic(ledgerPath, nextLedger)
    }

    console.log(JSON.stringify({ checked: candidates.length, ready: ready.length, published: publish ? selected.length : 0, blocked: blocked.length }, null, 2))
  } finally { await release() }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runCli()
}
