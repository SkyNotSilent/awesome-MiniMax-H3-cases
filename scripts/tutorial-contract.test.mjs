import { describe, it, expect } from 'vitest'
import guides from '../data/tutorial-guides.json' with { type: 'json' }
import { tutorialContractErrors, tutorialSourceKey } from './tutorial-contract.mjs'
import { toPublicTutorial, partitionCandidates } from './tutorial-collection.mjs'

describe('tutorial publication contract', () => {
  it('preserves every published learning field while stripping nested private review data', () => {
    const guide = structuredClone(guides.find(item => item.chapters?.length))
    const dirty = structuredClone(guide)
    dirty.privateReview = 'private'
    dirty.evidence.samplingNotes = 'private'
    dirty.learningResources[0].privateReview = 'private'
    dirty.source.discoveryQuery = 'private'
    expect(toPublicTutorial(dirty)).toEqual(guide)
    expect(tutorialContractErrors(guide)).toEqual([])
  })
  it('normalizes platform aliases and ignores tracking or playback query parameters', () => {
    for (const [platform, first, second] of [
      ['x', 'https://x.com/a/status/123?s=20', 'https://twitter.com/b/status/123'],
      ['youtube', 'https://youtu.be/G3YHSvXZP_g?t=480', 'https://www.youtube.com/watch?v=G3YHSvXZP_g'],
      ['reddit', 'https://old.reddit.com/r/comfyui/comments/1w2wcnh/a/', 'https://www.reddit.com/r/comfyui/comments/1w2wcnh/b/?sort=new'],
      ['github', 'https://github.com/antirez/h3.c/', 'https://github.com/antirez/h3.c?utm_source=example'],
      ['huggingface', 'https://huggingface.co/MiniMaxAI/MiniMax-H3/', 'https://huggingface.co/MiniMaxAI/MiniMax-H3'],
    ]) expect(tutorialSourceKey({ platform, url: first })).toBe(tutorialSourceKey({ platform, url: second }))
    expect(tutorialSourceKey({ platform: 'x', url: 'https://x.com.evil.test/a/status/123' })).toBeNull()
    expect(tutorialSourceKey({ platform: 'github', url: 'https://example.com/project' })).toBeNull()
  })
  it('does not upgrade source verification dates to site testing and blocks unsupported claims', () => {
    const guide = structuredClone(guides.find(item => item.depth === 'deep'))
    expect(toPublicTutorial(guide).evidence).not.toHaveProperty('siteTestedAt')
    guide.evidence.siteTestedAt = '2026-09-06'
    expect(tutorialContractErrors(guide)).toContain('tutorial.evidence.siteTestUrl: required for site test claim')
    delete guide.learningResources
    expect(tutorialContractErrors(guide)).toContain('tutorial.learningResources: required for deep guide')
  })
  it('requires correct chapter timestamps and complete bilingual content', () => {
    const guide = structuredClone(guides.find(item => item.chapters?.length))
    guide.chapters[0].seconds += 1
    guide.cost.en = ''
    expect(tutorialContractErrors(guide)).toContain('tutorial.chapters: timestamp mismatch')
    expect(tutorialContractErrors(guide)).toContain('tutorial.cost.en: text required')
  })
  it('deduplicates distinct sources with the same slug within a publication batch', () => {
    const one = { ...guides[0], verification: Object.fromEntries(['originalAuthor', 'targetsH3', 'stepsExecutable', 'commandsVerified', 'bilingualComplete', 'posterCached', 'sourceActive'].map(x => [x, true])) }
    const two = { ...one, source: { ...one.source, url: 'https://docs.comfy.org/another-tutorial' } }
    expect(partitionCandidates([one, two], []).ready).toHaveLength(1)
  })
})
