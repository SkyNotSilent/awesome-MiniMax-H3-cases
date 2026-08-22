import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { languagePreferenceKey } from './i18n'

vi.mock('../data/cases.json', async (importOriginal) => {
  const original = await importOriginal<typeof import('../data/cases.json')>()
  const originalCases = (original as unknown as { default: Array<{ id: string }> }).default
  const fixtureIds = new Set([
    'official-t2va-starship',
    'official-ref2va-lamb',
    'official-fl2va-ramen',
    'x-icreat-time-freeze-diner',
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
    expect(screen.getByRole('link', { name: '常见问题' })).toHaveAttribute('href', '/faq/')
    expect(screen.getByRole('link', { name: '在 GitHub 查看源码' })).toHaveAttribute(
      'href',
      'https://github.com/SkyNotSilent/awesome-minimax-h3-cases',
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
    expect(screen.getByRole('heading', { name: '从案例，走到真正跑起来。' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'MiniMax-AI / MiniMax-H3: 打开官方部署文档' })).toHaveAttribute(
      'href',
      'https://github.com/MiniMax-AI/MiniMax-H3',
    )
    expect(screen.getByRole('link', { name: '阅读 Mac 原生教程' })).toHaveAttribute(
      'href',
      'https://github.com/antirez/h3.c',
    )
    expect(screen.queryByRole('heading', { name: '先看 MiniMax H3 的真实效果。' })).not.toBeInTheDocument()
    tutorials.unmount()

    renderAt('/faq/')
    expect(screen.getByRole('heading', { name: '先把边界讲清楚。' })).toBeInTheDocument()
    expect(screen.getByText('这里收录什么？')).toBeInTheDocument()
    expect(screen.getByText('这里展示的 Prompt 会被修改吗？')).toBeInTheDocument()
    expect(screen.queryByText('打开官方仓库')).not.toBeInTheDocument()
  })

  it('filters tutorial routes without mixing them into the case catalog', () => {
    renderAt('/tutorials/')
    fireEvent.click(screen.getByRole('button', { name: '长视频' }))
    expect(screen.getByRole('heading', { name: 'ComfyUI H3 Motion Context' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'h3.c / h3-metal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'MiniMax-H3 Turbo LoRA' })).not.toBeInTheDocument()
  })

  it('maps director, training, and resource projects to their own tutorial categories', () => {
    renderAt('/tutorials/')

    fireEvent.click(screen.getByRole('button', { name: '导演工作流' }))
    expect(screen.getByRole('heading', { name: 'ComfyUI MiniMax H3 Director' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'MiniMax H3 Director Workflow Pack' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ComfyUI MiniMax H3 Easy' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'MiniMax H3 FineTuning' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '训练微调' }))
    expect(screen.getByRole('link', { name: 'MiniMax H3 FineTuning: 阅读微调文档' })).toHaveAttribute(
      'href',
      'https://github.com/IAmIronMan42/MiniMax-H3-FineTuning',
    )

    fireEvent.click(screen.getByRole('button', { name: '资源导航' }))
    expect(screen.getByRole('heading', { name: 'Awesome MiniMax H3 Resources' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'BeatAPI MiniMax H3 Prompt Gallery' })).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'From watching examples to running H3.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/tutorials/')
    expect(screen.queryByText('打开官方仓库')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('keeps the old toolkit URL as a client-side compatibility alias', () => {
    renderAt('/en/toolkit/')
    expect(screen.getByRole('heading', { name: 'From watching examples to running H3.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/tutorials/')
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
