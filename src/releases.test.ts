import { describe, expect, it } from 'vitest'
import { createReleaseBatches } from './releases'
import type { CatalogPayload } from './types'

const catalog = {
  version: 1,
  generatedAt: '2026-09-06T02:48:51.413Z',
  featuredCaseIds: [],
  cases: [
    { id: 'newest', addedAt: '2026-09-06T02:48:51.413Z' },
    { id: 'same-release', addedAt: '2026-09-05T16:00:00.000Z' },
    { id: 'previous-release', addedAt: '2026-09-05T15:59:59.999Z' },
    { id: 'old', addedAt: '2026-08-01T00:00:00.000Z' },
  ],
  tutorials: [
    { id: 'guide-a', addedAt: '2026-08-23T02:34:28+08:00' },
    { id: 'guide-b', addedAt: '2026-08-23T01:00:00+08:00' },
    { id: 'guide-old', addedAt: '2026-08-10T01:00:00+08:00' },
  ],
} as unknown as CatalogPayload

describe('release batches', () => {
  it('counts every channel against its own latest catalog day', () => {
    const releases = createReleaseBatches(catalog)
    expect(releases.cases).toEqual({ since: '2026-09-05T15:59:59.999Z', through: '2026-09-06T02:48:51.413Z', count: 2 })
    expect(releases.tutorials).toEqual({ since: '2026-08-22T15:59:59.999Z', through: '2026-08-22T18:34:28.000Z', count: 2 })
  })

  it('prefers server maxima and counts when the summary payload provides them', () => {
    const releases = createReleaseBatches({
      ...catalog,
      cases: [],
      tutorials: [],
      summary: {
        maxima: { cases: '2026-09-06T02:48:51.413Z', tutorials: '2026-08-22T18:34:28.000Z' },
        counts: { cases: 16, tutorials: 24 },
        totals: { cases: 1334, tutorials: 24 },
      },
    })
    expect(releases.cases.count).toBe(16)
    expect(releases.cases.since).toBe('2026-09-05T15:59:59.999Z')
    expect(releases.tutorials.count).toBe(24)
  })

  it('yields an empty release for an empty channel instead of throwing', () => {
    const releases = createReleaseBatches({ ...catalog, cases: [] })
    expect(releases.cases.count).toBe(0)
    expect(releases.tutorials.count).toBe(2)
  })
})
