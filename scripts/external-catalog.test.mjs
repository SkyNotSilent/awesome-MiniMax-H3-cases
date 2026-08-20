import { describe, expect, it } from 'vitest'
import { buildExternalLedger, normalizeXUrl, sha256 } from './external-catalog.mjs'

const checkedAt = '2026-08-21T02:00:00.000Z'

function entry(slug, statusId, prompt = 'A complete public prompt with enough detail.') {
  return {
    slug,
    source: { url: `https://twitter.com/creator/status/${statusId}?s=20` },
    promptSourceUrls: [`https://x.com/creator/status/${statusId}`],
    prompt,
  }
}

function ledgerFor(prompts, options = {}) {
  return buildExternalLedger({
    sourceId: 'private-source',
    catalog: { updatedAt: '2026-08-21', prompts },
    catalogCommit: 'commit-1',
    catalogHash: 'catalog-hash',
    localDataHash: 'local-hash',
    checkedAt,
    publicCases: [],
    candidates: [],
    ...options,
  })
}

describe('external catalog ledger', () => {
  it('normalizes X status URLs without retaining tracking parameters', () => {
    expect(normalizeXUrl('https://twitter.com/a/status/123?s=20')).toBe('https://x.com/a/status/123')
    expect(normalizeXUrl('https://example.com/a/status/123')).toBeNull()
  })

  it('queues new sources but stores only Prompt fingerprints', () => {
    const prompt = 'Keep this exact private prompt text out of the ledger.'
    const ledger = ledgerFor([entry('new-case', '100', prompt)])
    expect(ledger.entries[0]).toMatchObject({ status: 'pending', action: 'import-case', xStatusId: '100' })
    expect(ledger.entries[0].promptHash).toBe(sha256(prompt))
    expect(JSON.stringify(ledger)).not.toContain(prompt)
  })

  it('distinguishes published matches, missing Prompt enrichment, and conflicts', () => {
    const matching = entry('matching', '101', 'Matching public prompt text.')
    const missing = entry('missing', '102', 'Prompt newly discovered at the original source.')
    const conflict = entry('conflict', '103', 'External version differs from local.')
    const ledger = ledgerFor([matching, missing, conflict], {
      publicCases: [
        { id: 'case-101', sourceUrl: 'https://x.com/creator/status/101', prompt: matching.prompt },
        { id: 'case-102', sourceUrl: 'https://x.com/creator/status/102', prompt: null },
        { id: 'case-103', sourceUrl: 'https://x.com/creator/status/103', prompt: 'Existing verified local text.' },
      ],
    })
    expect(ledger.entries.find((item) => item.slug === 'matching')).toMatchObject({ status: 'published', caseId: 'case-101' })
    expect(ledger.entries.find((item) => item.slug === 'missing')).toMatchObject({ status: 'pending', action: 'enrich-prompt' })
    expect(ledger.entries.find((item) => item.slug === 'conflict')).toMatchObject({ status: 'conflict', action: 'compare-prompt-at-original-source' })
  })

  it('deduplicates repeated X statuses and retains upstream removals', () => {
    const first = ledgerFor([entry('original', '104')])
    const second = ledgerFor([entry('replacement', '105'), entry('duplicate', '105')], { previousLedger: first })
    expect(second.entries.find((item) => item.slug === 'duplicate')).toMatchObject({ status: 'duplicate', duplicateOf: 'replacement' })
    expect(second.entries.find((item) => item.slug === 'original')).toMatchObject({ removedUpstreamAt: checkedAt })
  })

  it('keeps a manually source-verified public Prompt published when an index fingerprint differs', () => {
    const source = entry('verified', '107', 'External index version.')
    const localPrompt = 'Prompt copied verbatim from the original X reply.'
    const previous = ledgerFor([source])
    previous.entries[0].verifiedPromptHash = sha256(localPrompt)
    const ledger = ledgerFor([source], {
      previousLedger: previous,
      publicCases: [{ id: 'case-107', sourceUrl: 'https://x.com/creator/status/107', prompt: localPrompt }],
    })
    expect(ledger.entries[0]).toMatchObject({ status: 'published', action: null, caseId: 'case-107' })
  })

  it('is idempotent for the same input and timestamp', () => {
    const first = ledgerFor([entry('stable', '106')])
    const second = ledgerFor([entry('stable', '106')], { previousLedger: first })
    expect(second).toEqual(first)
  })
})
