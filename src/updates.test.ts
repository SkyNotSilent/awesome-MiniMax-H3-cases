import { describe, expect, it } from 'vitest'
import {
  addedDatePresets,
  addedDateHref,
  formatAddedDate,
  matchesAddedDate,
  maxAddedAt,
  parseAddedDatePreset,
  sortByAddedAtDescending,
} from './updates'

describe('added-date filtering', () => {
  const now = new Date(2026, 7, 23, 12, 0, 0)
  const localIso = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour).toISOString()

  it('uses local calendar boundaries for seven days and thirty days', () => {
    expect(matchesAddedDate(localIso(2026, 8, 17), '7d', { now })).toBe(true)
    expect(matchesAddedDate(localIso(2026, 8, 16, 23), '7d', { now })).toBe(false)
    expect(matchesAddedDate(localIso(2026, 7, 25), '30d', { now })).toBe(true)
    expect(matchesAddedDate(localIso(2026, 7, 24, 23), '30d', { now })).toBe(false)
  })

  it('bounds release items strictly between since and through', () => {
    const since = localIso(2026, 8, 20)
    const through = localIso(2026, 8, 22)
    expect(matchesAddedDate(localIso(2026, 8, 21), 'release', { since, through })).toBe(true)
    expect(matchesAddedDate(since, 'release', { since, through })).toBe(false)
    expect(matchesAddedDate(through, 'release', { since, through })).toBe(true)
    expect(matchesAddedDate(localIso(2026, 8, 23), 'release', { since, through })).toBe(false)
    expect(matchesAddedDate(localIso(2026, 8, 21), 'release', { since: null, through })).toBe(false)
    expect(matchesAddedDate('broken', 'all')).toBe(false)
  })

  it('normalizes valid URL state and maps retired presets onto the latest release', () => {
    expect(addedDatePresets).toEqual(['all', 'release', '7d', '30d'])
    expect(parseAddedDatePreset('7d')).toBe('7d')
    expect(parseAddedDatePreset('release')).toBe('release')
    expect(parseAddedDatePreset('unseen')).toBe('release')
    expect(parseAddedDatePreset('today')).toBe('release')
    expect(parseAddedDatePreset('forever')).toBe('all')
    expect(parseAddedDatePreset('constructor')).toBe('all')
    expect(parseAddedDatePreset('__proto__')).toBe('all')
    expect(parseAddedDatePreset(null)).toBe('all')
  })

  it('builds compact preset links without personal windows', () => {
    expect(addedDateHref('/tutorials/', 'release')).toBe('/tutorials/?added=release')
    expect(addedDateHref('/tutorials/', '7d')).toBe('/tutorials/?added=7d')
    expect(addedDateHref('/tutorials/', 'all')).toBe('/tutorials/')
  })

  it('formats date-only release dates as calendar dates in every time zone', () => {
    expect(formatAddedDate('2026-09-06', 'zh')).toBe('9月6日')
    expect(formatAddedDate('2026-09-06', 'en')).toBe('Sep 6')
    expect(formatAddedDate(localIso(2026, 8, 20), 'zh')).toBe('8月20日')
  })

  it('finds the newest timestamp and sorts newest-first with stable ties', () => {
    const items = [
      { id: 'older', addedAt: '2026-08-20T00:00:00Z' },
      { id: 'first-tie', addedAt: '2026-08-23T00:00:00Z' },
      { id: 'second-tie', addedAt: '2026-08-23T00:00:00Z' },
    ]
    expect(maxAddedAt(items)).toBe('2026-08-23T00:00:00Z')
    expect(sortByAddedAtDescending(items).map((item) => item.id)).toEqual(['first-tie', 'second-tie', 'older'])
  })
})
