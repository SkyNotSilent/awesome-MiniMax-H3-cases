import { resolve } from 'node:path'
import { readCatalogSnapshot } from './catalog-snapshot.mjs'
import { describe, expect, it } from 'vitest'
import { catalogSummary, createCatalogIndex, queryCatalog } from '../shared/catalog-query.mjs'
import { parseFilters } from '../shared/filter-state.mjs'
const data = await readCatalogSnapshot(resolve(process.cwd(), 'build/server-data/catalog.ndjson'))
const index = createCatalogIndex(data)
function reference(params, omit, favorites) {
  const f = parseFilters(params, data.taxonomy)
  const ordered = [...data.cases].sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt) || a.id.localeCompare(b.id))
  const latest = ordered.slice(0, 48).map(x => x.id)
  const cases = ordered.filter(item => {
    if (omit !== 'category' && f.category !== 'ALL' && item.category !== f.category) return false
    if (omit !== 'style' && f.style !== 'ALL' && !item.styles.includes(f.style)) return false
    if (omit !== 'scene' && f.scene !== 'ALL' && !item.scenes.includes(f.scene)) return false
    if (f.prompt && !item.hasPrompt) return false
    if (!item.search[params.get('language') ?? 'zh'].includes(f.q.trim().toLowerCase())) return false
    const durations = { ALL: true, UP_TO_5: item.duration <= 5, SIX_TO_10: item.duration > 5 && item.duration <= 10, ELEVEN_TO_15: item.duration > 10 && item.duration <= 15, OVER_15: item.duration > 15 }
    if (!durations[f.duration]) return false
    const collections = { all: true, featured: data.featuredCaseIds.includes(item.id), latest: latest.includes(item.id), prompt: item.hasPrompt, official: item.sourceType === 'official', long: item.duration > 15, favorites: favorites.includes(item.id) }
    return collections[f.collection]
  })
  return f.collection === 'featured' ? cases.sort((a, b) => data.featuredCaseIds.indexOf(a.id) - data.featuredCaseIds.indexOf(b.id)) : cases
}
describe('full catalog query parity', () => {
  it('matches independent full-list filtering, order, and all facet counts for 200 seeded combinations', () => {
    let seed = 6271
    const pick = values => values[(seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % values.length]
    const favorites = data.cases.filter((_, i) => i % 7 === 0).map(x => x.id)
    for (let i = 0; i < 200; i++) {
      const params = new URLSearchParams({
        language: pick(['zh', 'en']), category: pick(['ALL', 'ALL', ...data.taxonomy.categories.map(x => x.key)]),
        style: pick(['ALL', 'ALL', ...data.taxonomy.styles.map(x => x.key)]), scene: pick(['ALL', 'ALL', ...data.taxonomy.scenes.map(x => x.key)]),
        duration: pick(['ALL', 'UP_TO_5', 'SIX_TO_10', 'ELEVEN_TO_15', 'OVER_15']), collection: pick(['all', 'official', 'featured', 'latest', 'long', 'prompt', 'favorites']),
        prompt: pick(['0', '1']), q: pick(['', '', 'H3', '电影', '科幻太空', 'camera']),
      })
      const page = queryCatalog(index, params, favorites)
      const expected = reference(params, null, favorites)
      expect(page.total).toBe(expected.length)
      const ids = page.cases.map(x => x.id)
      let cursor = page.nextCursor
      while (cursor) {
        params.set('cursor', cursor); params.set('limit', '24')
        const next = queryCatalog(index, params, favorites)
        ids.push(...next.cases.map(x => x.id)); cursor = next.nextCursor
      }
      expect(ids).toEqual(expected.map(x => x.id))
      for (const [facet, field] of [['category', 'categories'], ['style', 'styles'], ['scene', 'scenes']]) {
        const eligible = reference(params, facet, favorites)
        expect(page.facets[facet].ALL).toBe(eligible.length)
        for (const { key } of data.taxonomy[field]) expect(page.facets[facet][key]).toBe(eligible.filter(item => facet === 'category' ? item.category === key : item[facet === 'style' ? 'styles' : 'scenes'].includes(key)).length)
      }
    }
  })
  it('searches localized labels and published Prompt text beyond the first page', () => {
    const scene = data.taxonomy.scenes.find(x => x.zh === '科幻太空')
    expect(queryCatalog(index, new URLSearchParams({ q: scene.zh })).total).toBeGreaterThanOrEqual(data.cases.filter(x => x.scenes.includes(scene.key)).length)
    const item = data.cases.find(x => x.hasPrompt && x.search.en.length > 800)
    const needle = item.search.en.slice(-150, -70)
    expect(queryCatalog(index, new URLSearchParams({ q: needle, language: 'en' })).cases.map(x => x.id)).toContain(item.id)
  })
  it('uses exclusive since and inclusive through independent of server time zone', () => {
    const date = data.cases[0].addedAt
    const params = new URLSearchParams({ added: 'release', since: date, through: date })
    expect(queryCatalog(index, params).total).toBe(0)
    params.set('since', new Date(Date.parse(date) - 1).toISOString())
    expect(queryCatalog(index, params).total).toBe(data.cases.filter(x => x.addedAt === date).length)
  })
})

it('summarizes the latest Asia/Shanghai release day of each channel', () => {
  const summary = catalogSummary(index).summary
  const releaseDay = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  const latestCaseDay = releaseDay(summary.maxima.cases)
  expect(summary.counts.cases).toBe(data.cases.filter(x => releaseDay(x.addedAt) === latestCaseDay).length)
  expect(summary.counts.cases).toBeGreaterThan(0)
  const latestTutorialDay = releaseDay(summary.maxima.tutorials)
  expect(summary.counts.tutorials).toBe(data.tutorials.filter(x => releaseDay(x.addedAt) === latestTutorialDay).length)
  expect(summary.totals).toEqual({ cases: data.cases.length, tutorials: data.tutorials.length })
  expect(queryCatalog(index, new URLSearchParams({ added: 'release' })).total).toBe(summary.counts.cases)
  expect(() => queryCatalog(index, new URLSearchParams({ added: 'release', since: summary.maxima.cases }))).toThrow('Invalid time boundary')
  expect(() => createCatalogIndex({ ...data, tutorials: [{ id: 'broken', addedAt: 'nope' }] })).toThrow('Invalid catalog record')
})

it('paginates a synthetic prolific creator without duplicates or missing membership', () => {
  const prolific = { ...data, creators: [{ slug: 'fixture-creator', caseIds: data.cases.slice(0, 100).map(x => x.id) }] }
  const fixture = createCatalogIndex(prolific)
  const params = new URLSearchParams({ creator: 'fixture-creator' })
  let page = queryCatalog(fixture, params)
  expect(page.total).toBe(100)
  expect(page.cases.length).toBe(36)
  const ids = page.cases.map(x => x.id)
  while (page.nextCursor) {
    params.set('cursor', page.nextCursor); params.set('limit', '24')
    page = queryCatalog(fixture, params)
    ids.push(...page.cases.map(x => x.id))
  }
  expect(new Set(ids)).toEqual(new Set(prolific.creators[0].caseIds))
  expect(ids.length).toBe(100)
})
