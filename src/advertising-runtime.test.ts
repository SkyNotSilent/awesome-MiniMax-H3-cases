import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdvertisingRuntime } from '../shared/advertising-runtime.mjs'

const origin = 'https://awesome-minimax-h3-cases.zzskysilent.com'
const settings = { enabled: true, origin, client: 'ca-pub-1234567890123456', slots: { catalog: '1234567890', tutorial: '0987654321' }, approvedPaths: ['/', '/en/', '/tutorials/good-guide/'] }
const cleanups: Array<() => void> = []
type QueueEntry = { CONSENT_DATA_READY?: () => void; CONSENT_API_READY?: () => void; INITIAL_US_STATES_OPT_OUT_DATA_READY?: () => void }

function setup(path = '/', config = settings) {
  const url = new URL(path, origin)
  const fc = { callbackQueue: [] as QueueEntry[], showRevocationMessage: vi.fn(), usstatesoptout: undefined as undefined | { overrideDnsLink?: boolean; getInitialUsStatesOptOutStatus?: () => number; InitialUsStatesOptOutStatusEnum?: { DOES_NOT_APPLY: number; NOT_OPTED_OUT: number; OPTED_OUT: number }; openConfirmationDialog?: (callback: (optedOut: boolean) => void) => void } }
  const view = {
    document, location: url,
    fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => config }),
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    MutationObserver: window.MutationObserver, googlefc: fc, adsbygoogle: [] as object[],
    __tcfapi: undefined as undefined | ((command: string, version: number, callback: (data: object, success: boolean) => void) => void),
  }
  const runtime = createAdvertisingRuntime(view as unknown as Window)
  const wrapper = document.createElement('div')
  wrapper.dataset.adPlacement = 'catalog'
  wrapper.hidden = true
  wrapper.innerHTML = '<ins class="adsbygoogle"></ins>'
  document.body.append(wrapper)
  cleanups.push(runtime.mount(wrapper))
  return { runtime, wrapper, view, fc }
}

async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve() }
function loaded() { document.querySelector<HTMLScriptElement>('#h3-adsense-script')?.dispatchEvent(new Event('load')) }

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  document.body.replaceChildren()
  document.head.querySelectorAll('#h3-adsense-script').forEach(script => script.remove())
  vi.restoreAllMocks()
})

describe('manual advertising requests', () => {
  it('does not load Google for disabled ads, unapproved pages, favorites or old imports', async () => {
    for (const path of ['/cases/example/', '/?collection=favorites', '/?importFavorites=1']) setup(path)
    setup('/', { ...settings, enabled: false })
    await flush()
    expect(document.querySelector('#h3-adsense-script')).toBeNull()
    expect([...document.querySelectorAll<HTMLElement>('[data-ad-placement]')].every(node => node.hidden)).toBe(true)
  })

  it('rejects a preview origin even if config is incorrectly enabled', async () => {
    const { view } = setup()
    view.location = new URL('https://preview.example.test/')
    await flush()
    expect(document.querySelector('#h3-adsense-script')).toBeNull()
  })

  it('waits for CMP data and initializes each unit once', async () => {
    const { runtime, wrapper, view, fc } = setup()
    await flush(); loaded(); await flush()
    expect(view.adsbygoogle).toHaveLength(0)
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(view.adsbygoogle).toHaveLength(1)
    runtime.mount(wrapper)
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(view.adsbygoogle).toHaveLength(1)
    expect(document.querySelectorAll('#h3-adsense-script')).toHaveLength(1)
  })

  it('does not refresh ads after a filter removes and restores the same placement', async () => {
    const { runtime, wrapper, view, fc } = setup()
    await flush(); loaded()
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(view.adsbygoogle).toHaveLength(1)
    cleanups.pop()?.()
    wrapper.remove()
    const restored = document.createElement('div')
    restored.dataset.adPlacement = 'catalog'
    restored.hidden = true
    restored.innerHTML = '<ins class="adsbygoogle"></ins>'
    document.body.append(restored)
    cleanups.push(runtime.mount(restored))
    await flush()
    expect(view.adsbygoogle).toHaveLength(1)
    expect(restored.hidden).toBe(true)
  })

  it('suppresses requests when the user refuses TCF storage consent', async () => {
    const { wrapper, view, fc } = setup()
    view.__tcfapi = (_command, _version, callback) => callback({ gdprApplies: true, eventStatus: 'useractioncomplete', purpose: { consents: { 1: false } }, vendor: { consents: { 755: true } } }, true)
    await flush(); loaded()
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(view.adsbygoogle).toHaveLength(0)
    expect(wrapper.hidden).toBe(true)
  })

  it('permits a consented TCF request and removes its listener', async () => {
    const { view, fc } = setup()
    const remove = vi.fn()
    view.__tcfapi = (command, _version, callback) => {
      if (command === 'removeEventListener') { remove(); return }
      callback({ listenerId: 7, gdprApplies: true, eventStatus: 'useractioncomplete', purpose: { consents: { 1: true } }, vendor: { consents: { 755: true } } }, true)
    }
    await flush(); loaded()
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(view.adsbygoogle).toHaveLength(1)
    expect(remove).toHaveBeenCalledOnce()
  })

  it('does not submit a stale request after unmount or switching into favorites', async () => {
    const { wrapper, view, fc } = setup()
    await flush(); loaded()
    view.location = new URL('/?collection=favorites', origin)
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(wrapper.hidden).toBe(true)
    expect(view.adsbygoogle).toHaveLength(0)
  })

  it('honors the rollback switch changed while the consent message was open', async () => {
    const { wrapper, view, fc } = setup()
    await flush(); loaded()
    view.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...settings, enabled: false }) })
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(wrapper.hidden).toBe(true)
    expect(view.adsbygoogle).toHaveLength(0)
  })

  it('does not start the provider before the unit reaches the viewport', async () => {
    const { view, fc } = setup()
    let intersect: (() => void) | undefined
    Object.assign(view, { IntersectionObserver: class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { intersect = () => callback([{ isIntersecting: true }]) }
      observe() {}
      disconnect() {}
    } })
    await flush()
    expect(document.querySelector('#h3-adsense-script')).toBeNull()
    intersect?.()
    await flush(); loaded()
    fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    expect(view.adsbygoogle).toHaveLength(1)
  })

  it('hides failed and unfilled units without affecting other content', async () => {
    const first = setup()
    await flush()
    document.querySelector('#h3-adsense-script')?.dispatchEvent(new Event('error'))
    await flush()
    expect(first.wrapper.hidden).toBe(true)
    expect(first.view.adsbygoogle).toHaveLength(0)
    document.querySelector('#h3-adsense-script')?.remove()
    const second = setup('/en/')
    await flush(); loaded()
    second.fc.callbackQueue.find(entry => entry.CONSENT_DATA_READY)?.CONSENT_DATA_READY?.()
    await flush()
    second.wrapper.querySelector('ins')!.dataset.adStatus = 'unfilled'
    await flush()
    expect(second.wrapper.hidden).toBe(true)
  })

  it('shows a US opt-out entry and uses its confirmation API instead of EU revocation', async () => {
    const { runtime, wrapper, fc } = setup()
    const open = vi.fn()
    fc.usstatesoptout = { getInitialUsStatesOptOutStatus: () => 2, InitialUsStatesOptOutStatusEnum: { DOES_NOT_APPLY: 1, NOT_OPTED_OUT: 2, OPTED_OUT: 3 }, openConfirmationDialog: open }
    const nav = document.createElement('nav')
    nav.innerHTML = '<button data-ad-privacy="en">Ad privacy choices</button><button data-ad-privacy="en" data-ad-us-privacy hidden>Do not sell or share my personal information</button><span data-ad-privacy-status></span>'
    document.body.append(nav)
    await flush(); loaded(); await flush()
    for (const entry of [...fc.callbackQueue]) entry.INITIAL_US_STATES_OPT_OUT_DATA_READY?.()
    expect(fc.usstatesoptout.overrideDnsLink).toBe(true)
    expect(nav.querySelector<HTMLButtonElement>('[data-ad-us-privacy]')!.hidden).toBe(false)
    expect(nav.querySelector<HTMLButtonElement>('button')!.hidden).toBe(true)
    await runtime.privacy(nav.querySelector('[data-ad-us-privacy]')!)
    fc.callbackQueue.find(entry => entry.CONSENT_API_READY)?.CONSENT_API_READY?.()
    for (const entry of [...fc.callbackQueue]) entry.INITIAL_US_STATES_OPT_OUT_DATA_READY?.()
    expect(open).toHaveBeenCalledOnce()
    expect(fc.showRevocationMessage).not.toHaveBeenCalled()
    expect(wrapper.hidden).toBe(true)
  })

  it('retains the EU entry when US rules do not apply', async () => {
    const { runtime, fc } = setup()
    fc.usstatesoptout = { getInitialUsStatesOptOutStatus: () => 1, InitialUsStatesOptOutStatusEnum: { DOES_NOT_APPLY: 1, NOT_OPTED_OUT: 2, OPTED_OUT: 3 }, openConfirmationDialog: vi.fn() }
    const nav = document.createElement('nav')
    nav.innerHTML = '<button data-ad-privacy="zh">广告隐私选择</button><button data-ad-privacy="zh" data-ad-us-privacy hidden>不出售或分享我的个人信息</button>'
    document.body.append(nav)
    await flush(); loaded(); await flush()
    await runtime.privacy(nav.querySelector('button')!)
    fc.callbackQueue.find(entry => entry.CONSENT_API_READY)?.CONSENT_API_READY?.()
    for (const entry of [...fc.callbackQueue]) entry.INITIAL_US_STATES_OPT_OUT_DATA_READY?.()
    expect(nav.querySelector<HTMLButtonElement>('button')!.hidden).toBe(false)
    expect(nav.querySelector<HTMLButtonElement>('[data-ad-us-privacy]')!.hidden).toBe(true)
    expect(fc.showRevocationMessage).toHaveBeenCalledOnce()
    expect(fc.usstatesoptout.openConfirmationDialog).not.toHaveBeenCalled()
  })

  it('hides active units before reopening consent and explains disabled privacy controls', async () => {
    const { runtime, wrapper, fc } = setup()
    await flush(); loaded()
    const container = document.createElement('nav')
    container.innerHTML = '<button data-ad-privacy="en"></button><span data-ad-privacy-status role="status"></span>'
    document.body.append(container)
    await runtime.privacy(container.querySelector('button')!)
    fc.callbackQueue.find(entry => entry.CONSENT_API_READY)?.CONSENT_API_READY?.()
    expect(fc.showRevocationMessage).toHaveBeenCalledOnce()
    expect(wrapper.hidden).toBe(true)
    const disabled = setup('/', { ...settings, enabled: false })
    await disabled.runtime.privacy(container.querySelector('button')!)
    expect(container.textContent).toContain('Ads are disabled')
  })
})
