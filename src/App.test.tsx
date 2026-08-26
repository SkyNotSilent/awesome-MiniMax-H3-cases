import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import projectStats from '../data/project-stats.json'
import { languagePreferenceKey } from './i18n'
import { updatesSeenThroughKey } from './updates'

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
  window.localStorage.setItem(languagePreferenceKey, 'zh')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState({}, '', '/')
  document.body.classList.remove('intro-open', 'modal-open')
  window.localStorage.clear()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  delete window.twttr
})

describe('case-first routes', () => {
  const latestUpdateHeading = [
    projectStats.latestUpdate.casesAdded > 0 ? `新增 ${projectStats.latestUpdate.casesAdded} 个案例` : null,
    projectStats.latestUpdate.promptsAdded > 0 ? `${projectStats.latestUpdate.promptsAdded} 条完整 Prompt` : null,
    projectStats.latestUpdate.tutorialsAdded > 0 ? `新增 ${projectStats.latestUpdate.tutorialsAdded} 篇教程` : null,
  ].filter(Boolean).slice(0, 2).join(' · ')

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

  it('initializes first-time visitors without treating the archive as unread', () => {
    renderAt('/')

    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: latestUpdateHeading })).toBeInTheDocument()
    expect(screen.getByText('创作者榜已更新')).toBeInTheDocument()
    expect(screen.queryByText(/新增 0/)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(updatesSeenThroughKey)).toBe('2026-08-23T02:34:28+08:00')
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
  })

  it('opens a fixed since-last-visit snapshot for returning visitors and marks it seen for next time', () => {
    window.localStorage.setItem(updatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    renderAt('/')

    expect(screen.getByRole('button', { name: /本次新增/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: latestUpdateHeading })).toBeInTheDocument()
    expect(screen.getByText('羊皮纸上的绝地光明史诗')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(updatesSeenThroughKey)).toBe('2026-08-23T02:34:28+08:00')
    expect(screen.queryByText(/24 篇教程/)).not.toBeInTheDocument()

    cleanup()
    renderAt('/')
    expect(screen.getByRole('heading', { name: latestUpdateHeading })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lets explicit URL filters override automatic returning-visitor behavior', () => {
    window.localStorage.setItem(updatesSeenThroughKey, '2026-08-10T05:52:30.476Z')
    renderAt('/?collection=official')

    expect(screen.getByRole('button', { name: '官方案例' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: '本站收录时间' })).getByRole('button', { name: /^全部$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()
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

  it('keeps the homepage update baseline when opening new tutorials', () => {
    renderAt('/tutorials/?added=unseen&since=2026-08-22T00%3A00%3A00.000Z')

    expect(screen.getByRole('button', { name: /本次新增/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: '基础路线' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '社区教程' })).toBeInTheDocument()
    expect(screen.getAllByText('新收录')).toHaveLength(24)
    expect(screen.getAllByRole('link', { name: /打开教程/ })).toHaveLength(24)
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
