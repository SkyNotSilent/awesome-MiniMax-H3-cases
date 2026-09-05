import taxonomyData from '../data/taxonomy.json' with { type: 'json' }

export const taxonomy = taxonomyData

const entryMaps = Object.fromEntries(
  ['categories', 'styles', 'scenes'].map((kind) => [
    kind,
    new Map(taxonomy[kind].map((entry) => [entry.key, entry])),
  ]),
)

export function taxonomyKeys(kind) {
  return taxonomy[kind].map((entry) => entry.key)
}

export function taxonomyLabel(value, language, kind) {
  if (value === 'ALL') return language === 'zh' ? '全部' : 'All'
  const entry = entryMaps[kind]?.get(value)
  return entry?.[language] ?? value
}

export function sanitizeTaxonomyClassification(raw = {}) {
  const invalidValues = []
  const category = entryMaps.categories.has(raw.category) ? raw.category : null
  if (raw.category && !category) invalidValues.push(`category:${raw.category}`)

  const sanitizeMany = (kind) => {
    const result = []
    for (const value of Array.isArray(raw[kind]) ? raw[kind] : []) {
      if (!entryMaps[kind].has(value)) {
        invalidValues.push(`${kind}:${value}`)
        continue
      }
      if (!result.includes(value) && result.length < 2) result.push(value)
    }
    return result
  }

  return {
    category,
    styles: sanitizeMany('styles'),
    scenes: sanitizeMany('scenes'),
    invalidValues,
  }
}

export function assertTaxonomyClassification(raw, context = 'classification') {
  const sanitized = sanitizeTaxonomyClassification(raw)
  if (!sanitized.category) throw new Error(`${context}.category is outside data/taxonomy.json`)
  if (sanitized.invalidValues.length) {
    throw new Error(`${context} contains values outside data/taxonomy.json: ${sanitized.invalidValues.join(', ')}`)
  }
  return sanitized
}
