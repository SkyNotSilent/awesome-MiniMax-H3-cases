import { describe, expect, it } from 'vitest'
import { candidateErrors, partitionCandidates, toPublicTutorial, xStatusId } from './tutorial-collection.mjs'

function candidate(overrides = {}) {
  return {
    id: 'verified-h3-tutorial',
    contentType: 'community',
    category: 'comfyui',
    title: { zh: '可执行教程', en: 'Executable tutorial' },
    outcome: { zh: '完成一条工作流。', en: 'Complete one workflow.' },
    audience: { zh: '本地用户', en: 'Local users' },
    hardware: { zh: 'NVIDIA GPU', en: 'NVIDIA GPU' },
    prerequisites: { zh: ['准备环境'], en: ['Prepare the environment'] },
    steps: { zh: ['核验后执行'], en: ['Verify, then run'] },
    commands: ['git status'],
    caveats: { zh: ['先看 README'], en: ['Read the README first'] },
    posterUrl: '/tutorial-posters/test.jpg',
    tags: ['ComfyUI'],
    relatedResourceIds: [],
    source: {
      platform: 'x',
      url: 'https://x.com/creator/status/1234567890',
      author: 'Creator',
      handle: '@creator',
      publishedAt: '2026-08-20',
      originalLanguage: 'en',
    },
    verifiedAt: '2026-08-23',
    verification: {
      originalAuthor: true,
      targetsH3: true,
      stepsExecutable: true,
      commandsVerified: true,
      bilingualComplete: true,
      posterCached: true,
      sourceActive: true,
    },
    privateDiscoveryQuery: 'must-never-leak',
    ...overrides,
  }
}

describe('weekly tutorial collection safeguards', () => {
  it('extracts status IDs and deduplicates repeated discovery runs', () => {
    expect(xStatusId('https://twitter.com/a/status/1234567890?s=20')).toBe('1234567890')
    const item = candidate()
    const first = partitionCandidates([item], [])
    expect(first.ready).toHaveLength(1)
    const repeated = partitionCandidates([item], [toPublicTutorial(item)])
    expect(repeated.ready).toHaveLength(0)
    expect(repeated.blocked[0].errors).toContain('duplicate')
  })

  it('blocks missing bilingual fields, unverifiable commands, and inactive sources', () => {
    const item = candidate({
      title: { zh: '只有中文', en: '' },
      verification: { ...candidate().verification, commandsVerified: false, sourceActive: false },
    })
    expect(candidateErrors(item)).toEqual(expect.arrayContaining([
      'incomplete-title',
      'unverified-commandsVerified',
      'unverified-sourceActive',
    ]))
  })

  it('keeps private review metadata out of the public tutorial record', () => {
    const publicItem = toPublicTutorial(candidate())
    expect(publicItem).not.toHaveProperty('verification')
    expect(publicItem).not.toHaveProperty('privateDiscoveryQuery')
    expect(publicItem.source.url).toContain('/status/1234567890')
  })

  it('blocks duplicate candidates in the same batch', () => {
    const result = partitionCandidates([candidate(), candidate({ id: 'second-slug' })], [])
    expect(result.ready).toHaveLength(1)
    expect(result.blocked[0].errors).toEqual(['duplicate-candidate'])
  })
})
