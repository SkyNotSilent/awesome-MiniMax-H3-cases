import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('MODE', 'production')
  vi.stubEnv('VITE_UMAMI_SCRIPT_URL', 'https://analytics.example/script.js')
  vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'test-site')
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  document.head.querySelectorAll('script[data-website-id]').forEach((node) => node.remove())
  delete window.umami
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('production analytics opt-out', () => {
  it('persists analytics=off before tracker initialization and across navigation', async () => {
    window.history.replaceState({}, '', '/?analytics=off')
    const analytics = await import('./analytics')
    const send = vi.fn()
    window.umami = { track: send }
    analytics.initAnalytics()
    expect(localStorage.getItem('umami.disabled')).toBe('1')
    window.history.replaceState({}, '', '/en/')
    analytics.initAnalytics()
    analytics.track('case-open', { caseId: 'example' })
    expect(document.head.querySelector('script[data-website-id]')).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })

  it('honors the flag injected by browser tests without a URL parameter', async () => {
    localStorage.setItem('umami.disabled', '1')
    const analytics = await import('./analytics')
    analytics.initAnalytics()
    expect(document.head.querySelector('script[data-website-id]')).toBeNull()
  })

  it('still opts out when storage throws', async () => {
    window.history.replaceState({}, '', '/?analytics=off')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const analytics = await import('./analytics')
    analytics.initAnalytics()
    expect(document.head.querySelector('script[data-website-id]')).toBeNull()
  })

  it('does not send queued events if opted out before the script finishes loading', async () => {
    const analytics = await import('./analytics')
    analytics.initAnalytics()
    analytics.track('case-open')
    const send = vi.fn()
    window.umami = { track: send }
    localStorage.setItem('umami.disabled', '1')
    document.head.querySelector('script[data-website-id]')!.dispatchEvent(new Event('load'))
    expect(send).not.toHaveBeenCalled()
  })

  it('keeps tracking available for ordinary visitors', async () => {
    const analytics = await import('./analytics')
    analytics.initAnalytics()
    expect(document.head.querySelector('script[data-website-id]')).not.toBeNull()
    const send = vi.fn()
    window.umami = { track: send }
    analytics.track('case-open')
    expect(send).toHaveBeenCalledWith('case-open', undefined)
  })
})
