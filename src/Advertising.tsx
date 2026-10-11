import { useEffect, useRef } from 'react'
import { createAdvertisingRuntime } from '../shared/advertising-runtime.mjs'
import type { Language } from './i18n'

const runtime = createAdvertisingRuntime(window)

export function AdSlot({ placement, language }: { placement: 'catalog' | 'tutorial'; language: Language }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) return runtime.mount(ref.current)
  }, [])
  return <div ref={ref} className="h3-ad-slot" data-ad-placement={placement} hidden>
    <small>{language === 'zh' ? '广告' : 'Advertisement'}</small>
    <ins className="adsbygoogle" data-ad-format="auto" data-full-width-responsive="true" />
  </div>
}

export function SiteLinks({ language }: { language: Language }) {
  const zh = language === 'zh'
  const prefix = zh ? '' : '/en'
  return <nav className="h3-site-links" aria-label={zh ? '网站说明' : 'Site information'}>
    <a href={`${prefix}/about/`}>{zh ? '关于本站' : 'About'}</a>
    <a href={`${prefix}/contact/`}>{zh ? '联系与版权' : 'Contact and copyright'}</a>
    <a href="/privacy.html">{zh ? '隐私说明' : 'Privacy policy'}</a>
    <button type="button" data-ad-privacy={language} onClick={event => { void runtime.privacy(event.currentTarget) }}>{zh ? '广告隐私选择' : 'Ad privacy choices'}</button>
    <span data-ad-privacy-status="" aria-live="polite" />
  </nav>
}
