import { expect, it } from 'vitest'
import { hasExplicitFilters, parseFilters, writeFilters } from './filter-state.mjs'
const taxonomy = { categories: [{ key: 'comparison' }], styles: [{ key: 'anime' }], scenes: [{ key: 'city' }] }
it('round-trips combined filters, unicode search and a fixed update window', () => {
  const params = new URLSearchParams({ category: 'comparison', style: 'anime', scene: 'city', q: '科幻 & camera', duration: 'OVER_15', collection: 'favorites', prompt: '1', added: 'unseen', since: '2026-08-01T00:00:00Z', through: '2026-09-01T00:00:00Z' })
  const state = parseFilters(params, taxonomy), url = new URL('https://example.invalid/')
  writeFilters(url, state)
  expect(parseFilters(url.searchParams, taxonomy)).toEqual(state)
})
it('recognizes invalid explicit navigation before normalization and keeps explicit all time', () => {
  const params = new URLSearchParams('category=unknown')
  expect(hasExplicitFilters(params)).toBe(true)
  expect(parseFilters(params, taxonomy).category).toBe('ALL')
  const url = new URL('https://example.invalid/?added=all')
  writeFilters(url, parseFilters(url.searchParams, taxonomy))
  expect(url.searchParams.get('added')).toBe('all')
})
