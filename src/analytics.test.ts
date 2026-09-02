import { describe, expect, it } from 'vitest'
import { initAnalytics, outboundFromEventTarget, track } from './analytics'

const renderAnchor = (html: string): Element => {
  document.body.innerHTML = html
  return document.body.querySelector('[data-probe]')!
}

describe('outboundFromEventTarget', () => {
  it('reports external http(s) links with query and hash stripped', () => {
    const target = renderAnchor(
      '<a href="https://x.com/user/status/123?ref=abc#top"><span data-probe>open</span></a>',
    )
    expect(outboundFromEventTarget(target)).toEqual({
      domain: 'x.com',
      url: 'https://x.com/user/status/123',
    })
  })

  it('ignores same-origin links', () => {
    const target = renderAnchor(`<a data-probe href="${window.location.origin}/cases/demo/">demo</a>`)
    expect(outboundFromEventTarget(target)).toBeNull()
  })

  it('ignores non-http protocols and non-anchor targets', () => {
    expect(outboundFromEventTarget(renderAnchor('<a data-probe href="mailto:hi@example.com">mail</a>'))).toBeNull()
    expect(outboundFromEventTarget(renderAnchor('<button data-probe>plain</button>'))).toBeNull()
    expect(outboundFromEventTarget(null)).toBeNull()
  })
})

describe('analytics test-mode gate', () => {
  it('does not inject the tracker script or throw when tracking', () => {
    initAnalytics()
    expect(document.head.querySelector('script[data-website-id]')).toBeNull()
    expect(() => track('case-open', { caseId: 'demo' })).not.toThrow()
  })
})
