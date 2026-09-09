import { test, expect } from 'vitest'
import { mkdtemp, readFile, writeFile, rm, mkdir, copyFile, realpath } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureFeedbackDraft, verifyFeedbackDeployment } from './submission-feedback.mjs'

test('direct CLI draft invocation terminates and preserves its private draft on retry', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'h3-feedback-cli-')))
  try {
    await mkdir(join(root, 'scripts'))
    await mkdir(join(root, 'data'))
    for (const name of ['submission-reply.mjs', 'submission-reply-text.mjs', 'submission-feedback.mjs']) {
      await copyFile(new URL(name, import.meta.url), join(root, 'scripts', name))
    }
    const item = { id: 'example', sourceUrl: 'https://example.com', contribution: { issueUrl: 'https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/16' } }
    await writeFile(join(root, 'data/cases.json'), JSON.stringify([item]))
    const args = [join(root, 'scripts/submission-reply.mjs'), '--type', 'case', '--id', 'example', '--draft']
    const first = await promisify(execFile)(process.execPath, args, { timeout: 10000 })
    expect(JSON.parse(first.stdout)).toMatchObject({ status: 'awaiting-deployment', posted: false })
    const path = join(root, '.review/submission-feedback/case-example.json')
    const original = await readFile(path, 'utf8')
    await promisify(execFile)(process.execPath, args, { timeout: 10000 })
    expect(await readFile(path, 'utf8')).toBe(original)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('feedback is private, idempotent, preserves manual edits and waits for both deployed pages', async () => {
  const root = await mkdtemp(join(tmpdir(), 'h3-feedback-'))
  try {
    const item = { id: 'example', sourceUrl: 'https://example.com', contribution: { issueUrl: 'https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/16' } }
    const path = await ensureFeedbackDraft(root, 'case', item)
    const draft = JSON.parse(await readFile(path, 'utf8'))
    expect(draft.status).toBe('awaiting-deployment')
    draft.body = 'Maintainer edit'
    await writeFile(path, JSON.stringify(draft))
    await ensureFeedbackDraft(root, 'case', item)
    expect(JSON.parse(await readFile(path, 'utf8')).body).toBe('Maintainer edit')
    await expect(verifyFeedbackDeployment(path, async () => new Response('404', { status: 404 }))).rejects.toThrow(/not verified/)
    expect(JSON.parse(await readFile(path, 'utf8')).status).toBe('awaiting-deployment')
    await expect(verifyFeedbackDeployment(path, async url => new Response(`<link rel="canonical" href="https://example.com/"><a href="${url}">case</a>`))).rejects.toThrow(/not verified/)
    const urls = []
    const result = await verifyFeedbackDeployment(path, async url => { urls.push(url); return new Response(`<link rel="canonical" href="${url}">`) })
    expect(urls).toHaveLength(2)
    expect(result).toMatchObject({ status: 'ready-for-review', body: 'Maintainer edit' })
  } finally { await rm(root, { recursive: true, force: true }) }
})
