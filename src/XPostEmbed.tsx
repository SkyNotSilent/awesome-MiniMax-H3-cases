import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'

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

let widgetLoader: Promise<XWidgets> | null = null

function loadXWidgets() {
  if (window.twttr?.widgets?.createTweet) return Promise.resolve(window.twttr.widgets)
  if (widgetLoader) return widgetLoader

  widgetLoader = new Promise<XWidgets>((resolve, reject) => {
    const finish = () => {
      if (window.twttr?.widgets?.createTweet) resolve(window.twttr.widgets)
      else reject(new Error('X widgets API unavailable'))
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-x-widgets="true"]')
    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => reject(new Error('X widgets failed to load')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.dataset.xWidgets = 'true'
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => reject(new Error('X widgets failed to load')), { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    widgetLoader = null
    throw error
  })

  return widgetLoader
}

function getPostId(sourceUrl: string) {
  return sourceUrl.match(/\/status\/(\d+)/)?.[1] ?? null
}

export function XPostEmbed({ sourceUrl, title }: { sourceUrl: string; title: string }) {
  const targetRef = useRef<HTMLDivElement>(null)
  const postId = useMemo(() => getPostId(sourceUrl), [sourceUrl])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const target = targetRef.current
    if (!target || !postId) {
      setStatus('error')
      return
    }

    target.replaceChildren()
    setStatus('loading')
    loadXWidgets()
      .then((widgets) => widgets.createTweet(postId, target, {
        align: 'center',
        cards: 'visible',
        conversation: 'none',
        dnt: true,
        theme: 'dark',
      }))
      .then((embed) => {
        if (!cancelled) setStatus(embed ? 'ready' : 'error')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [postId])

  return (
    <section className="x-embed-shell" data-state={status} aria-label={`${title} X 原帖播放器`}>
      <div className="x-embed-bar">
        <span><i aria-hidden="true" /> X 原帖播放器</span>
        <small>媒体由 X 提供</small>
      </div>
      <div ref={targetRef} className="x-embed-target" />
      {status === 'loading' && (
        <div className="x-embed-status" role="status">
          <LoaderCircle size={22} aria-hidden="true" /> 正在载入站内播放器…
        </div>
      )}
      {status === 'error' && (
        <p className="x-embed-error">当前网络或隐私设置阻止了 X 播放器。</p>
      )}
      <a className="x-embed-fallback" href={sourceUrl} target="_blank" rel="noreferrer">
        播放器受限时在 X 打开原帖 <ArrowUpRight size={14} />
      </a>
    </section>
  )
}
