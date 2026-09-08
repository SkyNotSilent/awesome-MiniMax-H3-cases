import { describe, expect, it } from 'vitest'
import type { TutorialGuide } from './types'
import { selectTutorialSpotlights } from './tutorial-spotlight'

const guide = (id: string, author: string, addedAt = '2026-09-08T00:00:00Z') => ({
  id, addedAt, contentType: 'community', evidence: { status: 'active' },
  source: { author }, contribution: { authorUrl: `https://github.com/${author}`, issueUrl: 'https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/16' },
} as TutorialGuide)

describe('new author submissions', () => {
  it('expires after fourteen days and rejects future or unreviewed entries', () => {
    const now = Date.parse('2026-09-22T00:00:00Z')
    const held = guide('held', 'held', '2026-09-21T00:00:00Z')
    held.evidence.status = 'needs-review'
    expect(selectTutorialSpotlights([guide('expired', 'a'), guide('future', 'b', '2026-09-23T00:00:00Z'), held, guide('live', 'c', '2026-09-09T00:00:00Z')], now).map(x => x.id)).toEqual(['live'])
  })
  it('keeps at most three distinct authors, newest first, without mutating publication dates', () => {
    const items = [guide('a', 'alice'), guide('b', 'alice', '2026-09-09T00:00:00Z'), guide('c', 'bob'), guide('d', 'carol'), guide('e', 'dan')]
    const before = JSON.stringify(items)
    expect(selectTutorialSpotlights(items, Date.parse('2026-09-10T00:00:00Z')).map(x => x.id)).toEqual(['b', 'c', 'd'])
    expect(JSON.stringify(items)).toBe(before)
  })
  it('does not promote ordinary editorial imports', () => {
    const item = guide('ordinary', 'a')
    delete item.contribution
    expect(selectTutorialSpotlights([item], Date.parse('2026-09-09T00:00:00Z'))).toEqual([])
  })
})
