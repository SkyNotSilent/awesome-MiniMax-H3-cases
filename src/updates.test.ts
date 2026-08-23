import { describe, expect, it } from 'vitest'
import {
  addedDateHref,
  matchesAddedDate,
  maxAddedAt,
  parseAddedDatePreset,
  parseSince,
} from './updates'

describe('added-date filtering', () => {
  const now = new Date(2026, 7, 23, 12, 0, 0)
  const localIso = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour).toISOString()

  it('uses local calendar boundaries for today, seven days, and thirty days', () => {
    expect(matchesAddedDate(localIso(2026, 8, 23, 0), 'today', null, now)).toBe(true)
    expect(matchesAddedDate(localIso(2026, 8, 22, 23), 'today', null, now)).toBe(false)
    expect(matchesAddedDate(localIso(2026, 8, 17), '7d', null, now)).toBe(true)
    expect(matchesAddedDate(localIso(2026, 8, 16, 23), '7d', null, now)).toBe(false)
    expect(matchesAddedDate(localIso(2026, 7, 25), '30d', null, now)).toBe(true)
    expect(matchesAddedDate(localIso(2026, 7, 24, 23), '30d', null, now)).toBe(false)
  })

  it('treats unseen as strictly newer than the saved high-water mark', () => {
    const since = localIso(2026, 8, 20)
    expect(matchesAddedDate(localIso(2026, 8, 21), 'unseen', since, now)).toBe(true)
    expect(matchesAddedDate(since, 'unseen', since, now)).toBe(false)
    expect(matchesAddedDate(localIso(2026, 8, 21), 'unseen', null, now)).toBe(false)
  })

  it('normalizes valid URL state and falls back safely for invalid values', () => {
    expect(parseAddedDatePreset('7d')).toBe('7d')
    expect(parseAddedDatePreset('forever')).toBe('all')
    expect(parseSince('not-a-date')).toBeNull()
    expect(parseSince('2026-08-20')).toBeNull()
    expect(parseSince('2026-08-20T00:00:00Z')).toBe('2026-08-20T00:00:00.000Z')
  })

  it('builds shareable tutorial update links with the original baseline', () => {
    expect(addedDateHref('/tutorials/', 'unseen', '2026-08-20T00:00:00.000Z')).toBe(
      '/tutorials/?added=unseen&since=2026-08-20T00%3A00%3A00.000Z',
    )
    expect(addedDateHref('/tutorials/', 'all', null)).toBe('/tutorials/')
  })

  it('finds the newest catalog timestamp across content types', () => {
    expect(maxAddedAt([
      { addedAt: '2026-08-20T00:00:00Z' },
      { addedAt: '2026-08-23T00:00:00Z' },
      { addedAt: '2026-08-21T00:00:00Z' },
    ])).toBe('2026-08-23T00:00:00Z')
  })
})
