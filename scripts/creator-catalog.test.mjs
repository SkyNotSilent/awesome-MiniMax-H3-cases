import { describe, expect, it } from 'vitest'
import { buildCreatorCatalog, extractXHandle, normalizeHandle, tutorialCreatorIdentity } from './creator-catalog.mjs'

const now = new Date('2026-08-23T12:00:00.000Z')

function videoCase(id, handle, options = {}) {
  return {
    id,
    sourceUrl: `https://x.com/${handle}/status/${id.replace(/\D/g, '') || '1'}`,
    sourceType: 'x',
    author: options.author ?? handle,
    publishedAt: options.publishedAt ?? '2026-08-10T00:00:00.000Z',
    addedAt: options.addedAt ?? '2026-08-11T00:00:00.000Z',
    prompt: options.prompt ?? null,
    promptProvenance: options.prompt ? 'creator-verbatim' : 'not-published',
    mediaUrl: `/media/${id}.mp4`,
    verified: false,
    engagement: options.engagement,
  }
}

function tutorial(id, handle, options = {}) {
  const platform = options.platform ?? 'x'
  const sourceUrl = platform === 'github'
    ? `https://github.com/${handle}/h3-guide`
    : platform === 'youtube'
      ? `https://www.youtube.com/watch?v=example1234`
      : `https://x.com/${handle}/status/9001`
  return {
    id,
    contentType: 'community',
    addedAt: options.addedAt ?? '2026-08-20T00:00:00.000Z',
    commands: options.commands ?? ['npm run start'],
    checks: { zh: ['成功'], en: ['Success'] },
    troubleshooting: [{ problem: { zh: '失败', en: 'Failure' }, solution: { zh: '重试', en: 'Retry' } }],
    expectedResult: { zh: '视频', en: 'Video' },
    testedVersions: ['1.0.0'],
    source: {
      platform,
      url: sourceUrl,
      author: options.author ?? handle,
      handle: `@${handle}`,
    },
    ...(options.authorUrl ? { contribution: { authorUrl: options.authorUrl, issueUrl: 'https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/1' } } : {}),
    engagement: options.engagement,
  }
}

describe('creator identity', () => {
  it('includes foundation authors with evidenced profiles without guessing docs identities', () => {
    const guide = { ...tutorial('native', 'antirez', { platform: 'github' }), contentType: 'foundation' }
    expect(tutorialCreatorIdentity(guide)).toMatchObject({ platform: 'github', handle: 'antirez' })
    const docs = { ...guide, source: { platform: 'docs', url: 'https://example.com/guide', author: 'Maker' } }
    expect(tutorialCreatorIdentity(docs)).toBeNull()
    expect(tutorialCreatorIdentity({ ...docs, source: { ...docs.source, authorProfileUrl: 'https://github.com/Maker' } })).toMatchObject({ platform: 'github', handle: 'maker' })
    expect(tutorialCreatorIdentity({ ...docs, source: { ...docs.source, authorProfileUrl: 'https://example.com/Maker' } })).toBeNull()
  })
  it('normalizes handles and extracts them from X status URLs', () => {
    expect(normalizeHandle('@Creator_Name')).toBe('creator_name')
    expect(extractXHandle('https://x.com/Creator_Name/status/123')).toBe('creator_name')
    expect(extractXHandle('https://example.com/Creator_Name/status/123')).toBeNull()
  })

  it('merges aliases into a stable creator id and current slug', () => {
    const catalog = buildCreatorCatalog([
      videoCase('case-1', 'OldName'),
      videoCase('case-2', 'newname', { prompt: 'A complete prompt' }),
    ], [], {
      now,
      aliasConfig: { creators: [{ id: 'creator-stable', currentHandle: 'newname', aliases: ['oldname'] }] },
    })
    expect(catalog.creators).toHaveLength(1)
    expect(catalog.creators[0]).toMatchObject({ id: 'creator-stable', slug: 'newname', caseCount: 2 })
  })

  it('creates stable GitHub and YouTube identities without merging same-named accounts', () => {
    const github = tutorial('github-guide', 'maker', { platform: 'github', authorUrl: 'https://github.com/maker' })
    const youtube = tutorial('youtube-guide', 'maker', { platform: 'youtube', authorUrl: 'https://www.youtube.com/@maker' })
    expect(tutorialCreatorIdentity(github)).toMatchObject({ platform: 'github', handle: 'maker', profileUrl: 'https://github.com/maker' })
    const catalog = buildCreatorCatalog([], [github, youtube], { now })
    expect(catalog.creators.map((creator) => creator.id).sort()).toEqual(['github-maker', 'youtube-maker'])
    expect(catalog.creators.map((creator) => creator.slug).sort()).toEqual(['github-maker', 'youtube-maker'])
    expect(catalog.stats.sourceCreators).toBe(2)
  })
})
describe('creator rankings', () => {
  it('publishes a two-case video creator and keeps tutorial authors on a separate rank', () => {
    const catalog = buildCreatorCatalog([
      videoCase('case-1', 'Alice', { author: 'Alice', prompt: 'Prompt one' }),
      videoCase('case-2', 'alice', { author: 'Alice', prompt: 'Prompt two' }),
    ], [tutorial('guide-1', 'Teacher')], { now })

    const alice = catalog.creators.find((creator) => creator.handle === 'alice')
    const teacher = catalog.creators.find((creator) => creator.handle === 'teacher')
    expect(alice).toMatchObject({ caseCount: 2, promptCount: 2, roles: ['video'] })
    expect(alice?.ranks.overall).toBe(1)
    expect(alice?.ranks.tutorials).toBeNull()
    expect(teacher).toMatchObject({ tutorialCount: 1, roles: ['tutorial'] })
    expect(teacher?.ranks.overall).toBeNull()
    expect(teacher?.ranks.tutorials).toBe(1)
  })

  it('admits a single breakout case while leaving ordinary single cases out', () => {
    const cases = Array.from({ length: 10 }, (_, index) => videoCase(
      `case-${index + 1}`,
      `creator${index + 1}`,
      {
        engagement: {
          likes: index * 10,
          reposts: index,
          replies: index,
          views: index * 100,
          snapshotAt: '2026-08-11T00:00:00.000Z',
        },
      },
    ))
    const catalog = buildCreatorCatalog(cases, [], { now })
    expect(catalog.creators.some((creator) => creator.handle === 'creator10')).toBe(true)
    expect(catalog.creators.some((creator) => creator.handle === 'creator1')).toBe(false)
  })

  it('reports rank movement without publishing hidden score components', () => {
    const initial = buildCreatorCatalog([
      videoCase('case-1', 'alice', { prompt: 'Prompt' }),
      videoCase('case-2', 'alice'),
      videoCase('case-3', 'bob'),
      videoCase('case-4', 'bob'),
    ], [], { now })
    const updated = buildCreatorCatalog([
      videoCase('case-1', 'alice', { prompt: 'Prompt' }),
      videoCase('case-2', 'alice'),
      videoCase('case-3', 'bob', { prompt: 'Prompt 3' }),
      videoCase('case-4', 'bob', { prompt: 'Prompt 4' }),
      videoCase('case-5', 'bob', { prompt: 'Prompt 5' }),
    ], [], { now, previousCatalog: initial })
    const bob = updated.creators.find((creator) => creator.handle === 'bob')
    expect(bob?.ranks.overall).toBe(1)
    expect(bob?.rankDelta.overall).toBe(1)
    expect(Object.keys(bob ?? {}).some((key) => key.startsWith('_'))).toBe(false)
  })
})
