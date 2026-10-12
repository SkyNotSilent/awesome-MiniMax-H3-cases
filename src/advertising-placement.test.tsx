import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { languagePreferenceKey } from './i18n'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(languagePreferenceKey, 'zh')
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ enabled: false, user: null, csrfToken: null })))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
  document.body.classList.remove('intro-open', 'modal-open')
  localStorage.clear()
})

describe('advertising positions in the public library', () => {
  it.each(['/', '/en/'])('places one directory unit after exactly twelve real cards at %s', async path => {
    window.history.replaceState({}, '', path)
    render(<App />)
    await waitFor(() => expect(document.querySelectorAll('.case-card:not(.case-card-skeleton)').length).toBeGreaterThanOrEqual(12))
    const grid = document.querySelector('.case-grid')!
    expect(grid.children[12].getAttribute('data-ad-placement')).toBe('catalog')
    expect(grid.querySelectorAll('[data-ad-placement]')).toHaveLength(1)
    expect(grid.children[12].textContent).toContain(path === '/' ? '广告' : 'Advertisement')
    expect(document.querySelector('#h3-adsense-script')).toBeNull()
  })

  it('retains the same ad element when a public filter changes the cards', async () => {
    render(<App />)
    await waitFor(() => expect(document.querySelectorAll('.case-card:not(.case-card-skeleton)').length).toBeGreaterThanOrEqual(12))
    fireEvent.click(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ }))
    const unit = document.querySelector('[data-ad-placement]')
    const excluded = document.querySelectorAll('.case-card .mode-line > span:first-child')[11].textContent!.split(' / ')[1]
    const filter = [...document.querySelectorAll<HTMLButtonElement>('[data-filter-kind="category"] button')].find(button => {
      const label = button.querySelector('span')?.textContent
      return label !== '全部' && label !== excluded && Number(button.querySelector('small')?.textContent) >= 12
    })!
    expect(filter).toBeDefined()
    const selected = filter.querySelector('span')!.textContent
    fireEvent.click(filter)
    await waitFor(() => {
      expect(document.querySelectorAll('.case-card:not(.case-card-skeleton)').length).toBeGreaterThanOrEqual(12)
      expect([...document.querySelectorAll('.case-card .mode-line > span:first-child')].every(node => node.textContent!.endsWith(` / ${selected}`))).toBe(true)
    })
    expect(document.querySelector('[data-ad-placement]')).toBe(unit)
  })

  it.each(['/?collection=favorites', '/?importFavorites=1', '/?q=definitely-no-matching-video-zzzz'])('omits directory units for private imports, favorites and short results at %s', path => {
    window.history.replaceState({}, '', path)
    render(<App />)
    expect(document.querySelector('[data-ad-placement]')).toBeNull()
    expect(document.querySelector('#h3-adsense-script')).toBeNull()
  })
})
