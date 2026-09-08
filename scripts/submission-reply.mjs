import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const baseUrl = 'https://h3-field-notes-production.up.railway.app'

export function publishedReply(type, item) {
  const segment = type === 'case' ? 'cases' : 'tutorials'
  const zh = `${baseUrl}/${segment}/${item.id}/`
  const en = `${baseUrl}/en/${segment}/${item.id}/`
  return [
    'Published with permanent attribution. Thank you for contributing to the H3 creator community.',
    '',
    `- 中文：${zh}`,
    `- English: ${en}`,
    `- Original source: ${item.source?.url ?? item.sourceUrl}`,
    '',
    'The original work/profile remains linked on both pages. Please use this Issue for attribution corrections or removal requests.',
  ].join('\n')
}

async function run() {
  const type = process.argv[process.argv.indexOf('--type') + 1]
  const id = process.argv[process.argv.indexOf('--id') + 1]
  if (!['case', 'tutorial'].includes(type) || !id) throw new Error('Usage: node scripts/submission-reply.mjs --type case|tutorial --id <public-id>')
  const file = type === 'case' ? 'data/cases.json' : 'data/tutorial-guides.json'
  const items = JSON.parse(await readFile(resolve(root, file), 'utf8'))
  const item = items.find((entry) => entry.id === id)
  if (!item) throw new Error(`Published ${type} not found: ${id}`)
  console.log(publishedReply(type, item))
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await run()
