import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { sanitizeCandidateClassification, taxonomyClassifierPrompt } from './candidate-taxonomy.mjs'
import { candidatesPath, root } from './review-paths.mjs'

const config = JSON.parse(await readFile(resolve(root, 'config/model-routing.json'), 'utf8'))
const candidates = JSON.parse(await readFile(candidatesPath, 'utf8'))
const pending = candidates
  .filter((item) => item.reviewStatus === 'pending' && !item.classification)
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

const batchSize = 20
const classifications = new Map()
const classificationErrors = new Map()
let returnedItems = 0
let invalidItems = 0
for (let offset = 0; offset < pending.length; offset += batchSize) {
  const batch = pending.slice(offset, offset + batchSize)
  const byId = new Map(batch.map((item) => [item.id, item]))
  const response = await fetch(`${baseUrl}/chat/completions`, {
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
  })
  if (!response.ok) throw new Error(`MiMo ${response.status}: ${await response.text()}`)
  const payload = await response.json()
  const parsed = JSON.parse(payload.choices[0].message.content)
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
}

const invalidRate = returnedItems ? invalidItems / returnedItems : 0
if (invalidRate > 0.2) {
  throw new Error(`Taxonomy classifier regression: ${invalidItems}/${returnedItems} responses contained invalid values (${Math.round(invalidRate * 100)}%).`)
}

const merged = candidates.map((item) =>
  classifications.has(item.id)
    ? { ...item, classification: classifications.get(item.id), classifiedBy: config.textExtraction.model }
    : classificationErrors.has(item.id)
      ? { ...item, classificationError: classificationErrors.get(item.id) }
    : item,
)
await writeFile(candidatesPath, `${JSON.stringify(merged, null, 2)}\n`)
console.log(`Classified ${classifications.size} candidates with ${config.textExtraction.model}; rejected ${invalidItems} invalid taxonomy responses (${Math.round(invalidRate * 100)}%).`)
