import { describe, expect, it } from 'vitest'
import {
  addedDatePresets,
  addedDateHref,
  clampAddedAt,
  matchesAddedDate,
  maxAddedAt,
  parseAddedDatePreset,
  parseSince,
  parseStoredUpdateSession,
  sortByAddedAtDescending,
  todayUpdateWindow,
  validUpdateWindow,
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

  it('builds a today window that starts at the local day boundary and never runs ahead of the clock', () => {
    const window = todayUpdateWindow(localIso(2026, 8, 23, 9), now)
    expect(matchesAddedDate(localIso(2026, 8, 23, 0), 'unseen', window)).toBe(true)
    expect(matchesAddedDate(localIso(2026, 8, 22, 23), 'unseen', window)).toBe(false)
    expect(window.through).toBe(localIso(2026, 8, 23, 9))
    expect(todayUpdateWindow(localIso(2026, 8, 25), now).through).toBe(now.toISOString())
    expect(todayUpdateWindow('', now).through).toBe(now.toISOString())
    const stale = todayUpdateWindow(localIso(2026, 8, 20), now)
    expect(stale.since).toBe(stale.through)
    expect(Date.parse(stale.since)).toBeLessThanOrEqual(Date.parse(stale.through))
  })

  it('bounds unseen items strictly between since and through', () => {
    const since = localIso(2026, 8, 20)
    const through = localIso(2026, 8, 22)
    expect(matchesAddedDate(localIso(2026, 8, 21), 'unseen', { since, through })).toBe(true)
    expect(matchesAddedDate(since, 'unseen', { since, through })).toBe(false)
    expect(matchesAddedDate(through, 'unseen', { since, through })).toBe(true)
    expect(matchesAddedDate(localIso(2026, 8, 23), 'unseen', { since, through })).toBe(false)
    expect(matchesAddedDate(localIso(2026, 8, 21), 'unseen', { since: null, through })).toBe(false)
  })

  it('normalizes valid URL state and falls back safely for invalid values', () => {
    expect(addedDatePresets).toEqual(['all', 'unseen', '7d', '30d'])
    expect(parseAddedDatePreset('7d')).toBe('7d')
    expect(parseAddedDatePreset('today')).toBe('unseen')
    expect(parseAddedDatePreset('forever')).toBe('all')
    expect(parseSince('not-a-date')).toBeNull()
    expect(parseSince('2026-08-20')).toBeNull()
    expect(parseSince('2026-08-20T00:00:00Z')).toBe('2026-08-20T00:00:00.000Z')
    expect(clampAddedAt('2026-08-25T00:00:00Z', '2026-08-23T00:00:00Z')).toBe('2026-08-23T00:00:00.000Z')
  })

  it('validates persisted session windows without allowing reversed ranges', () => {
    const maximum = '2026-08-23T00:00:00Z'
    expect(validUpdateWindow({ since: '2026-08-20T00:00:00Z', through: '2026-08-22T00:00:00Z' }, maximum)).toEqual({
      since: '2026-08-20T00:00:00.000Z',
      through: '2026-08-22T00:00:00.000Z',
    })
    expect(validUpdateWindow({ since: '2026-08-22T00:00:00Z', through: '2026-08-20T00:00:00Z' }, maximum)).toBeNull()
    expect(parseStoredUpdateSession('{"version":2,"firstVisit":true}')).toEqual({ version: 2, firstVisit: true })
    expect(parseStoredUpdateSession('{"version":3,"firstVisit":true}')).toBeNull()
    expect(parseStoredUpdateSession('broken')).toBeNull()
  })

  it('builds fixed shareable update links and keeps older presets compact', () => {
    expect(addedDateHref('/tutorials/', 'unseen', {
      since: '2026-08-20T00:00:00.000Z',
      through: '2026-08-23T00:00:00.000Z',
    })).toBe(
      '/tutorials/?added=unseen&since=2026-08-20T00%3A00%3A00.000Z&through=2026-08-23T00%3A00%3A00.000Z',
    )
    expect(addedDateHref('/tutorials/', '7d')).toBe('/tutorials/?added=7d')
    expect(addedDateHref('/tutorials/', 'all')).toBe('/tutorials/')
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
