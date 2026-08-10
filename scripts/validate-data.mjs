import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const modes = new Set(['T2VA', 'FL2VA', 'Ref2VA', 'Unknown'])
const provenance = new Set(['official-verbatim', 'creator-verbatim', 'not-published'])
const ids = new Set()
const sourceUrls = new Set()
const errors = []

for (const [index, item] of cases.entries()) {
  const at = `cases[${index}]`
  for (const key of ['id', 'title', 'titleEn', 'summary', 'summaryEn', 'model', 'mode', 'sourceUrl', 'sourceLabel', 'author', 'publishedAt', 'category', 'posterUrl', 'resolution', 'aspectRatio']) {
    if (!item[key]) errors.push(`${at}.${key} is required`)
  }
  if (!Object.hasOwn(item, 'prompt')) errors.push(`${at}.prompt is required and must be a verbatim string or null`)
  if (Object.hasOwn(item, 'promptEn')) errors.push(`${at}.promptEn is not allowed; preserve the original prompt in every locale`)
  if (/[\u3400-\u9fff]/u.test(item.titleEn || '')) errors.push(`${at}.titleEn must not contain CJK text`)
  if (/[\u3400-\u9fff]/u.test(item.summaryEn || '')) errors.push(`${at}.summaryEn must not contain CJK text`)
  if (ids.has(item.id)) errors.push(`${at}.id is duplicated: ${item.id}`)
  ids.add(item.id)
  const normalizedSource = item.sourceUrl?.replace(/\?.*$/, '')
  if (sourceUrls.has(normalizedSource)) errors.push(`${at}.sourceUrl is duplicated: ${normalizedSource}`)
  sourceUrls.add(normalizedSource)
  if (!Number.isFinite(item.duration) || item.duration <= 0) errors.push(`${at}.duration must be a positive number`)
  if (Number.isNaN(Date.parse(item.publishedAt))) errors.push(`${at}.publishedAt must be a valid date`)
  if (!modes.has(item.mode)) errors.push(`${at}.mode is invalid: ${item.mode}`)
  if (!provenance.has(item.promptProvenance)) errors.push(`${at}.promptProvenance is invalid`)
  if (item.promptProvenance === 'not-published') {
    if (item.prompt !== null) errors.push(`${at}.prompt must be null when promptProvenance is not-published`)
  } else if (typeof item.prompt !== 'string' || item.prompt.trim().length === 0) {
    errors.push(`${at}.prompt must be a non-empty verbatim string for published prompt provenance`)
  }
  if (item.sourceType === 'x' && !item.posterUrl?.startsWith('/posters/x/')) {
    errors.push(`${at}.posterUrl must use a case-specific X video cover`)
  }
  for (const key of ['styles', 'scenes', 'inputTypes', 'tags']) {
    if (!Array.isArray(item[key]) || item[key].length === 0) errors.push(`${at}.${key} must be a non-empty array`)
  }
  if (item.engagement) {
    for (const key of ['replies', 'reposts', 'likes', 'views']) {
      if (!Number.isFinite(item.engagement[key]) || item.engagement[key] < 0) errors.push(`${at}.engagement.${key} must be a non-negative number`)
    }
    const engagementTimestamp = item.engagement.snapshotAt ?? item.engagement.capturedAt
    if (Number.isNaN(Date.parse(engagementTimestamp))) errors.push(`${at}.engagement snapshotAt/capturedAt must be a valid date`)
  }
  if (item.approvedAt && Number.isNaN(Date.parse(item.approvedAt))) errors.push(`${at}.approvedAt must be a valid date`)
  try {
    new URL(item.sourceUrl)
    if (item.mediaUrl) new URL(item.mediaUrl)
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

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Validated ${cases.length} cases.`)
