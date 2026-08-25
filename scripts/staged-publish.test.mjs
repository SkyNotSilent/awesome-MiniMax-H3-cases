import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolvePublishStagingPath } from './review-paths.mjs'
import { prepareStagedCommit, updatePrivateCandidates, verifyVideoRoute } from './staged-publish.mjs'

function stagedCase(id, overrides = {}) {
  return {
    id,
    sourceUrl: `https://x.com/creator/status/${id.replace(/\D/g, '') || '1'}`,
    mediaUrl: `/media/${id}.mp4`,
    posterUrl: `/posters/x/${id}.jpg`,
    ...overrides,
  }
}

describe('staged video verification', () => {
  it('requires the app redirect and the bucket Range response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 307,
        headers: { Location: 'https://bucket.example/video.mp4?temporary=1' },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 1]), {
        status: 206,
        headers: { 'Content-Range': 'bytes 0-1/100' },
      }))

    await expect(verifyVideoRoute({
      siteBaseUrl: 'https://example.com',
      caseId: 'case-1',
      fetchImpl,
      attempts: 1,
    })).resolves.toMatchObject({ appStatus: 307, bucketStatus: 206 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual', headers: { Range: 'bytes=0-1' } })
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ redirect: 'manual', headers: { Range: 'bytes=0-1' } })
  })

  it('rejects a direct response that skips the app redirect contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 206 }))
    await expect(verifyVideoRoute({
      siteBaseUrl: 'https://example.com',
      caseId: 'case-1',
      fetchImpl,
      attempts: 1,
    })).rejects.toThrow('expected 307')
  })
})

describe('staged publication plan', () => {
  it('accepts only private staging manifests', () => {
    expect(resolvePublishStagingPath('.review/publish-staging/run-1.json')).toMatch(/\.review\/publish-staging\/run-1\.json$/)
    expect(() => resolvePublishStagingPath('../outside.json')).toThrow('inside .review/publish-staging')
  })

  it('keeps failed media private while allowing valid entries to continue', async () => {
    const good = stagedCase('case-1')
    const bad = stagedCase('case-2', { mediaUrl: null })
    const plan = await prepareStagedCommit({
      stagedCases: [good, bad],
      publicCases: [],
      verifyVideo: vi.fn().mockResolvedValue({ appStatus: 307, bucketStatus: 206 }),
      posterExists: vi.fn().mockResolvedValue(true),
    })

    expect(plan.ready.map((item) => item.id)).toEqual(['case-1'])
    expect(plan.failed).toEqual([{ item: bad, reason: 'hosted media path is missing or invalid' }])
  })

  it('treats an already committed case as an idempotent no-op', async () => {
    const item = stagedCase('case-1')
    const verifyVideo = vi.fn()
    const plan = await prepareStagedCommit({
      stagedCases: [item],
      publicCases: [item],
      verifyVideo,
      posterExists: vi.fn(),
    })

    expect(plan.alreadyCommitted).toEqual([item])
    expect(plan.ready).toEqual([])
    expect(plan.failed).toEqual([])
    expect(verifyVideo).not.toHaveBeenCalled()
  })

  it('removes successful private candidates and retains failed candidates with a factual state', () => {
    const good = stagedCase('case-1')
    const bad = stagedCase('case-2')
    const untouched = stagedCase('case-3')
    const next = updatePrivateCandidates({
      candidates: [good, bad, untouched],
      ready: [good],
      alreadyCommitted: [],
      failed: [{ item: bad, reason: 'bucket range request failed' }],
    })

    expect(next).toEqual([
      { ...bad, reviewStatus: 'media-failed', reviewNote: 'Publication staging blocked: bucket range request failed' },
      untouched,
    ])
  })

  it('fails closed on conflicting ids and duplicate sources', async () => {
    const existing = stagedCase('case-1')
    const plan = await prepareStagedCommit({
      stagedCases: [
        stagedCase('case-1', { sourceUrl: 'https://x.com/other/status/99' }),
        stagedCase('case-2', { sourceUrl: existing.sourceUrl }),
      ],
      publicCases: [existing],
      verifyVideo: vi.fn(),
      posterExists: vi.fn(),
    })

    expect(plan.failed.map(({ reason }) => reason)).toEqual([
      'case id conflicts with an existing public case',
      'source URL already belongs to another public case',
    ])
  })

  it('fails closed before media checks when identity or source fields are invalid', async () => {
    const plan = await prepareStagedCommit({
      stagedCases: [
        stagedCase('bad id'),
        stagedCase('case-2', { sourceUrl: 'not-a-url' }),
      ],
      publicCases: [],
      verifyVideo: vi.fn(),
      posterExists: vi.fn(),
    })

    expect(plan.failed.map(({ reason }) => reason)).toEqual([
      'case id is missing or invalid',
      'source URL is missing or invalid',
    ])
  })

  it('keeps promotion output out of the public case file', async () => {
    const source = await readFile(resolve(process.cwd(), 'scripts/promote-candidates.mjs'), 'utf8')
    expect(source).toContain('writeJsonAtomic(stagingPath, promoted)')
    expect(source).not.toMatch(/write(?:JsonAtomic|File)\(casesPath/)
  })
})
