import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { editorialCopyErrors, genericEditorialCopyPattern } from './editorial-copy.mjs'

const root = resolve(import.meta.dirname, '..')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const tutorials = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const tutorialGuides = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const modes = new Set(['T2VA', 'FL2VA', 'Ref2VA', 'Unknown'])
const provenance = new Set(['official-verbatim', 'creator-verbatim', 'external-archive-verbatim', 'not-published'])
const promptCompleteness = new Set(['complete'])
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
  for (const key of ['title', 'titleEn']) {
    if (genericEditorialCopyPattern(item[key])) errors.push(`${at}.${key} must keep account handles out of public titles`)
  }
  for (const key of ['summary', 'summaryEn']) {
    if (genericEditorialCopyPattern(item[key])) errors.push(`${at}.${key} must keep account handles in attribution fields`)
  }
  if (item.editorialBasis) {
    for (const error of editorialCopyErrors({
      title: item.title,
      titleEn: item.titleEn,
      summary: item.summary,
      summaryEn: item.summaryEn,
      basis: item.editorialBasis,
    })) errors.push(`${at}: ${error}`)
  }
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
    if (item.promptSourceUrl) errors.push(`${at}.promptSourceUrl is not allowed when promptProvenance is not-published`)
    if (item.promptCompleteness) errors.push(`${at}.promptCompleteness is not allowed when promptProvenance is not-published`)
  } else if (typeof item.prompt !== 'string' || item.prompt.trim().length === 0) {
    errors.push(`${at}.prompt must be a non-empty verbatim string for published prompt provenance`)
  } else if (item.promptCompleteness && !promptCompleteness.has(item.promptCompleteness)) {
    errors.push(`${at}.promptCompleteness is invalid`)
  }
  if (item.promptProvenance === 'external-archive-verbatim' && !item.archiveSourceUrl) errors.push(`${at}.archiveSourceUrl is required for external archive provenance`)
  if (item.promptSourceUrl) {
    try {
      const promptSource = new URL(item.promptSourceUrl)
      if (item.sourceType === 'x' && promptSource.hostname !== 'x.com') {
        errors.push(`${at}.promptSourceUrl must point to the original X source`)
      }
      if (item.sourceType === 'x' && !/^\/[^/]+\/status\/\d+$/.test(promptSource.pathname)) {
        errors.push(`${at}.promptSourceUrl must point to an X status`)
      }
    } catch {
      errors.push(`${at}.promptSourceUrl is invalid`)
    }
  }
  if (item.archiveSourceUrl) {
    try {
      const archiveSource = new URL(item.archiveSourceUrl)
      if (archiveSource.protocol !== 'https:') errors.push(`${at}.archiveSourceUrl must use HTTPS`)
    } catch {
      errors.push(`${at}.archiveSourceUrl is invalid`)
    }
  }
  if (item.sourceType === 'x' && !item.posterUrl?.startsWith('/posters/x/')) {
    errors.push(`${at}.posterUrl must use a case-specific X video cover`)
  }
  if (item.mediaUrl !== `/media/${item.id}.mp4`) {
    errors.push(`${at}.mediaUrl must point to its hosted case video`)
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
    new URL(item.mediaUrl, 'https://h3-field-notes-production.up.railway.app')
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

const tutorialIds = new Set()
const tutorialCodes = new Set()
const tutorialCategories = new Set([
  'mac',
  'official',
  'workflow',
  'acceleration',
  'long-video',
  'audio',
  'training',
  'resources',
])

for (const [index, item] of tutorials.entries()) {
  const at = `tutorials[${index}]`
  for (const key of ['id', 'code', 'category', 'title', 'url', 'verifiedAt']) {
    if (!item[key]) errors.push(`${at}.${key} is required`)
  }
  if (tutorialIds.has(item.id)) errors.push(`${at}.id is duplicated: ${item.id}`)
  if (tutorialCodes.has(item.code)) errors.push(`${at}.code is duplicated: ${item.code}`)
  tutorialIds.add(item.id)
  tutorialCodes.add(item.code)
  if (!tutorialCategories.has(item.category)) errors.push(`${at}.category is invalid: ${item.category}`)
  if (Number.isNaN(Date.parse(item.verifiedAt))) errors.push(`${at}.verifiedAt must be a valid date`)
  if (item.stars !== undefined && (!Number.isInteger(item.stars) || item.stars < 0)) errors.push(`${at}.stars must be a non-negative integer`)
  if (item.forks !== undefined && (!Number.isInteger(item.forks) || item.forks < 0)) errors.push(`${at}.forks must be a non-negative integer`)
  if (item.snapshotAt && Number.isNaN(Date.parse(item.snapshotAt))) errors.push(`${at}.snapshotAt must be a valid date`)
  if (item.pushedAt && Number.isNaN(Date.parse(item.pushedAt))) errors.push(`${at}.pushedAt must be a valid date`)
  try {
    new URL(item.url)
  } catch {
    errors.push(`${at}.url is invalid`)
  }
  for (const key of ['kind', 'description', 'audience', 'action']) {
    if (!item[key]?.zh || !item[key]?.en) errors.push(`${at}.${key} requires zh and en values`)
    if (/[\u3400-\u9fff]/u.test(item[key]?.en || '')) errors.push(`${at}.${key}.en must not contain CJK text`)
  }
  if (!Array.isArray(item.steps?.zh) || item.steps.zh.length < 2) errors.push(`${at}.steps.zh must contain at least two steps`)
  if (!Array.isArray(item.steps?.en) || item.steps.en.length < 2) errors.push(`${at}.steps.en must contain at least two steps`)
  if (item.steps?.en?.some((step) => /[\u3400-\u9fff]/u.test(step))) errors.push(`${at}.steps.en must not contain CJK text`)
  for (const key of ['facts', 'tags']) {
    if (!Array.isArray(item[key]) || item[key].length === 0) errors.push(`${at}.${key} must be a non-empty array`)
  }
}

const guideIds = new Set()
const guideSources = new Set()
const guideCategories = new Set(['getting-started', 'comfyui', 'prompt', 'acceleration', 'long-video', 'audio', 'training'])
const guideTypes = new Set(['foundation', 'community'])
const resourceIds = new Set(tutorials.map((item) => item.id))

for (const [index, item] of tutorialGuides.entries()) {
  const at = `tutorialGuides[${index}]`
  for (const key of ['id', 'contentType', 'category', 'posterUrl', 'source', 'verifiedAt']) {
    if (!item[key]) errors.push(`${at}.${key} is required`)
  }
  if (guideIds.has(item.id)) errors.push(`${at}.id is duplicated: ${item.id}`)
  guideIds.add(item.id)
  if (!guideTypes.has(item.contentType)) errors.push(`${at}.contentType is invalid`)
  if (!guideCategories.has(item.category)) errors.push(`${at}.category is invalid: ${item.category}`)
  if (Number.isNaN(Date.parse(item.verifiedAt))) errors.push(`${at}.verifiedAt must be a valid date`)
  for (const key of ['title', 'outcome', 'audience', 'hardware']) {
    if (!item[key]?.zh || !item[key]?.en) errors.push(`${at}.${key} requires zh and en values`)
    if (/[㐀-鿿]/u.test(item[key]?.en || '')) errors.push(`${at}.${key}.en must not contain CJK text`)
  }
  for (const key of ['prerequisites', 'steps', 'caveats']) {
    if (!Array.isArray(item[key]?.zh) || item[key].zh.length === 0) errors.push(`${at}.${key}.zh must be non-empty`)
    if (!Array.isArray(item[key]?.en) || item[key].en.length === 0) errors.push(`${at}.${key}.en must be non-empty`)
    if (item[key]?.en?.some((value) => /[㐀-鿿]/u.test(value))) errors.push(`${at}.${key}.en must not contain CJK text`)
  }
  if (item.checks) {
    if (!Array.isArray(item.checks.zh) || item.checks.zh.length === 0) errors.push(`${at}.checks.zh must be non-empty`)
    if (!Array.isArray(item.checks.en) || item.checks.en.length === 0) errors.push(`${at}.checks.en must be non-empty`)
    if (item.checks.en?.some((value) => /[㐀-鿿]/u.test(value))) errors.push(`${at}.checks.en must not contain CJK text`)
  }
  for (const key of ['commands', 'tags', 'relatedResourceIds']) {
    if (!Array.isArray(item[key])) errors.push(`${at}.${key} must be an array`)
  }
  for (const resourceId of item.relatedResourceIds || []) {
    if (!resourceIds.has(resourceId)) errors.push(`${at}.relatedResourceIds contains unknown resource: ${resourceId}`)
  }
  if (!['docs', 'github', 'x'].includes(item.source?.platform)) errors.push(`${at}.source.platform is invalid`)
  if (!item.source?.author || !item.source?.originalLanguage) errors.push(`${at}.source requires author and originalLanguage`)
  try {
    const sourceUrl = new URL(item.source.url)
    if (sourceUrl.protocol !== 'https:') errors.push(`${at}.source.url must use HTTPS`)
    if (item.contentType === 'community' && !/^\/[^/]+\/status\/\d+$/.test(sourceUrl.pathname)) {
      errors.push(`${at}.source.url must point to an original X status`)
    }
  } catch {
    errors.push(`${at}.source.url is invalid`)
  }
  if (item.contentType === 'community' && guideSources.has(item.source?.url)) errors.push(`${at}.source.url is duplicated: ${item.source?.url}`)
  if (item.contentType === 'community') guideSources.add(item.source?.url)
  if (item.contentType === 'community' && !item.source.publishedAt) errors.push(`${at}.source.publishedAt is required for community guides`)
  if (item.source?.publishedAt && Number.isNaN(Date.parse(item.source.publishedAt))) errors.push(`${at}.source.publishedAt must be a valid date`)
  if (item.engagement) {
    for (const key of ['replies', 'reposts', 'likes', 'views']) {
      if (item.engagement[key] !== undefined && (!Number.isFinite(item.engagement[key]) || item.engagement[key] < 0)) {
        errors.push(`${at}.engagement.${key} must be a non-negative number when present`)
      }
    }
    if (Number.isNaN(Date.parse(item.engagement.snapshotAt))) errors.push(`${at}.engagement.snapshotAt must be a valid date`)
  }
  if (item.flagship) {
    for (const key of ['difficulty', 'estimatedMinutes', 'hardwareProfiles', 'testedVersions', 'expectedResult', 'troubleshooting', 'uninstall', 'sourceRefs']) {
      if (!item[key] || (Array.isArray(item[key]) && item[key].length === 0)) errors.push(`${at}.${key} is required for flagship guides`)
    }
    if (item.commands.length === 0) errors.push(`${at}.commands must be non-empty for flagship guides`)
    if (!item.checks?.zh?.length || !item.checks?.en?.length) errors.push(`${at}.checks is required for flagship guides`)
  }
  if (item.expectedResult && (!item.expectedResult.zh || !item.expectedResult.en)) errors.push(`${at}.expectedResult requires zh and en values`)
  for (const issue of item.troubleshooting || []) {
    if (!issue.problem?.zh || !issue.problem?.en || !issue.solution?.zh || !issue.solution?.en) errors.push(`${at}.troubleshooting items require bilingual problem and solution`)
  }
  for (const reference of item.sourceRefs || []) {
    try { new URL(reference.url) } catch { errors.push(`${at}.sourceRefs contains an invalid URL`) }
  }
  if (item.posterUrl?.startsWith('/')) {
    try {
      await access(resolve(root, 'public', item.posterUrl.slice(1)))
    } catch {
      errors.push(`${at}.posterUrl does not exist: ${item.posterUrl}`)
    }
  }
}

const foundationCount = tutorialGuides.filter((item) => item.contentType === 'foundation').length
const communityCount = tutorialGuides.filter((item) => item.contentType === 'community').length
if (foundationCount !== 4) errors.push(`tutorialGuides must contain exactly 4 foundation routes; found ${foundationCount}`)
if (communityCount < 20) errors.push(`tutorialGuides must contain at least 20 community guides; found ${communityCount}`)
const flagshipCount = tutorialGuides.filter((item) => item.flagship).length
if (flagshipCount !== 8) errors.push(`tutorialGuides must contain exactly 8 flagship guides; found ${flagshipCount}`)

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Validated ${cases.length} cases, ${tutorials.length} resources, and ${tutorialGuides.length} tutorial guides.`)
