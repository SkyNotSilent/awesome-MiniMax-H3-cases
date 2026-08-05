import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const templates = JSON.parse(await readFile(resolve(root, 'data/templates.json'), 'utf8'))
const modes = new Set(['T2VA', 'FL2VA', 'Ref2VA'])
const provenance = new Set(['official-verbatim', 'official-adapted', 'creator-verbatim', 'reconstructed'])
const ids = new Set()
const errors = []

for (const [index, item] of cases.entries()) {
  const at = `cases[${index}]`
  for (const key of ['id', 'title', 'model', 'mode', 'prompt', 'sourceUrl', 'author', 'category', 'posterUrl']) {
    if (!item[key]) errors.push(`${at}.${key} is required`)
  }
  if (ids.has(item.id)) errors.push(`${at}.id is duplicated: ${item.id}`)
  ids.add(item.id)
  if (!modes.has(item.mode)) errors.push(`${at}.mode is invalid: ${item.mode}`)
  if (!provenance.has(item.promptProvenance)) errors.push(`${at}.promptProvenance is invalid`)
  for (const key of ['styles', 'scenes', 'inputTypes', 'tags']) {
    if (!Array.isArray(item[key]) || item[key].length === 0) errors.push(`${at}.${key} must be a non-empty array`)
  }
  try {
    new URL(item.sourceUrl)
    new URL(item.mediaUrl)
  } catch {
    errors.push(`${at} contains an invalid URL`)
  }
  if (item.posterUrl?.startsWith('/')) {
    try {
      await access(resolve(root, 'public', item.posterUrl.slice(1)))
    } catch {
      errors.push(`${at}.posterUrl does not exist: ${item.posterUrl}`)
    }
  }
}

for (const [index, item] of templates.entries()) {
  if (!item.id || !item.title || !item.template) errors.push(`templates[${index}] is incomplete`)
  if (!ids.has(item.sourceCaseId)) errors.push(`templates[${index}] references missing case ${item.sourceCaseId}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Validated ${cases.length} cases and ${templates.length} templates.`)
