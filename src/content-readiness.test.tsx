import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { languagePreferenceKey } from './i18n'

vi.mock('./TutorialOriginal', () => ({ default: () => <section className="original">Captured source document</section> }))
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(languagePreferenceKey, 'zh')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ enabled: true, user: null, csrfToken: null })))
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); document.body.classList.remove('intro-open', 'modal-open'); window.history.replaceState({}, '', '/') })

describe('visible editorial guidance', () => {
  it.each(['zh', 'en'])('places specific reading guidance before the captured original in %s guides', async language => {
    const prefix = language === 'en' ? '/en' : ''
    window.history.replaceState({}, '', `${prefix}/tutorials/local-deployment-zero-to-output/`)
    render(<App />)
    await waitFor(() => expect(document.querySelector('.original')).not.toBeNull())
    const notes = screen.getByRole('heading', { name: language === 'en' ? 'Why this guide' : '为什么选这篇' })
    const original = document.querySelector('.original')!
    expect(notes.compareDocumentPosition(original) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.querySelector('.tutorial-site-notes-heading')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: language === 'en' ? 'Steps' : '执行步骤' })).toBeNull()
  })
  it('provides public case-reading guidance and keeps favorites focused on account data', () => {
    window.history.replaceState({}, '', '/')
    render(<App />)
    expect(screen.getByText('如何比较这些案例')).toBeDefined()
    cleanup()
    window.history.replaceState({}, '', '/?collection=favorites')
    render(<App />)
    expect(screen.queryByText('如何比较这些案例')).toBeNull()
  })
  it('does not place an advertising unit on a guide awaiting content review', () => {
    window.history.replaceState({}, '', '/tutorials/train-ref2va-lora/')
    render(<App />)
    expect(document.querySelector('[data-ad-placement]')).toBeNull()
  })
})
