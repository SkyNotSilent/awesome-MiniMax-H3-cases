import { describe, expect, it } from 'vitest'
import { isPrivateTrackedPath, scanText } from './privacy-scan.mjs'

describe('privacy scan', () => {
  it('blocks internal review fields in public artifacts', () => {
    const findings = scanText('public/example.json', JSON.stringify({ reviewNote: 'internal only' }), { scanPrivateFields: true })
    expect(findings).toEqual([{ path: 'public/example.json', line: 1, reason: 'private review field reviewNote' }])
  })

  it('allows workflow documentation to name schema fields when public-field scanning is disabled', () => {
    expect(scanText('docs/workflow.md', 'Keep reviewStatus private.', { scanSecrets: true })).toEqual([])
  })

  it('detects a live signed URL without echoing its value', () => {
    const signature = ['X-Amz', 'Signature='].join('-')
    const findings = scanText('public/leak.txt', `https://example.com/video?${signature}secret`, { scanSecrets: true })
    expect(findings).toEqual([{ path: 'public/leak.txt', line: 1, reason: 'signed URL signature' }])
  })

  it('keeps operational traffic monitoring private without blocking the public Umami client', () => {
    expect(isPrivateTrackedPath('data/traffic-history.json')).toBe(true)
    expect(isPrivateTrackedPath('scripts/sync-traffic-snapshot.mjs')).toBe(true)
    expect(isPrivateTrackedPath('.github/workflows/traffic-snapshot.yml')).toBe(true)
    expect(isPrivateTrackedPath('src/analytics.ts')).toBe(false)
  })
})
