import { expect, it } from 'vitest'
import { latestReleaseWindow } from './release-window.mjs'

it('covers every item added on the same Asia/Shanghai calendar day as the newest one', () => {
  // 10:48 Beijing time on 6 September: the release day starts at 16:00Z the day before.
  expect(latestReleaseWindow('2026-09-06T02:48:51.413Z')).toEqual({
    since: '2026-09-05T15:59:59.999Z',
    through: '2026-09-06T02:48:51.413Z',
  })
  // Items published late in the Beijing evening still belong to that Beijing day.
  expect(latestReleaseWindow('2026-09-06T15:59:59.000Z').since).toBe('2026-09-05T15:59:59.999Z')
  expect(latestReleaseWindow('2026-09-06T16:00:00.000Z').since).toBe('2026-09-06T15:59:59.999Z')
})

it('normalizes offset timestamps and rejects invalid maxima', () => {
  expect(latestReleaseWindow('2026-08-23T02:34:28+08:00')).toEqual({
    since: '2026-08-22T15:59:59.999Z',
    through: '2026-08-22T18:34:28.000Z',
  })
  expect(latestReleaseWindow('')).toBeNull()
  expect(latestReleaseWindow('not-a-date')).toBeNull()
  expect(latestReleaseWindow(null)).toBeNull()
})
