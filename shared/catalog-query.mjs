import { parseFilters } from './filter-state.mjs'

export class CatalogQueryError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
const normalize = values => values.filter(value => typeof value === 'string' && value.trim()).join(' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
export function searchText(item, language, taxonomy) {
  const labels = [
    taxonomy.categories.find(x => x.key === item.category),
    ...item.styles.map(key => taxonomy.styles.find(x => x.key === key)),
    ...item.scenes.map(key => taxonomy.scenes.find(x => x.key === key)),
  ].filter(Boolean).map(x => x[language])
  return normalize([...(language === 'zh' ? [item.title, item.summary, item.sourceLabel, ...item.tags] : [item.titleEn, item.summaryEn]), item.prompt, item.author, item.category, ...item.styles, ...item.scenes, ...labels])
}
export function createCatalogIndex(data) {
  if (data.version !== 1 || !data.catalogVersion || !Array.isArray(data.cases) || !Array.isArray(data.tutorials)) throw new Error('Invalid catalog snapshot')
  const ids = new Set()
  const records = data.cases.map(item => {
    if (ids.has(item.id) || !Number.isFinite(Date.parse(item.addedAt)) || !item.search?.zh || !item.search?.en) throw new Error('Invalid catalog record')
    ids.add(item.id)
    return { item, time: Date.parse(item.addedAt) }
  }).sort((a, b) => b.time - a.time || a.item.id.localeCompare(b.item.id))
  return { data, records, featured: new Map(data.featuredCaseIds.map((id, i) => [id, i])), latest: new Set(records.slice(0, 48).map(x => x.item.id)), creators: new Map(data.creators.map(x => [x.slug, new Set(x.caseIds)])) }
}
function timestamp(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new CatalogQueryError('Invalid time boundary')
  return time
}
export function catalogSummary(index, params = new URLSearchParams()) {
  const { data, records } = index
  const maximum = channel => Math.max(0, ...(channel === 'cases' ? records.map(x => x.time) : data.tutorials.map(x => Date.parse(x.addedAt))))
  const maxima = { cases: new Date(maximum('cases')).toISOString(), tutorials: new Date(maximum('tutorials')).toISOString() }
  const counts = {}
  for (const channel of ['cases', 'tutorials']) {
    const times = channel === 'cases' ? records.map(x => x.time) : data.tutorials.map(x => Date.parse(x.addedAt))
    const max = Date.parse(maxima[channel])
    const since = Math.min(timestamp(params.get(`${channel}Since`), max), max)
    const through = Math.min(timestamp(params.get(`${channel}Through`), max), max)
    counts[channel] = times.filter(time => time > since && time <= through).length
  }
  return { version: 1, catalogVersion: data.catalogVersion, generatedAt: maxima.cases > maxima.tutorials ? maxima.cases : maxima.tutorials, featuredCaseIds: data.featuredCaseIds, cases: [], tutorials: [], summary: { maxima, counts, totals: { cases: records.length, tutorials: data.tutorials.length } } }
}
function fingerprint(value) {
  // Cursor scope only, not an authentication or integrity primitive.
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16)
}
export function queryCatalog(index, params = new URLSearchParams(), favorites = []) {
  if (params.toString().length > 4096 || (params.get('q')?.length ?? 0) > 300) throw new CatalogQueryError('Query too long')
  if (!Array.isArray(favorites) || favorites.length > 10000 || favorites.some(id => typeof id !== 'string' || !/^[\w.-]{1,160}$/.test(id))) throw new CatalogQueryError('Invalid favorite IDs')
  const filters = parseFilters(params, index.data.taxonomy)
  const limit = Number(params.get('limit') ?? 36)
  if (!Number.isInteger(limit) || limit < 1 || limit > 36) throw new CatalogQueryError('Page size must be between 1 and 36')
  const language = params.get('language') === 'en' ? 'en' : 'zh'
  const from = timestamp(params.get('from'), -Infinity), through = timestamp(params.get('to'), Infinity)
  const since = timestamp(filters.since, NaN), until = timestamp(filters.through, NaN)
  const favoriteIds = new Set(favorites)
  const creator = params.get('creator')
  if (creator && (!/^[\w.-]{1,160}$/.test(creator) || !index.creators.has(creator))) throw new CatalogQueryError('Unknown creator', 404)
  const creatorIds = creator ? index.creators.get(creator) : null
  const needle = filters.q.trim().toLocaleLowerCase()
  const facets = Object.fromEntries([['category', 'categories'], ['style', 'styles'], ['scene', 'scenes']].map(([key, field]) => [key, Object.fromEntries(['ALL', ...index.data.taxonomy[field].map(x => x.key)].map(key => [key, 0]))]))
  const matching = []
  for (const { item, time } of index.records) {
    if (creatorIds && !creatorIds.has(item.id)) continue
    if (needle && !item.search[language].includes(needle)) continue
    if (filters.prompt && !item.hasPrompt) continue
    if (filters.added === 'unseen' ? !(time > since && time <= until) : filters.added !== 'all' && !(time >= from && time <= through)) continue
    const duration = filters.duration
    if (duration === 'UP_TO_5' && item.duration > 5 || duration === 'SIX_TO_10' && !(item.duration > 5 && item.duration <= 10) || duration === 'ELEVEN_TO_15' && !(item.duration > 10 && item.duration <= 15) || duration === 'OVER_15' && item.duration <= 15) continue
    const collection = filters.collection
    if (collection === 'featured' && !index.featured.has(item.id) || collection === 'latest' && !index.latest.has(item.id) || collection === 'official' && item.sourceType !== 'official' || collection === 'favorites' && !favoriteIds.has(item.id)) continue
    const category = filters.category === 'ALL' || filters.category === item.category
    const style = filters.style === 'ALL' || item.styles.includes(filters.style)
    const scene = filters.scene === 'ALL' || item.scenes.includes(filters.scene)
    if (style && scene) { facets.category.ALL++; facets.category[item.category]++ }
    if (category && scene) { facets.style.ALL++; for (const key of item.styles) facets.style[key]++ }
    if (category && style) { facets.scene.ALL++; for (const key of item.scenes) facets.scene[key]++ }
    if (category && style && scene) matching.push(item)
  }
  if (filters.collection === 'featured') matching.sort((a, b) => index.featured.get(a.id) - index.featured.get(b.id))
  const scope = fingerprint(JSON.stringify([filters, language, from, through, creator, [...favoriteIds].sort()]))
  let offset = 0
  if (params.has('cursor')) {
    let cursor
    try { cursor = JSON.parse(atob(params.get('cursor'))) } catch { throw new CatalogQueryError('Invalid cursor') }
    if (cursor.v !== index.data.catalogVersion) throw new CatalogQueryError('Catalog changed; restart pagination', 409)
    if (cursor.q !== scope || !Number.isInteger(cursor.offset) || cursor.offset < 0 || cursor.offset > matching.length) throw new CatalogQueryError('Cursor does not match query')
    offset = cursor.offset
  }
  const next = offset + limit
  return {
    catalogVersion: index.data.catalogVersion, total: matching.length, facets,
    favoriteCount: index.records.reduce((sum, { item }) => sum + Number(favoriteIds.has(item.id)), 0),
    cases: matching.slice(offset, next).map(item => {
      const card = Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'search'))
      return { ...card, isFeatured: index.featured.has(item.id) }
    }),
    nextCursor: next < matching.length ? btoa(JSON.stringify({ v: index.data.catalogVersion, q: scope, offset: next })) : null,
  }
}
