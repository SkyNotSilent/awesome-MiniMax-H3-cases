import tutorialSchema from '../data/tutorial-schema.json' with { type: 'json' }

export { tutorialSchema }

export function tutorialSourceKey(source) {
  try {
    const url = new URL(source.url)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let path = url.pathname.replace(/\/+$/, '')
    if (source.platform === 'x' && ['x.com', 'twitter.com'].includes(host)) {
      const id = path.match(/^\/[^/]+\/status\/(\d+)$/)?.[1]
      return id ? `x:${id}` : null
    }
    if (source.platform === 'youtube' && ['youtube.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? path.slice(1) : path === '/watch' ? url.searchParams.get('v') : path.match(/^\/shorts\/([^/]+)$/)?.[1]
      return /^[\w-]{11}$/.test(id ?? '') ? `youtube:${id}` : null
    }
    if (source.platform === 'reddit' && ['reddit.com', 'old.reddit.com'].includes(host)) {
      const id = path.match(/^\/r\/[^/]+\/comments\/([a-z0-9]+)(?:\/|$)/i)?.[1]
      return id ? `reddit:${id.toLowerCase()}` : null
    }
    if (source.platform === 'github' && host !== 'github.com') return null
    if (source.platform === 'huggingface' && host !== 'huggingface.co') return null
    if (!['docs', 'github', 'huggingface'].includes(source.platform)) return null
    if (source.platform === 'github') path = path.split('/').map((part, index) => index < 3 ? part.toLowerCase() : part).join('/')
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key)
    url.searchParams.sort()
    return `${source.platform}:${host}${path}${url.search}${url.hash}`
  } catch { return null }
}

function definition(schema) {
  return schema.$ref ? tutorialSchema.$defs[schema.$ref.split('/').at(-1)] : schema
}

// Project all nested objects through the public schema. Review fields never cross this boundary.
export function projectTutorial(value, schema = tutorialSchema) {
  schema = definition(schema)
  if (schema.type === 'object' && value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(schema.properties).filter(([key]) => value[key] !== undefined)
      .map(([key, child]) => [key, projectTutorial(value[key], child)]))
  }
  if (schema.type === 'array' && Array.isArray(value)) return value.map(item => projectTutorial(item, schema.items))
  return value
}

export function tutorialContractErrors(value) {
  const errors = []
  function visit(item, rule, path) {
    rule = definition(rule)
    if (rule.type === 'object') {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`${path}: object required`); return }
      for (const key of rule.required ?? []) if (item[key] === undefined) errors.push(`${path}.${key}: required`)
      for (const [key, child] of Object.entries(item)) {
        if (rule.properties[key]) visit(child, rule.properties[key], `${path}.${key}`)
        else if (rule.additionalProperties === false) errors.push(`${path}.${key}: not public`)
      }
    } else if (rule.type === 'array') {
      if (!Array.isArray(item)) { errors.push(`${path}: array required`); return }
      if (rule.minItems && item.length < rule.minItems) errors.push(`${path}: too few items`)
      if (rule.uniqueItems && new Set(item.map(x => JSON.stringify(x))).size !== item.length) errors.push(`${path}: duplicates`)
      item.forEach((child, index) => visit(child, rule.items, `${path}[${index}]`))
    } else if (rule.type === 'string') {
      if (typeof item !== 'string' || !item.trim()) { errors.push(`${path}: text required`); return }
      if (rule.pattern && !new RegExp(rule.pattern).test(item)) errors.push(`${path}: invalid format`)
      if (rule.format === 'uri') { try { const u = new URL(item); if (u.protocol !== 'https:' || u.username || u.password) throw Error() } catch { errors.push(`${path}: HTTPS URL required`) } }
      if (['date', 'date-time'].includes(rule.format) && (!/^\d{4}-\d{2}-\d{2}/.test(item) || Number.isNaN(Date.parse(item)))) errors.push(`${path}: invalid date`)
    } else if (rule.type === 'integer' && (!Number.isSafeInteger(item) || item < (rule.minimum ?? -Infinity))) errors.push(`${path}: invalid integer`)
    else if (rule.type === 'boolean' && typeof item !== 'boolean') errors.push(`${path}: boolean required`)
    if (rule.enum && !rule.enum.includes(item)) errors.push(`${path}: invalid value`)
  }
  visit(value, tutorialSchema, 'tutorial')
  if (!tutorialSourceKey(value?.source ?? {})) errors.push('tutorial.source: platform and URL must match')
  if (['x', 'youtube', 'reddit'].includes(value?.source?.platform) && !value.source.publishedAt) errors.push('tutorial.source.publishedAt: required')
  if (value?.depth === 'deep') {
    for (const field of ['recommendation', 'cost', 'applicableVersions', 'learningResources', 'checks', 'expectedResult', 'troubleshooting']) {
      if (!value[field] || (Array.isArray(value[field]) && !value[field].length)) errors.push(`tutorial.${field}: required for deep guide`)
    }
    if (!value.evidence?.sourceCheckedAt || !value.evidence?.basis) errors.push('tutorial.evidence: checked source and basis required for deep guide')
    if ((value.steps?.zh?.length ?? 0) < 4 || (value.steps?.en?.length ?? 0) < 4) errors.push('tutorial.steps: deep guides need actionable steps')
  }
  if (value?.evidence?.siteTestedAt && !value.evidence.siteTestUrl) errors.push('tutorial.evidence.siteTestUrl: required for site test claim')
  if (value?.evidence?.communityReviewedAt && !value.communityFeedback?.length) errors.push('tutorial.communityFeedback: required for community review claim')
  for (const chapter of Array.isArray(value?.chapters) ? value.chapters : []) {
    if (!tutorialSourceKey({ platform: 'youtube', url: chapter.url })) errors.push('tutorial.chapters: valid YouTube URL required')
    try { if (Number(new URL(chapter.url).searchParams.get('t')) !== chapter.seconds) errors.push('tutorial.chapters: timestamp mismatch') } catch { /* URL validation above reports malformed links. */ }
  }
  return errors
}
