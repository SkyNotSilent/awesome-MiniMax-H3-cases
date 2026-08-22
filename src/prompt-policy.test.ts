import { describe, expect, it } from 'vitest'
import rawCases from '../data/cases.json'

describe('published prompt policy', () => {
  it('stores only verbatim published prompts and never prompt reconstructions or placeholders', () => {
    for (const item of rawCases) {
      expect(['official-verbatim', 'creator-verbatim', 'external-archive-verbatim', 'not-published']).toContain(item.promptProvenance)
      expect(item).not.toHaveProperty('promptEn')
      expect(item.promptCompleteness).not.toBe('excerpt')

      if (item.promptProvenance === 'not-published') {
        expect(item.prompt).toBeNull()
      } else {
        expect(typeof item.prompt).toBe('string')
        expect(item.prompt?.trim().length).toBeGreaterThan(0)
        if (item.promptProvenance === 'external-archive-verbatim') expect(item.archiveSourceUrl).toMatch(/^https:\/\//)
      }
    }
  })
})
