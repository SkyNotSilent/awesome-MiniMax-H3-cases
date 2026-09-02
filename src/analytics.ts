export type AnalyticsEvent =
  | 'case-open'
  | 'video-play'
  | 'outbound-click'
  | 'copy-prompt'
  | 'copy-command'
  | 'copy-tutorial'
  | 'search'
  | 'filter-change'
  | 'language-switch'
  | 'favorite-toggle'

export type AnalyticsProps = Record<string, string | number | boolean>

const PENDING_EVENT_CAP = 20

const scriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL
const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID
const enabled = import.meta.env.MODE !== 'test' && Boolean(scriptUrl) && Boolean(websiteId)
const pending: Array<[AnalyticsEvent, AnalyticsProps | undefined]> = []

const flushPending = () => {
  while (pending.length > 0) {
    const [event, props] = pending.shift()!
    window.umami?.track(event, props)
  }
}

export const track = (event: AnalyticsEvent, props?: AnalyticsProps) => {
  if (!enabled) return
  try {
    if (window.umami?.track) {
      window.umami.track(event, props)
    } else if (pending.length < PENDING_EVENT_CAP) {
      pending.push([event, props])
    }
  } catch {
    // Analytics must never break the page; blocked trackers drop events silently.
  }
}

export const outboundFromEventTarget = (target: EventTarget | null): AnalyticsProps | null => {
  if (!(target instanceof Element)) return null
  const anchor = target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement)) return null
  if (anchor.protocol !== 'http:' && anchor.protocol !== 'https:') return null
  if (anchor.origin === window.location.origin) return null
  return { domain: anchor.hostname, url: `${anchor.origin}${anchor.pathname}` }
}

export const initAnalytics = () => {
  if (!enabled || !scriptUrl || !websiteId) return
  if (document.querySelector(`script[data-website-id='${websiteId}']`)) return
  const script = document.createElement('script')
  script.defer = true
  script.src = scriptUrl
  script.dataset.websiteId = websiteId
  script.addEventListener('load', flushPending)
  document.head.append(script)
  document.addEventListener('click', (event) => {
    const outbound = outboundFromEventTarget(event.target)
    if (outbound) track('outbound-click', outbound)
  })
}
