// Shared by React and the standalone pages. No account or analytics data enters here.
export function createAdvertisingRuntime(view) {
  const document = view.document
  const mounts = new WeakMap()
  const active = new Set()
  const requestedPlacements = new Set()
  let scriptPromise
  let consentPromise
  let revoking = false

  const config = () => view.fetch('/ads-config.json', { credentials: 'omit', cache: 'no-store' })
    .then(response => response.ok ? response.json() : null).catch(() => null)

  const eligible = (settings, wrapper) => {
    const params = new URLSearchParams(view.location.search)
    return Boolean(settings?.enabled && settings.origin === view.location.origin && view.location.protocol === 'https:'
      && /^ca-pub-\d{16}$/.test(settings.client) && /^\d{10}$/.test(settings.slots?.[wrapper.dataset.adPlacement] ?? '')
      && settings.approvedPaths?.includes(view.location.pathname) && params.get('collection') !== 'favorites'
      && params.get('importFavorites') !== '1' && !revoking)
  }

  function usStatus() {
    const api = view.googlefc?.usstatesoptout
    if (typeof api?.getInitialUsStatesOptOutStatus !== 'function' || !api.InitialUsStatesOptOutStatusEnum) return null
    const status = api.getInitialUsStatesOptOutStatus()
    const values = api.InitialUsStatesOptOutStatusEnum
    return status === values.DOES_NOT_APPLY ? false : [values.NOT_OPTED_OUT, values.OPTED_OUT].includes(status) ? true : null
  }

  function updatePrivacyControls() {
    const applies = usStatus()
    for (const button of document.querySelectorAll('[data-ad-privacy]')) {
      button.hidden = button.hasAttribute('data-ad-us-privacy') ? applies !== true : applies === true
    }
  }

  function refreshPrivacyControls() {
    if (scriptPromise) view.googlefc.callbackQueue.push({ INITIAL_US_STATES_OPT_OUT_DATA_READY: updatePrivacyControls })
  }

  function loadScript(settings) {
    return scriptPromise ??= new Promise(resolve => {
      view.googlefc ??= {}
      view.googlefc.callbackQueue ??= []
      view.googlefc.usstatesoptout ??= {}
      view.googlefc.usstatesoptout.overrideDnsLink = true
      view.googlefc.callbackQueue.push({ INITIAL_US_STATES_OPT_OUT_DATA_READY: updatePrivacyControls })
      const script = document.createElement('script')
      script.id = 'h3-adsense-script'
      script.async = true
      script.crossOrigin = 'anonymous'
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${settings.client}`
      const timer = view.setTimeout(() => resolve(false), 12_000)
      script.onload = () => { view.clearTimeout(timer); resolve(true) }
      script.onerror = () => { view.clearTimeout(timer); resolve(false) }
      document.head.append(script)
    })
  }

  function consent(settings) {
    return consentPromise ??= new Promise(resolve => {
      // The AdSense tag deploys the published Google CMP. Until its consent
      // callback arrives, no ad unit is submitted. Google handles TCF/GPP signals.
      view.googlefc ??= {}
      view.googlefc.callbackQueue ??= []
      view.googlefc.callbackQueue.push({ CONSENT_DATA_READY: () => {
        if (typeof view.__tcfapi !== 'function') { resolve(true); return }
        view.__tcfapi('addEventListener', 2.2, (data, success) => {
          if (!success || !data || data.cmpStatus === 'error') { resolve(false); return }
          if (data.gdprApplies === false) { resolve(true); return }
          if (data.gdprApplies !== true || !['tcloaded', 'useractioncomplete'].includes(data.eventStatus)) return
          // A refusal to storage or Google's vendor consent suppresses this
          // site's slots. Other consent purposes remain Google's responsibility.
          resolve(Boolean(data.purpose?.consents?.[1] && data.vendor?.consents?.[755]))
          if (data.listenerId != null) view.__tcfapi('removeEventListener', 2.2, () => {}, data.listenerId)
        })
      } })
      void loadScript(settings).then(loaded => { if (!loaded) resolve(false) })
    })
  }

  function mount(wrapper) {
    if (mounts.has(wrapper)) return mounts.get(wrapper)
    const placementKey = () => `${view.location.pathname}:${wrapper.dataset.adPlacement}`
    let disposed = false
    let observer
    let statusObserver
    let requested = false
    const hide = () => { wrapper.hidden = true; wrapper.dataset.adState = 'unavailable' }
    const cleanup = () => {
      disposed = true
      observer?.disconnect()
      statusObserver?.disconnect()
      active.delete(wrapper)
      mounts.delete(wrapper)
      hide()
    }
    mounts.set(wrapper, cleanup)
    active.add(wrapper)
    const request = async settings => {
      if (requested || disposed || !wrapper.isConnected || !eligible(settings, wrapper)) return
      requested = true
      observer?.disconnect()
      const allowed = await consent(settings)
      if (disposed || !wrapper.isConnected) return
      const currentSettings = allowed ? await config() : null
      if (disposed || !wrapper.isConnected) return
      if (!allowed || !eligible(currentSettings, wrapper) || currentSettings.client !== settings.client) { hide(); return }
      if (requestedPlacements.has(placementKey())) { hide(); return }
      const unit = wrapper.querySelector('ins')
      if (!unit || unit.dataset.adsbygoogleStatus) return
      unit.dataset.adClient = settings.client
      unit.dataset.adSlot = currentSettings.slots[wrapper.dataset.adPlacement]
      wrapper.dataset.adState = 'loading'
      statusObserver = new view.MutationObserver(() => {
        if (unit.dataset.adStatus === 'unfilled') hide()
        if (unit.dataset.adStatus === 'filled') wrapper.dataset.adState = 'filled'
      })
      statusObserver.observe(unit, { attributes: true, attributeFilter: ['data-ad-status'] })
      requestedPlacements.add(placementKey())
      try { (view.adsbygoogle ??= []).push({}) } catch { hide() }
    }
    void config().then(settings => {
      if (disposed || !wrapper.isConnected || !eligible(settings, wrapper)) return
      if (requestedPlacements.has(placementKey())) { hide(); return }
      wrapper.hidden = false
      wrapper.dataset.adState = 'waiting'
      if (typeof view.IntersectionObserver !== 'function') { void request(settings); return }
      observer = new view.IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) void request(settings)
      }, { rootMargin: '300px' })
      observer.observe(wrapper)
    })
    return cleanup
  }

  async function privacy(button) {
    const settings = await config()
    const showFallback = () => {
      const status = button.parentElement?.querySelector('[data-ad-privacy-status]')
      if (status) status.textContent = button.dataset.adPrivacy === 'zh'
        ? '广告尚未启用，或隐私服务不可用。可通过隐私说明中的 Google 广告设置管理个性化广告。'
        : 'Ads are disabled or the privacy service is unavailable. Google Ads Settings is linked in our privacy policy.'
    }
    if (!settings?.enabled || settings.origin !== view.location.origin) { showFallback(); return }
    if (!await loadScript(settings)) { showFallback(); return }
    const open = () => {
      updatePrivacyControls()
      const applies = usStatus()
      const us = view.googlefc.usstatesoptout
      if (applies === true && typeof us.openConfirmationDialog !== 'function') { showFallback(); return }
      if (applies !== true && typeof view.googlefc.showRevocationMessage !== 'function') { showFallback(); return }
      revoking = true
      for (const wrapper of active) { wrapper.hidden = true; wrapper.querySelector('ins')?.replaceChildren() }
      if (applies === true) us.openConfirmationDialog(() => {})
      else view.googlefc.showRevocationMessage()
    }
    view.googlefc.callbackQueue.push({ CONSENT_API_READY: () => {
      if (typeof view.googlefc.usstatesoptout?.getInitialUsStatesOptOutStatus === 'function') {
        view.googlefc.callbackQueue.push({ INITIAL_US_STATES_OPT_OUT_DATA_READY: () => { if (usStatus() == null) showFallback(); else open() } })
      } else open()
    } })
  }

  return {
    mount,
    privacy,
    refreshPrivacyControls,
    mountStatic: () => {
      for (const wrapper of document.querySelectorAll('[data-ad-placement]')) mount(wrapper)
      for (const button of document.querySelectorAll('[data-ad-privacy]')) button.addEventListener('click', () => { void privacy(button) })
      refreshPrivacyControls()
    },
  }
}
