import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publishedReply } from './submission-reply-text.mjs'
export { publishedReply } from './submission-reply-text.mjs'

const root = resolve(import.meta.dirname, '..')

async function run() {
  const type = process.argv[process.argv.indexOf('--type') + 1]
  const id = process.argv[process.argv.indexOf('--id') + 1]
  if (!['case', 'tutorial'].includes(type) || !id) throw new Error('Usage: node scripts/submission-reply.mjs --type case|tutorial --id <public-id>')
  const file = type === 'case' ? 'data/cases.json' : 'data/tutorial-guides.json'
  const items = JSON.parse(await readFile(resolve(root, file), 'utf8'))
  const item = items.find((entry) => entry.id === id)
  if (!item) throw new Error(`Published ${type} not found: ${id}`)
  if (process.argv.includes('--draft') || process.argv.includes('--verify-deployment')) {
    const { ensureFeedbackDraft, verifyFeedbackDeployment } = await import('./submission-feedback.mjs')
    const path = await ensureFeedbackDraft(root, type, item)
    if (!path) throw new Error('No associated submission Issue; no draft was created.')
    const state = process.argv.includes('--verify-deployment') ? await verifyFeedbackDeployment(path) : JSON.parse(await readFile(path, 'utf8'))
    console.log(JSON.stringify({ id, type, status: state.status, posted: false }))
    return
  }
  console.log(publishedReply(type, item))
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await run()
