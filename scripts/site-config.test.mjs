import { describe, expect, it } from 'vitest'
import { primaryOrigin, resolveSiteOrigin } from '../shared/site-config.mjs'

describe('public site origin', () => {
  it('uses the custom domain when no override is provided', () => {
    expect(resolveSiteOrigin({ environment: {} })).toBe('https://awesome-minimax-h3-cases.zzskysilent.com')
  })
  it('accepts explicit loopback fixtures and normalizes trailing slashes', () => {
    expect(resolveSiteOrigin({ environment: { PUBLIC_SITE_URL: 'http://localhost:4318/' } })).toBe('http://localhost:4318')
  })
  it('rejects conflicting build and media targets without exposing their values', () => {
    expect(() => resolveSiteOrigin({ environment: { PUBLIC_SITE_URL: primaryOrigin, SITE_BASE_URL: 'https://example.org' } })).toThrow('SITE_ORIGIN_CONFLICT')
  })
  it('fails closed on an alternate production target or unsafe URL', () => {
    expect(() => resolveSiteOrigin({ environment: { SITE_BASE_URL: 'https://example.org' }, production: true })).toThrow('SITE_ORIGIN_NOT_PRIMARY')
    for (const value of ['https://example.org/path', 'https://example.org?token=secret', 'https://user:secret@example.org', 'file:///tmp/site']) {
      expect(() => resolveSiteOrigin({ environment: { PUBLIC_SITE_URL: value } })).toThrow('SITE_ORIGIN_INVALID')
    }
  })
})
