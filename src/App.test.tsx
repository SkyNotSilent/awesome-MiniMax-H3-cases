import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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
  ])

  return {
    default: originalCases.filter((item) => fixtureIds.has(item.id)),
  }
})

function renderAt(pathname: string) {
  window.history.replaceState({}, '', pathname)
  return render(<App />)
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState({}, '', '/')
  document.body.classList.remove('intro-open', 'modal-open')
  delete window.twttr
})

describe('case-first routes', () => {
  it('renders the case browser underneath a two-second intro and then removes the intro', () => {
    vi.useFakeTimers()
    renderAt('/')

    expect(screen.getByLabelText('MiniMax H3 社区视频实验档案')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '先看 MiniMax H3 的真实效果。' })).toBeInTheDocument()
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_600))
    expect(screen.getByLabelText('MiniMax H3 社区视频实验档案')).toHaveClass('is-leaving')
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByLabelText('MiniMax H3 社区视频实验档案')).not.toBeInTheDocument()
  })

  it('keeps the home page focused on cases and removes template and collection-method sections', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: '案例' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: '教程' })).toHaveAttribute('href', '/tutorials/')
    expect(screen.getByRole('link', { name: '常见问题' })).toHaveAttribute('href', '/faq/')
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

  it('filters cases by generation mode', () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: /全模态参考/ }))
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
  })

  it('searches across localized case metadata', () => {
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: '焦点转移' },
    })
    expect(screen.getByText('拉面与家庭晚餐')).toBeInTheDocument()
    expect(screen.queryByText('粉色西装与黑色羔羊')).not.toBeInTheDocument()
  })

  it('loads the official in-site X player and keeps a source fallback', async () => {
    const createTweet = vi.fn().mockResolvedValue(document.createElement('iframe'))
    window.twttr = { widgets: { createTweet } }
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: '时间冻结' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查看 餐厅时间冻结与逆向复原 详情' }))
    expect(screen.getByText('原始 Prompt · 创作者原文')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制 Prompt' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /播放器受限时在 X 打开原帖/ })).toHaveAttribute(
      'href',
      'https://x.com/icreat_ai/status/2085297962977227011',
    )
    await waitFor(() => expect(createTweet).toHaveBeenCalledWith(
      '2085297962977227011',
      expect.any(HTMLElement),
      expect.objectContaining({ dnt: true, theme: 'dark', lang: 'zh-cn' }),
    ))
  })

  it('shows video and source details without inventing a prompt when the source did not publish one', async () => {
    const createTweet = vi.fn().mockResolvedValue(document.createElement('iframe'))
    window.twttr = { widgets: { createTweet } }
    const view = renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景或创作者…'), {
      target: { value: 'YukYuk' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查看 同提示词 H3 与 Seedance 对比 详情' }))

    expect(screen.getByText('来源未公开 Prompt；本页只展示视频和公开信息。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '复制 Prompt' })).not.toBeInTheDocument()
    expect(view.container.querySelector('.dialog-copy pre')).not.toBeInTheDocument()
    await waitFor(() => expect(createTweet).toHaveBeenCalled())
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
})

describe('language isolation', () => {
  it('renders the English home without duplicated Chinese case or interface copy', () => {
    renderAt('/en/')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('heading', { name: 'See what MiniMax H3 actually makes.' })).toBeInTheDocument()
    expect(screen.getByText('After the Fleet Jumps')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search cases, scenes, or creators…')).toBeInTheDocument()
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

  it('localizes the English X player and case dialog', async () => {
    const createTweet = vi.fn().mockResolvedValue(document.createElement('iframe'))
    window.twttr = { widgets: { createTweet } }
    renderAt('/en/')
    fireEvent.change(screen.getByPlaceholderText('Search cases, scenes, or creators…'), {
      target: { value: 'rewinds' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'View details for The Diner That Rewinds' }))
    expect(screen.getByText('Connecting to the X player')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open the original post on X/ })).toHaveAttribute(
      'href',
      'https://x.com/icreat_ai/status/2085297962977227011',
    )
    expect(screen.queryByText('餐厅时间冻结与逆向复原')).not.toBeInTheDocument()
    await waitFor(() => expect(createTweet).toHaveBeenCalledWith(
      '2085297962977227011',
      expect.any(HTMLElement),
      expect.objectContaining({ lang: 'en' }),
    ))
  })

  it('localizes the no-prompt state without exposing a fake prompt field', async () => {
    const createTweet = vi.fn().mockResolvedValue(document.createElement('iframe'))
    window.twttr = { widgets: { createTweet } }
    const view = renderAt('/en/')
    fireEvent.change(screen.getByPlaceholderText('Search cases, scenes, or creators…'), {
      target: { value: 'YukYuk' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'View details for Same Prompt: H3 vs Seedance 2' }))

    expect(screen.getByText('The source did not publish a prompt. This page shows the video and public details only.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy Prompt' })).not.toBeInTheDocument()
    expect(view.container.querySelector('.dialog-copy pre')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
    await waitFor(() => expect(createTweet).toHaveBeenCalled())
  })
})
