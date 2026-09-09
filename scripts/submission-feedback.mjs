import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { publishedReply } from './submission-reply-text.mjs'

export async function ensureFeedbackDraft(root, type, item, issueUrl = item.contribution?.issueUrl) {
  if (!issueUrl) return null
  if (!['case', 'tutorial'].includes(type) || !/^[a-z0-9][a-z0-9-]*$/i.test(item.id)
    || !/^https:\/\/github\.com\/SkyNotSilent\/awesome-MiniMax-H3-cases\/issues\/\d+$/.test(issueUrl)) throw new Error('Invalid feedback target')
  const directory = resolve(root, '.review/submission-feedback')
  await mkdir(directory, { recursive: true })
  const path = resolve(directory, `${type}-${item.id}.json`)
  const draft = { version: 1, type, id: item.id, issueUrl, status: 'awaiting-deployment', body: publishedReply(type, item) }
  // Exclusive creation preserves manually edited drafts and makes publisher retries idempotent.
  try { await writeFile(path, `${JSON.stringify(draft, null, 2)}\n`, { flag: 'wx' }) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  return path
}

export async function verifyFeedbackDeployment(path, fetchPage = fetch) {
  const draft = JSON.parse(await readFile(path, 'utf8'))
  if (draft.status !== 'awaiting-deployment') return draft
  const segment = draft.type === 'case' ? 'cases' : 'tutorials'
  for (const prefix of ['', '/en']) {
    const url = `https://h3-field-notes-production.up.railway.app${prefix}/${segment}/${draft.id}/`
    const response = await fetchPage(url, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    const body = await response.text()
    const canonical = [...body.matchAll(/<link\b[^>]*>/gi)].find(([tag]) => /\brel=["']canonical["']/i.test(tag))?.[0]
    const canonicalUrl = canonical?.match(/\bhref=["']([^"']+)["']/i)?.[1]
    if (!response.ok || canonicalUrl !== url) throw new Error('Published bilingual page not verified; draft remains awaiting-deployment')
  }
  // Re-read after network I/O; never overwrite a maintainer edit made during verification.
  const current = JSON.parse(await readFile(path, 'utf8'))
  if (JSON.stringify(current) !== JSON.stringify(draft)) throw new Error('Draft changed during verification; retry')
  const verified = { ...draft, status: 'ready-for-review', deploymentVerifiedAt: new Date().toISOString() }
  await writeFile(path, `${JSON.stringify(verified, null, 2)}\n`)
  return verified
}
