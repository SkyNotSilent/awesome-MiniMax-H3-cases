import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
let fixture = null
const terms = []
for (let index = 0; index < args.length; index++) {
  const value = args[index]
  if (value === '--fixture') {
    const path = args[++index]
    if (!path?.trim() || path.startsWith('--')) throw new Error('Missing value for --fixture')
    if (fixture) throw new Error('Duplicate option --fixture')
    fixture = resolve(process.cwd(), path)
  } else if (value.startsWith('--')) throw new Error(`Unknown option: ${value}`)
  else terms.push(value)
}
const query = terms.join(' ').trim().toLowerCase()
if (!query) throw new Error('Usage: node scripts/query.mjs <search terms> [--fixture <directory>]')

const baseUrl = (process.env.H3_LIBRARY_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
async function load(relative) {
  if (fixture) return JSON.parse(await readFile(resolve(fixture, relative), 'utf8'))
  const response = await fetch(`${baseUrl}/data/${relative}`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}). No case or Prompt was generated.`)
  return response.json()
}

const catalog = await load('catalog.json')
const matches = catalog.cases.filter((item) => [item.title, item.titleEn, item.author, item.category, ...(item.styles || []), ...(item.scenes || []), ...(item.tags || [])].join(' ').toLowerCase().includes(query)).slice(0, 5)
const results = []
for (const item of matches) {
  let publicPrompt = null
  let provenance = 'not-published'
  if (item.hasPrompt) {
    const detail = await load(`cases/${item.id}.json`)
    const complete = !detail.promptCompleteness || detail.promptCompleteness === 'complete'
    const verbatim = ['creator-verbatim', 'official-verbatim'].includes(detail.promptProvenance)
    if (complete && verbatim && detail.prompt?.trim()) {
      publicPrompt = detail.prompt
      provenance = detail.promptProvenance
    }
  }
  results.push({ id: item.id, title: item.title, titleEn: item.titleEn, author: item.author, sourceUrl: item.sourceUrl, publicPrompt, provenance })
}
console.log(JSON.stringify({ query, matches: results, disclosure: results.length ? 'Only complete verbatim public Prompts are returned.' : 'No catalog match. No case or Prompt was invented.' }, null, 2))
