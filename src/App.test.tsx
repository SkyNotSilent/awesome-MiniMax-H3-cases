import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { languagePreferenceKey } from './i18n'
import {
  caseUpdatesSeenThroughKey,
  legacyUpdatesSeenThroughKey,
  tutorialUpdatesSeenThroughKey,
  updateSessionStorageKey,
} from './updates'

vi.mock('../data/cases.json', async (importOriginal) => {
  const original = await importOriginal<typeof import('../data/cases.json')>()
  const originalCases = (original as unknown as { default: Array<{ id: string }> }).default
  const fixtureIds = new Set([
    'official-t2va-starship',
    'official-ref2va-lamb',
    'official-fl2va-ramen',
    'x-icreat-time-freeze-diner',
    'x-2087443463432466682',
    'x-yukyuk-h3-seedance-same-prompt',
    'x-2086641782839005498',
    'x-2090180874222588332',
    'x-2086477914699170293',
  ])

  return {
    default: originalCases.filter((item) => fixtureIds.has(item.id)),
  }
})

function renderAt(pathname: string) {
  window.history.replaceState({}, '', pathname)
  return render(<App />)
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.localStorage.setItem(languagePreferenceKey, 'zh')
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState({}, '', '/')
  document.body.classList.remove('intro-open', 'modal-open')
  window.localStorage.clear()
  window.sessionStorage.clear()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  delete window.twttr
})

describe('case-first routes', () => {
  it('renders the case browser underneath a two-second intro and then removes the intro', () => {
    vi.useFakeTimers()
    renderAt('/')

    expect(document.querySelector('.intro-splash')).toHaveAttribute('aria-label', 'MiniMax H3 Cases & Guides')
    expect(screen.getByRole('heading', { name: '先看 MiniMax H3 的真实效果。' })).toBeInTheDocument()
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_600))
    expect(document.querySelector('.intro-splash')).toHaveClass('is-leaving')
    act(() => vi.advanceTimersByTime(500))
    expect(document.querySelector('.intro-splash')).not.toBeInTheDocument()
  })

  it('frames the intro with the prompt split and daily update rhythm', () => {
    renderAt('/')

    expect(Number(document.querySelector('.intro-proof-cases strong')?.textContent)).toBeGreaterThan(0)
    expect(document.querySelector('.intro-proof-cases em')).toHaveTextContent('完整公开 Prompt')
    expect(document.querySelector('.intro-proof-cases em')).toHaveTextContent('来源未公开完整 Prompt')
    expect(document.querySelector('.intro-proof-update strong')).toHaveTextContent('DAILY')
    expect(screen.getByText('每天持续更新')).toBeInTheDocument()
    expect(screen.getByText('持续发现 · 核验 · 发布')).toBeInTheDocument()
    expect(document.querySelector('.intro-proof-connection path')).toBeInTheDocument()
    expect(screen.getByText(/个真实案例，每天持续增长/)).toBeInTheDocument()
  })

  it('dismisses the intro immediately when the visitor interacts', () => {
    renderAt('/')

    expect(document.querySelector('.intro-splash')).toHaveAttribute('aria-label', 'MiniMax H3 Cases & Guides')
    fireEvent.pointerDown(window)

    expect(document.querySelector('.intro-splash')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('intro-open')
  })

  it('dismisses the intro immediately on wheel or swipe intent', () => {
    renderAt('/')

    fireEvent.wheel(window, { deltaY: 120 })

    expect(document.querySelector('.intro-splash')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('intro-open')
  })

  it('switches language in place without replaying the intro or reloading the document', () => {
    renderAt('/')
    fireEvent.pointerDown(window)
    expect(document.querySelector('.intro-splash')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '切换到英文' }))
    expect(window.location.pathname).toBe('/en/')
    expect(screen.getByRole('heading', { name: 'See what MiniMax H3 actually makes.' })).toBeInTheDocument()
    expect(document.querySelector('.intro-splash')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Switch to Chinese' }))
    expect(window.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: '先看 MiniMax H3 的真实效果。' })).toBeInTheDocument()
    expect(window.localStorage.getItem(languagePreferenceKey)).toBe('zh')
  })

  it('keeps the home page focused on cases and removes template and collection-method sections', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: '案例' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: '教程' })).toHaveAttribute('href', '/tutorials/')
    expect(screen.getByRole('link', { name: '创作者' })).toHaveAttribute('href', '/creators/')
    expect(screen.getByRole('link', { name: '常见问题' })).toHaveAttribute('href', '/faq/')
    expect(screen.getByRole('link', { name: '在 GitHub 查看源码' })).toHaveAttribute(
      'href',
      'https://github.com/SkyNotSilent/awesome-minimax-h3-cases',
    )
    expect(screen.getByRole('link', { name: 'MiniMax H3 Cases & Guides' }).querySelector('img')).toHaveAttribute(
      'src',
      '/icon.svg',
    )
    expect(screen.queryByText('从单个案例，提炼可复用镜头协议。')).not.toBeInTheDocument()
    expect(screen.queryByText('收录方式')).not.toBeInTheDocument()
    expect(screen.queryByText('从案例，走到真正跑起来。')).not.toBeInTheDocument()
  })

  it('renders translated style and scene chips without duplicate React keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderAt('/')

    const duplicateKeyWarning = consoleError.mock.calls.some((call) => call.join(' ').includes('same key'))
    expect(duplicateKeyWarning).toBe(false)
    consoleError.mockRestore()
  })

  it('uses duration as the primary case filter', () => {
    renderAt('/')
    expect(screen.queryByRole('button', { name: /全模态参考/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /5 秒及以下/ }))
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /6–10 秒/ }))
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
    expect(screen.queryByText('粉色西装与黑色羔羊')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /11–15 秒/ }))
    expect(screen.getByText('餐厅时间冻结与逆向复原')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /超过 15 秒/ }))
    expect(screen.getByText('羊皮纸上的绝地光明史诗')).toBeInTheDocument()
    expect(screen.queryByText('餐厅时间冻结与逆向复原')).not.toBeInTheDocument()
  })

  it('filters to complete public prompts and composes with duration filters', () => {
    renderAt('/')
    const promptSwitch = screen.getByRole('switch', { name: '只看有 Prompt' })
    expect(promptSwitch).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('同提示词 H3 与 Seedance 对比')).toBeInTheDocument()

    fireEvent.click(promptSwitch)
    expect(promptSwitch).toHaveAttribute('aria-checked', 'true')
    expect(window.location.search).toBe('?prompt=1')
    expect(screen.queryByText('同提示词 H3 与 Seedance 对比')).not.toBeInTheDocument()
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /5 秒及以下/ }))
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
  })

  it('restores the prompt-only switch from the public URL', () => {
    renderAt('/?prompt=1')
    expect(screen.getByRole('switch', { name: '只看有 Prompt' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText('同提示词 H3 与 Seedance 对比')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '切换到英文' })).toHaveAttribute('href', '/en/?prompt=1')
  })

  it('combines shareable quick collections with the primary filters', () => {
    renderAt('/?collection=official')
    expect(screen.getByRole('button', { name: '官方案例' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
    expect(screen.queryByText('餐厅时间冻结与逆向复原')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /5 秒及以下/ }))
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?collection=official')
  })

  it('renders editor picks from the explicit ordered catalog without requiring a Prompt', () => {
    renderAt('/?collection=featured')

    const cards = [...document.querySelectorAll('.case-card')]
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => card.querySelector('h2')?.textContent)).toEqual([
      '粉色西装与黑色羔羊',
      '舰桥上的跃迁余震',
      '同提示词 H3 与 Seedance 对比',
    ])
    expect(cards.every((card) => card.querySelector('.featured-label')?.textContent === '精选')).toBe(true)
    expect(screen.queryByText('餐厅时间冻结与逆向复原')).not.toBeInTheDocument()
  })

  it('treats quick collections as isolated folders that reset the filters above them', () => {
    renderAt('/')
    const collections = screen.getByRole('group', { name: '快速集合' })
    expect(within(collections).queryByRole('button', { name: '全部案例' })).not.toBeInTheDocument()
    expect(within(collections).getAllByRole('button').map((button) => button.textContent)).toEqual([
      '编辑精选', '最新收录', '完整 Prompt', '官方案例', '长视频', '我的收藏',
    ])

    fireEvent.click(screen.getByRole('button', { name: /5 秒及以下/ }))
    fireEvent.click(screen.getByRole('switch', { name: '只看有 Prompt' }))
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), { target: { value: '羔羊' } })
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()

    fireEvent.click(within(collections).getByRole('button', { name: '官方案例' }))
    expect(within(collections).getByRole('button', { name: '官方案例' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('餐厅时间冻结与逆向复原')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '只看有 Prompt' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByPlaceholderText('搜索案例、场景或创作者…')).toHaveValue('')
    expect(screen.getByRole('button', { name: /全部时长/ })).toHaveClass('active')
    expect(window.location.search).toBe('?collection=official')

    fireEvent.click(screen.getByRole('button', { name: /5 秒及以下/ }))
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()

    fireEvent.click(within(collections).getByRole('button', { name: '官方案例' }))
    expect(within(collections).getByRole('button', { name: '官方案例' })).toHaveAttribute('aria-pressed', 'false')
    expect(window.location.search).toBe('')
    expect(screen.getByRole('button', { name: /全部时长/ })).toHaveClass('active')
    expect(screen.getByText('餐厅时间冻结与逆向复原')).toBeInTheDocument()
  })

  it('initializes first-time visitors without treating the archive as unread', () => {
    renderAt('/')

    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /本次新增/ })).toBeDisabled()
    expect(document.querySelector('.update-strip')).toBeInTheDocument()
    expect(screen.getByText('案例按最新收录排序 · 最近一次更新：新增 24 个案例 · 5 条完整 Prompt')).toBeInTheDocument()
    expect(screen.queryByText('创作者榜已更新')).not.toBeInTheDocument()
    expect(screen.getByText('从本次访问开始记录；当前没有可比较的上次访问。')).toBeInTheDocument()
    expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-20T12:20:35.382Z')
    expect(window.localStorage.getItem(tutorialUpdatesSeenThroughKey)).toBe('2026-08-23T02:34:28+08:00')
    const cards = document.querySelectorAll('.case-card')
    expect(cards[0]).toHaveTextContent('羊皮纸上的绝地光明史诗')
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
  })

  it('shows the latest non-zero release in the compact up-to-date state', () => {
    window.localStorage.setItem(caseUpdatesSeenThroughKey, '2026-08-20T12:20:35.382Z')
    window.localStorage.setItem(tutorialUpdatesSeenThroughKey, '2026-08-23T02:34:28+08:00')
    renderAt('/')

    expect(document.querySelector('.update-strip')).toBeInTheDocument()
    expect(screen.getByText('最近一次更新于 9月5日 · 新增 24 个案例 · 5 条完整 Prompt')).toBeInTheDocument()
    expect(screen.queryByText(/新增 0/)).not.toBeInTheDocument()
  })

  it('keeps a fixed update snapshot until it is visible and preserves it across refreshes in the same tab', async () => {
    window.localStorage.setItem(legacyUpdatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    renderAt('/')

    expect(screen.getByRole('button', { name: /本次新增/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: '自上次访问新增 2 个案例、24 篇教程' })).toBeInTheDocument()
    expect(screen.getByText('羊皮纸上的绝地光明史诗')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-10T05:52:30.476Z')
    expect(window.localStorage.getItem(tutorialUpdatesSeenThroughKey)).toBe('2026-08-10T05:52:30.476Z')

    fireEvent.pointerDown(window)
    await waitFor(() => expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-20T12:20:35.382Z'))
    expect(window.localStorage.getItem(tutorialUpdatesSeenThroughKey)).toBe('2026-08-10T05:52:30.476Z')
    expect(screen.getByText('这批内容已显示；下次访问将标记为已读。')).toBeInTheDocument()
    expect(JSON.parse(window.sessionStorage.getItem(updateSessionStorageKey) || '{}').cases).toEqual({
      since: '2026-08-10T05:52:30.476Z',
      through: '2026-08-20T12:20:35.382Z',
    })

    cleanup()
    renderAt('/')
    expect(screen.getByRole('button', { name: /本次新增/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('羊皮纸上的绝地光明史诗')).toBeInTheDocument()

    cleanup()
    window.sessionStorage.clear()
    renderAt('/')
    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: '自上次访问新增 0 个案例、24 篇教程' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /本次新增/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: /查看 24 篇新增教程/ })).toHaveAttribute(
      'href',
      '/tutorials/?added=unseen&since=2026-08-10T05%3A52%3A30.476Z&through=2026-08-23T02%3A34%3A28%2B08%3A00',
    )
  })

  it('does not mark an update batch seen when other filters hide every new case', async () => {
    window.localStorage.setItem(caseUpdatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    window.localStorage.setItem(tutorialUpdatesSeenThroughKey, '2026-08-22T18:34:28.000Z')
    renderAt('/')

    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), { target: { value: '舰桥' } })
    fireEvent.pointerDown(window)
    expect(screen.getByText('有新增内容，但不符合当前筛选。')).toBeInTheDocument()
    expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-10T05:52:30.476Z')

    fireEvent.click(screen.getByRole('button', { name: '清除其他筛选' }))
    await waitFor(() => expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-20T12:20:35.382Z'))
  })

  it('keeps date browsing available when local visit storage is unavailable', () => {
    const originalStorage = window.localStorage
    const unavailableStorage = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
      clear() { throw new Error('blocked') },
      key() { return null },
      length: 0,
    }
    Object.defineProperty(window, 'localStorage', { configurable: true, value: unavailableStorage })
    // With storage blocked the stored 'zh' preference is unreadable, so pin the
    // visitor language too; otherwise jsdom's en-US redirects '/' to the English home.
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['zh-CN'] })
    try {
      renderAt('/')
      expect(document.querySelector('.update-strip')).toBeInTheDocument()
      expect(screen.getByText('无法保存访问进度 · 最近一次更新：新增 24 个案例 · 5 条完整 Prompt')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /本次新增/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: '今天' })).toBeEnabled()
      expect(screen.getByText('浏览器存储不可用，无法计算自上次访问新增。')).toBeInTheDocument()
    } finally {
      cleanup()
      Object.defineProperty(window, 'localStorage', { configurable: true, value: originalStorage })
      Reflect.deleteProperty(navigator, 'languages')
    }
  })

  it('falls back to an in-memory batch when session storage is unavailable', async () => {
    window.localStorage.setItem(caseUpdatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    window.localStorage.setItem(tutorialUpdatesSeenThroughKey, '2026-08-22T18:34:28.000Z')
    const originalStorage = window.sessionStorage
    const unavailableStorage = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
      clear() { throw new Error('blocked') },
      key() { return null },
      length: 0,
    }
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: unavailableStorage })
    try {
      renderAt('/')
      expect(screen.getByRole('button', { name: /本次新增/ })).toHaveAttribute('aria-pressed', 'true')
      fireEvent.pointerDown(window)
      await waitFor(() => expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-20T12:20:35.382Z'))
    } finally {
      cleanup()
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: originalStorage })
    }
  })

  it('allows an explicit empty snapshot without exposing a broken blank page', () => {
    renderAt('/?added=unseen&since=2026-08-20T12%3A20%3A35.382Z&through=2026-08-20T12%3A20%3A35.382Z')

    expect(screen.getByRole('button', { name: /本次新增/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /本次新增/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('这个时间段没有新增内容。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看全部' }))
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('lets explicit URL filters override automatic returning-visitor behavior', () => {
    window.localStorage.setItem(caseUpdatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    window.localStorage.setItem(tutorialUpdatesSeenThroughKey, '2026-08-22T18:34:28.000Z')
    renderAt('/?collection=official')

    expect(screen.getByRole('button', { name: '官方案例' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
    fireEvent.pointerDown(window)
    expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-10T05:52:30.476Z')
  })

  it('combines added-date presets with case filters and removes invalid URL state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 23, 12, 0, 0))
    renderAt('/?added=7d')

    expect(screen.getByRole('button', { name: '近 7 天' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('羊皮纸上的绝地光明史诗')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()

    cleanup()
    renderAt('/?added=unseen&since=not-a-date')
    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.search).toBe('')

    cleanup()
    renderAt('/?added=unseen&since=2026-08-20T00%3A00%3A00.000Z&through=2026-08-19T00%3A00%3A00.000Z')
    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.search).toBe('')
  })

  it('stores anonymous favorites locally and restores the saved collection', () => {
    renderAt('/')
    const starship = screen.getByText('舰桥上的跃迁余震').closest('article')
    expect(starship).not.toBeNull()
    fireEvent.click(within(starship!).getByRole('button', { name: '收藏案例' }))
    expect(JSON.parse(window.localStorage.getItem('minimax-h3-favorite-cases') || '[]')).toContain('official-t2va-starship')

    cleanup()
    renderAt('/?collection=favorites')
    expect(screen.getByRole('button', { name: /我的收藏/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
    expect(screen.queryByText('粉色西装与黑色羔羊')).not.toBeInTheDocument()
  })

  it('explains an empty saved collection without offering a reset action', () => {
    window.localStorage.setItem('minimax-h3-favorite-cases', JSON.stringify(['missing-case-id']))
    renderAt('/?collection=favorites')

    const emptyState = document.querySelector<HTMLElement>('.empty-state')
    expect(emptyState).not.toBeNull()
    expect(within(emptyState!).getByText('你当前还没有收藏。')).toBeInTheDocument()
    expect(within(emptyState!).getByText('点开任意案例卡片右上角的星标即可收进这里；收藏只保存在当前浏览器，不需要登录。')).toBeInTheDocument()
    expect(within(emptyState!).queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps the generic no-match copy when saved cases are narrowed by another filter', () => {
    window.localStorage.setItem('minimax-h3-favorite-cases', JSON.stringify(['official-t2va-starship']))
    renderAt('/?collection=favorites')

    fireEvent.click(screen.getByRole('button', { name: /超过 15 秒/ }))
    expect(screen.getByText('换一个关键词或筛选条件试试。')).toBeInTheDocument()
    expect(screen.queryByText('你当前还没有收藏。')).not.toBeInTheDocument()
  })

  it('searches across localized case metadata', () => {
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: '焦点转移' },
    })
    expect(screen.getByText('拉面与家庭晚餐')).toBeInTheDocument()
    expect(screen.queryByText('粉色西装与黑色羔羊')).not.toBeInTheDocument()
  })

  it('loads the hosted video and keeps an X icon link to the original post', async () => {
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: '时间冻结' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查看 餐厅时间冻结与逆向复原 详情' }))
    expect(screen.getByText('原始 Prompt · 创作者原文')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制 Prompt' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /在 X 打开原帖/ })).toHaveAttribute(
      'href',
      'https://x.com/icreat_ai/status/2085297962977227011',
    )
    expect(screen.getByText('正在加载站内视频…')).toBeInTheDocument()
  })

  it('issues no fetch for the hosted video and removes the player when the dialog closes', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: '时间冻结' },
    })
    const open = screen.getByRole('button', { name: '查看 餐厅时间冻结与逆向复原 详情' })

    // A press starts the player early, but a cancelled press must dispose it.
    fireEvent.pointerDown(open)
    expect(document.querySelectorAll('video[src*="/media/"]')).toHaveLength(1)
    fireEvent.pointerCancel(open)
    expect(document.querySelectorAll('video[src*="/media/"]')).toHaveLength(0)
    fireEvent.pointerDown(open)
    fireEvent.pointerLeave(open)
    expect(document.querySelectorAll('video[src*="/media/"]')).toHaveLength(0)

    // Press followed by click reuses the single prepared player.
    fireEvent.pointerDown(open)
    fireEvent.click(open)
    const players = document.querySelectorAll('video[src*="/media/"]')
    expect(players).toHaveLength(1)
    expect(fetchSpy.mock.calls.some(([input]) => String(input instanceof Request ? input.url : input).includes('/media/'))).toBe(false)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelectorAll('video[src*="/media/"]')).toHaveLength(0)
    fetchSpy.mockRestore()
  })

  it('disposes a prepared player that is never opened once its TTL elapses', () => {
    vi.useFakeTimers()
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: '时间冻结' },
    })
    fireEvent.pointerDown(screen.getByRole('button', { name: '查看 餐厅时间冻结与逆向复原 详情' }))
    expect(document.querySelectorAll('video[src*="/media/"]')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(4_100) })
    expect(document.querySelectorAll('video[src*="/media/"]')).toHaveLength(0)
  })

  it('links a creator-verbatim Prompt back to the original X reply', () => {
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: '赛博特工' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查看 赛博特工从剪影显现在数据面板 详情' }))

    expect(screen.getByRole('link', { name: /查看 Prompt 原帖/ })).toHaveAttribute(
      'href',
      'https://x.com/adithatipalli/status/2086478122241962266',
    )
  })

  it('shows video and source details without inventing a prompt when the source did not publish one', () => {
    const view = renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: 'YukYuk' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查看 同提示词 H3 与 Seedance 对比 详情' }))

    expect(screen.getByText('来源未公开 Prompt；本页只展示视频和公开信息。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '复制 Prompt' })).not.toBeInTheDocument()
    expect(view.container.querySelector('.dialog-copy pre')).not.toBeInTheDocument()
    expect(screen.getByText('正在加载站内视频…')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /在 X 打开原帖/ })).toHaveAttribute(
      'href',
      'https://x.com/YukYukID/status/2085553970702074050',
    )
  })

  it('publishes Tutorials and FAQ as standalone pages', () => {
    const tutorials = renderAt('/tutorials/')
    expect(screen.getByRole('heading', { name: 'MiniMax H3 教程' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '基础路线' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '社区教程' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ComfyUI 从零到第一条 H3 带声视频' })).toHaveAttribute(
      'href', '/tutorials/official-deployment/',
    )
    expect(screen.getAllByRole('link', { name: /打开教程/ })).toHaveLength(24)
    expect(screen.getAllByText('社区实战')).toHaveLength(20)
    expect(screen.queryByRole('heading', { name: '先看 MiniMax H3 的真实效果。' })).not.toBeInTheDocument()
    tutorials.unmount()

    renderAt('/faq/')
    expect(screen.getByRole('heading', { name: '先把边界讲清楚。' })).toBeInTheDocument()
    expect(screen.getByText('这里收录什么？')).toBeInTheDocument()
    expect(screen.getByText('这里展示的 Prompt 会被修改吗？')).toBeInTheDocument()
    expect(screen.queryByText('打开官方仓库')).not.toBeInTheDocument()
  }, 15_000)

  it('publishes a bilingual creator leaderboard with separate video and tutorial ranks', () => {
    renderAt('/creators/')

    expect(screen.getByRole('heading', { name: '持续做出好作品的人。' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '本期前三' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /查看作者主页/ }).length).toBeGreaterThan(3)
    expect(screen.getByRole('tab', { name: '综合优质' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('button', { name: '教程作者' }))
    expect(screen.queryByRole('tab', { name: '综合优质' })).not.toBeInTheDocument()
    expect(screen.getByText('@servasyy_ai')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '切换到英文' }))
    expect(window.location.pathname).toBe('/en/creators/')
    expect(screen.getByRole('heading', { name: 'Follow the people who keep making.' })).toBeInTheDocument()
  })

  it('stores creator bookmarks locally and restores the saved creator view', () => {
    renderAt('/creators/')
    const creatorCard = screen.getAllByText('@manuagi01')[0].closest('article')
    expect(creatorCard).not.toBeNull()
    fireEvent.click(within(creatorCard!).getByRole('button', { name: '收藏作者' }))
    expect(JSON.parse(window.localStorage.getItem('minimax-h3-favorite-creators') || '[]')).toContain('x-manuagi01')

    fireEvent.click(screen.getByRole('button', { name: /我的关注/ }))
    const savedGrid = document.querySelector('.creator-grid')
    expect(savedGrid).not.toBeNull()
    expect(within(savedGrid as HTMLElement).getByText('@manuagi01')).toBeInTheDocument()
    expect(within(savedGrid as HTMLElement).queryByText('@strength04_x')).not.toBeInTheDocument()
  })

  it('shows an author profile with X attribution and composable case filters', () => {
    renderAt('/creators/icreat_ai/')

    expect(screen.getByRole('heading', { name: 'ICREAT AI' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '去 X 关注' })).toHaveAttribute('href', 'https://x.com/icreat_ai')
    expect(screen.getByText('餐厅时间冻结与逆向复原')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: /内容分类/ }), { target: { value: 'Model Comparison' } })
    expect(screen.queryByText('餐厅时间冻结与逆向复原')).not.toBeInTheDocument()
    expect(screen.getByText('两种生成模型再次对照')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: /内容分类/ }), { target: { value: 'ALL' } })

    fireEvent.click(screen.getByRole('switch', { name: /只看有 Prompt/ }))
    expect(window.location.search).toBe('?prompt=1')
    expect(screen.getByText('餐厅时间冻结与逆向复原')).toBeInTheDocument()
  })

  it('renders an explicit 404 for an unknown creator', () => {
    renderAt('/creators/not-a-real-creator/')
    expect(screen.getByRole('heading', { name: '这位创作者暂未进入榜单。' })).toBeInTheDocument()
  })

  it('filters tutorial routes without mixing them into the case catalog', () => {
    renderAt('/tutorials/')
    fireEvent.click(screen.getByRole('button', { name: '长视频' }))
    expect(screen.getByRole('heading', { name: 'H3 WebUI：Motion Context + 内置升频' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '4070 12GB：5 秒分块续接 13 秒角色舞蹈' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mac Studio 上用 Phosphene 跑 Turbo' })).not.toBeInTheDocument()
  })

  it('keeps tutorial updates independent and upgrades an old since-only snapshot URL', async () => {
    window.localStorage.setItem(caseUpdatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    window.localStorage.setItem(tutorialUpdatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    renderAt('/tutorials/?added=unseen&since=2026-08-22T00%3A00%3A00.000Z')

    expect(screen.getByRole('button', { name: /本次新增/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: '基础路线' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '社区教程' })).toBeInTheDocument()
    expect(screen.getAllByText('新收录')).toHaveLength(24)
    expect(screen.getAllByRole('link', { name: /打开教程/ })).toHaveLength(24)
    expect(window.location.search).toContain('through=2026-08-22T18%3A34%3A28.000Z')
    await waitFor(() => expect(window.localStorage.getItem(tutorialUpdatesSeenThroughKey)).toBe('2026-08-22T18:34:28.000Z'))
    expect(window.localStorage.getItem(caseUpdatesSeenThroughKey)).toBe('2026-08-10T05:52:30.476Z')
  })

  it('filters community tutorials by hardware and keeps the source behind the internal guide', () => {
    renderAt('/tutorials/')
    fireEvent.click(screen.getByRole('button', { name: '8GB 显存' }))
    expect(screen.getByRole('heading', { name: '4-bit + DiffSynth：最低 8GB 显存路线' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'RTX 4080 16GB：Pruned + INT8 低显存部署' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '4-bit + DiffSynth：最低 8GB 显存路线' })).toHaveAttribute(
      'href', '/tutorials/four-bit-eight-gb/',
    )
  })

  it('publishes a bilingual ecosystem page with dated Star snapshots', () => {
    renderAt('/tutorials/ecosystem/')
    expect(screen.getByRole('heading', { name: '教程与工具生态' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'MiniMax-AI / MiniMax-H3' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'OpenMontage' })).toBeInTheDocument()
    expect(screen.getAllByText(/Star 快照: 2026-08-23/).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /站内对应教程/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '切换到英文' })).toHaveAttribute('href', '/en/tutorials/ecosystem/')
  })

  it('searches community guides and opens a source-checked detail page', () => {
    renderAt('/tutorials/')
    fireEvent.change(screen.getByPlaceholderText('搜索硬件、能力或工作流…'), { target: { value: 'Ref2VA LoRA' } })
    expect(screen.getByRole('heading', { name: '用 AI Toolkit 训练 H3 Ref2VA LoRA' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '从零装机到第一条带声视频' })).not.toBeInTheDocument()

    cleanup()
    renderAt('/tutorials/mac-native/')
    expect(screen.getByRole('heading', { name: 'Mac 从零运行 H3：纯 C + Metal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '命令' })).toBeInTheDocument()
    expect(screen.getByText('make -j8 && mkdir -p outputs')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /查看参考资料/ })).toHaveAttribute('href', 'https://github.com/antirez/h3.c')
    expect(screen.getByRole('heading', { name: '完成标准' })).toBeInTheDocument()
    expect(screen.getAllByText(/outputs\/fox-fast\.mp4/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('heading', { name: '预期结果' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '故障排查' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /复制命令/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: '相关工具与资源' })).toBeInTheDocument()
  })

  it('copies an AI task package and falls back to a manual text field', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderAt('/tutorials/mac-native/')
    fireEvent.click(screen.getByRole('button', { name: '复制给 AI' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(writeText.mock.calls[0][0]).toContain('目标:')
    expect(writeText.mock.calls[0][0]).toContain('https://github.com/antirez/h3.c')
    expect(writeText.mock.calls[0][0]).toContain('不得猜测缺失步骤')
    expect(screen.getByRole('button', { name: '已复制 AI 任务包' })).toBeInTheDocument()

    cleanup()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    renderAt('/tutorials/mac-native/')
    fireEvent.click(screen.getByRole('button', { name: '复制给 AI' }))
    expect((screen.getByRole('textbox', { name: '手动复制 AI 任务包' }) as HTMLTextAreaElement).value).toContain('执行约束')
  })

  it('renders a client-side 404 for an unknown tutorial slug', () => {
    renderAt('/tutorials/not-a-real-guide/')
    expect(screen.getByRole('heading', { name: '这篇教程不存在。' })).toBeInTheDocument()
  })
})

describe('language isolation', () => {
  it('renders the English home without duplicated Chinese case or interface copy', () => {
    renderAt('/en/')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('heading', { name: 'See what MiniMax H3 actually makes.' })).toBeInTheDocument()
    expect(screen.getByText('After the Fleet Jumps')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search cases, scenes, or creators…')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'With Prompt' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tutorials' })).toHaveAttribute('href', '/en/tutorials/')
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/')
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('keeps the language switch on the equivalent standalone route', () => {
    renderAt('/en/tutorials/')
    expect(screen.getByRole('heading', { name: 'MiniMax H3 Tutorials' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/tutorials/')
    expect(screen.queryByText('先选一条可靠起跑线。')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('keeps the old toolkit URL as a client-side compatibility alias', () => {
    renderAt('/en/toolkit/')
    expect(screen.getByRole('heading', { name: 'MiniMax H3 Tutorials' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/tutorials/')
  })

  it('keeps the language switch on the equivalent tutorial detail route', () => {
    renderAt('/en/tutorials/mac-native/')
    expect(screen.getByRole('heading', { name: 'Run H3 on Mac from zero with pure C + Metal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/tutorials/mac-native/')
    expect(screen.queryByText('Mac 从零运行 H3：纯 C + Metal')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('keeps the English ecosystem route free of Chinese interface copy', () => {
    renderAt('/en/tutorials/ecosystem/')
    expect(screen.getByRole('heading', { name: 'Tutorial and Tool Ecosystem' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/tutorials/ecosystem/')
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('localizes the hosted player and keeps the English X source button', async () => {
    renderAt('/en/')
    fireEvent.change(screen.getByPlaceholderText('Search cases, scenes, or creators…'), {
      target: { value: 'rewinds' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'View details for The Diner That Rewinds' }))
    expect(screen.getByText('Loading hosted video…')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open original post on X/ })).toHaveAttribute(
      'href',
      'https://x.com/icreat_ai/status/2085297962977227011',
    )
    expect(screen.queryByText('餐厅时间冻结与逆向复原')).not.toBeInTheDocument()
  })

  it('localizes the no-prompt state without exposing a fake prompt field', () => {
    const view = renderAt('/en/')
    fireEvent.change(screen.getByPlaceholderText('Search cases, scenes, or creators…'), {
      target: { value: 'YukYuk' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'View details for Same Prompt: H3 vs Seedance 2' }))

    expect(screen.getByText('The source did not publish a prompt. This page shows the video and public details only.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy Prompt' })).not.toBeInTheDocument()
    expect(view.container.querySelector('.dialog-copy pre')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
    expect(screen.getByText('Loading hosted video…')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open original post on X/ })).toHaveAttribute(
      'href',
      'https://x.com/YukYukID/status/2085553970702074050',
    )
  })
})
