import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'

interface XWidgets {
  createTweet: (
    tweetId: string,
    container: HTMLElement,
    options: Record<string, string | boolean>,
  ) => Promise<HTMLElement | undefined>
}

declare global {
  interface Window {
    twttr?: { widgets?: XWidgets }
  }
}

type EmbedStatus = 'loading' | 'slow' | 'ready' | 'error'
type EmbedLanguage = 'zh' | 'en'

const SLOW_AFTER_MS = 6_000
const FAIL_AFTER_MS = 20_000
const WIDGET_SCRIPT_TIMEOUT_MS = 12_000

let widgetLoader: Promise<XWidgets> | null = null

function loadXWidgets() {
  if (window.twttr?.widgets?.createTweet) return Promise.resolve(window.twttr.widgets)
  if (widgetLoader) return widgetLoader

  widgetLoader = new Promise<XWidgets>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-x-widgets="true"]')
    const script = existing ?? document.createElement('script')
    let settled = false
    let pollTimer = 0
    let timeoutTimer = 0

    const cleanup = () => {
      window.clearInterval(pollTimer)
      window.clearTimeout(timeoutTimer)
      script.removeEventListener('error', fail)
    }
    const finish = () => {
      const widgets = window.twttr?.widgets
      if (settled || !widgets?.createTweet) return
      settled = true
      cleanup()
      resolve(widgets)
    }
    const fail = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error('X widgets failed to load'))
    }

    script.addEventListener('error', fail, { once: true })
    pollTimer = window.setInterval(finish, 75)
    timeoutTimer = window.setTimeout(fail, WIDGET_SCRIPT_TIMEOUT_MS)

    if (!existing) {
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.dataset.xWidgets = 'true'
      document.head.appendChild(script)
    }

    finish()
  }).catch((error) => {
    widgetLoader = null
    throw error
  })

  return widgetLoader
}

function getPostId(sourceUrl: string) {
  return sourceUrl.match(/\/status\/(\d+)/)?.[1] ?? null
}

interface EmbedCopy {
  playerLabel: (title: string) => string
  posterAlt: (title: string) => string
  barTitle: string
  ready: string
  providedBy: string
  retry: string
  fallback: string
  states: Record<Exclude<EmbedStatus, 'ready'>, { eyebrow: string; title: string; detail: string }>
}

const copyByLanguage: Record<EmbedLanguage, EmbedCopy> = {
  zh: {
    playerLabel: (title) => `${title} X 原帖播放器`,
    posterAlt: (title) => `${title} 视频封面`,
    barTitle: 'X 原帖播放器',
    ready: '播放器已就绪',
    providedBy: '媒体由 X 提供',
    retry: '重新加载',
    fallback: '播放器受限时在 X 打开原帖',
    states: {
      loading: {
        eyebrow: '正在连接',
        title: '正在连接 X 播放器',
        detail: '视频封面已就绪，播放器通常会在 2–8 秒内出现。',
      },
      slow: {
        eyebrow: '响应较慢',
        title: 'X 响应较慢，仍在加载',
        detail: '网络或隐私设置可能延迟播放器；你可以继续等待。',
      },
      error: {
        eyebrow: '加载失败',
        title: '播放器加载失败',
        detail: '当前网络或隐私设置阻止了 X 播放器，请重试或打开原帖。',
      },
    },
  },
  en: {
    playerLabel: (title) => `${title} X post player`,
    posterAlt: (title) => `${title} video cover`,
    barTitle: 'X post player',
    ready: 'Player ready',
    providedBy: 'Media provided by X',
    retry: 'Reload player',
    fallback: 'Open the original post on X if the player is unavailable',
    states: {
      loading: {
        eyebrow: 'CONNECTING',
        title: 'Connecting to the X player',
        detail: 'The video cover is ready. The player usually appears within 2–8 seconds.',
      },
      slow: {
        eyebrow: 'SLOW RESPONSE',
        title: 'X is responding slowly',
        detail: 'Network or privacy settings may delay the player. You can keep waiting.',
      },
      error: {
        eyebrow: 'LOAD FAILED',
        title: 'Player failed to load',
        detail: 'Your network or privacy settings blocked the X player. Reload it or open the original post.',
      },
    },
  },
}

export function XPostEmbed({
  sourceUrl,
  title,
  posterUrl,
  language = 'zh',
}: {
  sourceUrl: string
  title: string
  posterUrl: string
  language?: EmbedLanguage
}) {
  const targetRef = useRef<HTMLDivElement>(null)
  const postId = useMemo(() => getPostId(sourceUrl), [sourceUrl])
  const [status, setStatus] = useState<EmbedStatus>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let expired = false
    const target = targetRef.current

    if (!target || !postId) {
      setStatus('error')
      return
    }

    const mount = document.createElement('div')
    mount.className = 'x-embed-mount'
    target.replaceChildren(mount)
    setStatus('loading')

    const slowTimer = window.setTimeout(() => {
      if (!cancelled && !expired) setStatus('slow')
    }, SLOW_AFTER_MS)
    const failTimer = window.setTimeout(() => {
      if (cancelled) return
      expired = true
      mount.remove()
      setStatus('error')
    }, FAIL_AFTER_MS)

    const settle = (nextStatus: 'ready' | 'error') => {
      if (cancelled || expired) return
      window.clearTimeout(slowTimer)
      window.clearTimeout(failTimer)
      setStatus(nextStatus)
    }

    loadXWidgets()
      .then((widgets) => widgets.createTweet(postId, mount, {
        align: 'center',
        cards: 'visible',
        conversation: 'none',
        dnt: true,
        lang: language === 'zh' ? 'zh-cn' : 'en',
        theme: 'dark',
      }))
      .then((embed) => settle(embed ? 'ready' : 'error'))
      .catch(() => settle('error'))

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
      window.clearTimeout(failTimer)
      if (mount.parentNode === target) target.replaceChildren()
    }
  }, [attempt, language, postId])

  const retry = () => {
    setStatus('loading')
    setAttempt((current) => current + 1)
  }

  const busy = status === 'loading' || status === 'slow'
  const uiCopy = copyByLanguage[language]
  const stateCopy = status === 'ready' ? null : uiCopy.states[status]

  return (
    <section
      className="x-embed-shell"
      data-state={status}
      aria-label={uiCopy.playerLabel(title)}
      aria-busy={busy}
    >
      <div className="x-embed-bar">
        <span><i aria-hidden="true" /> {uiCopy.barTitle}</span>
        <small>{status === 'ready' ? uiCopy.ready : uiCopy.providedBy}</small>
      </div>

      <div className="x-embed-stage">
        <img
          className="x-embed-poster"
          src={posterUrl}
          alt={uiCopy.posterAlt(title)}
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = '/posters/x-community.svg'
          }}
        />
        <span className="x-embed-scrim" aria-hidden="true" />
        <div ref={targetRef} className="x-embed-target" />

        {stateCopy && (
          <div
            className={`x-embed-status x-embed-status--${status}`}
            role={status === 'error' ? 'alert' : 'status'}
            aria-live={status === 'error' ? 'assertive' : 'polite'}
          >
            {status === 'error' ? (
              <TriangleAlert className="x-embed-alert" size={26} aria-hidden="true" />
            ) : (
              <span className="x-embed-loader" aria-hidden="true">
                <LoaderCircle size={34} />
                <i />
              </span>
            )}
            <span className="x-embed-status-copy">
              <small>{stateCopy.eyebrow}</small>
              <strong>{stateCopy.title}</strong>
              <span>{stateCopy.detail}</span>
            </span>
            {status === 'error' && (
              <button className="x-embed-retry" type="button" onClick={retry}>
                <RefreshCw size={14} aria-hidden="true" /> {uiCopy.retry}
              </button>
            )}
          </div>
        )}
      </div>

      <a className="x-embed-fallback" href={sourceUrl} target="_blank" rel="noreferrer">
        {uiCopy.fallback} <ArrowUpRight size={14} />
      </a>
    </section>
  )
}
