import { completeQuota, fetchWithReviewRetry, newRunId, reserveQuota } from './review-runtime.mjs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { sanitizeCandidateClassification, taxonomyClassifierPrompt } from './candidate-taxonomy.mjs'
import { candidatesPath, root, mergeReviewedRows, rowVersion } from './review-paths.mjs'

const config = JSON.parse(await readFile(resolve(root, 'config/model-routing.json'), 'utf8'))
const candidates = JSON.parse(await readFile(candidatesPath, 'utf8'))
const inputVersion = item => rowVersion({ text: item.text, visiblePrompt: item.visiblePrompt, author: item.author, sourceUrl: item.sourceUrl })
const pending = candidates
  .filter((item) => item.reviewStatus === 'pending' && (!item.classification || item.classificationInputVersion !== inputVersion(item)))
  .slice(0, config.dailyLimits.maxTextCandidates)

if (!pending.length) {
  console.log('No unclassified candidates.')
  process.exit(0)
}
if (!process.env.MIMO_API_KEY) {
  throw new Error('Missing MIMO_API_KEY.')
}

const baseUrl = (process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1').replace(/\/$/, '')
const authScheme = (process.env.MIMO_AUTH_SCHEME || 'bearer').toLowerCase()
const headers = {
  'Content-Type': 'application/json',
  ...(authScheme === 'api-key'
    ? { 'api-key': process.env.MIMO_API_KEY }
    : { Authorization: `Bearer ${process.env.MIMO_API_KEY}` }),
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function trustedVisiblePrompt(candidate) {
  return nonEmptyString(candidate.visiblePrompt)
}

function sanitizeClassification(candidate, raw) {
  const prompt = trustedVisiblePrompt(candidate)
  const taxonomy = sanitizeCandidateClassification(raw)
  const invalidValues = [
    ...taxonomy.invalidValues,
    ...(taxonomy.category ? [] : ['category:<missing>']),
  ]
  return {
    classification: {
      id: candidate.id,
      isH3Case: raw.isH3Case,
      confidence: raw.confidence,
      mode: raw.mode,
      category: taxonomy.category,
      styles: taxonomy.styles,
      scenes: taxonomy.scenes,
      styleBasis: taxonomy.styleBasis,
      sceneBasis: taxonomy.sceneBasis,
      inputTypes: raw.inputTypes,
      prompt,
      promptProvenance: prompt ? 'creator-verbatim' : 'not-published',
      reason: raw.reason,
    },
    invalidValues,
  }
}

const batchSize = config.textExtraction.batchSize ?? 5
const runId = process.env.REVIEW_RUN_ID || newRunId()
const deadline = process.env.REVIEW_DEADLINE_AT ? Date.parse(process.env.REVIEW_DEADLINE_AT) : Date.now() + 15 * 60000
let returnedItems = 0
let invalidItems = 0
async function classifyBatch(batch, canSplit = true) {
  const classifications = new Map()
  const classificationErrors = new Map()
  const byId = new Map(batch.map((item) => [item.id, item]))
  const response = await fetchWithReviewRetry(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: process.env.MIMO_TEXT_MODEL || config.textExtraction.model,
      thinking: { type: config.textExtraction.thinking },
      max_tokens: config.textExtraction.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Classify public posts about MiniMax H3 video examples. Return JSON only as {"items":[...]}.',
            'Each item must include id, isH3Case, confidence (0-1), mode (T2VA|FL2VA|Ref2VA|unknown), category, styles, scenes, styleBasis, sceneBasis, inputTypes, and reason (max 30 Chinese chars).',
            taxonomyClassifierPrompt(),
            'Do not output prompt text or prompt provenance.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(batch.map((item) => ({
            id: item.id,
            text: item.text,
            visiblePrompt: trustedVisiblePrompt(item),
            author: item.author,
            sourceUrl: item.sourceUrl,
          }))),
        },
      ],
    }),
  }, { deadline, reserve: () => reserveQuota({ kind: 'text', units: batch.length, limit: config.dailyLimits.maxTextCandidates, runId }), complete: reservation => completeQuota(reservation) })
  const payload = await response.json()
  if (payload.choices?.[0]?.finish_reason === 'length') {
    if (!canSplit || batch.length < 2) throw new Error('Classifier output truncated; batch remains pending')
    const middle = Math.ceil(batch.length / 2)
    await classifyBatch(batch.slice(0, middle), false)
    await classifyBatch(batch.slice(middle), false)
    return
  }
  if (payload.choices?.[0]?.finish_reason !== 'stop') throw new Error('Classifier did not finish normally')
  const parsed = JSON.parse(payload.choices[0].message.content)
  if (!Array.isArray(parsed.items) || parsed.items.length !== batch.length || new Set(parsed.items.map(x => x.id)).size !== batch.length || parsed.items.some(x => !byId.has(x.id))) throw new Error('Classifier IDs do not cover the batch exactly')
  for (const raw of parsed.items ?? []) {
    const candidate = byId.get(raw.id)
    if (!candidate) continue
    returnedItems += 1
    const result = sanitizeClassification(candidate, raw)
    if (result.invalidValues.length) {
      invalidItems += 1
      classificationErrors.set(raw.id, {
        code: 'taxonomy-outside-vocabulary',
        invalidValues: result.invalidValues,
        checkedAt: new Date().toISOString(),
      })
      continue
    }
    classifications.set(raw.id, result.classification)
  }

  const invalidRate = returnedItems ? invalidItems / returnedItems : 0
  const merged = batch.map((item) =>
    classifications.has(item.id)
      ? { ...item, classification: classifications.get(item.id), classificationInputVersion: inputVersion(item), classifiedBy: config.textExtraction.model }
      : classificationErrors.has(item.id)
        ? { ...item, classificationError: classificationErrors.get(item.id) }
      : item,
  )
  await mergeReviewedRows(candidatesPath, batch, merged)
  if (invalidRate > 0.2) {
    throw new Error(`Taxonomy classifier regression: ${invalidItems}/${returnedItems} responses contained invalid values (${Math.round(invalidRate * 100)}%).`)
  }

}

for (let offset = 0; offset < pending.length; offset += batchSize) await classifyBatch(pending.slice(offset, offset + batchSize))
const invalidRate = returnedItems ? invalidItems / returnedItems : 0
console.log(`Classified ${returnedItems - invalidItems} candidates with ${config.textExtraction.model}; rejected ${invalidItems} invalid taxonomy responses (${Math.round(invalidRate * 100)}%).`)
