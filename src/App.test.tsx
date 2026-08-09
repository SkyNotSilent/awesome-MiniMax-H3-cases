import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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
    expect(screen.getByRole('heading', { name: '先看效果，再拆工作流。' })).toBeInTheDocument()
    expect(screen.getByText('舰桥上的跃迁余震')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_600))
    expect(screen.getByLabelText('MiniMax H3 社区视频实验档案')).toHaveClass('is-leaving')
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByLabelText('MiniMax H3 社区视频实验档案')).not.toBeInTheDocument()
  })

  it('keeps the home page focused on cases and removes template and collection-method sections', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: '案例' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: '工具链' })).toHaveAttribute('href', '/toolkit/')
    expect(screen.getByRole('link', { name: '常见问题' })).toHaveAttribute('href', '/faq/')
    expect(screen.queryByText('从单个案例，提炼可复用镜头协议。')).not.toBeInTheDocument()
    expect(screen.queryByText('收录方式')).not.toBeInTheDocument()
    expect(screen.queryByText('从提示词，一路接到成片。')).not.toBeInTheDocument()
  })

  it('filters cases by generation mode', () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: /全模态参考/ }))
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
  })

  it('searches across localized case metadata', () => {
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景、工作流…'), {
      target: { value: '焦点转移' },
    })
    expect(screen.getByText('拉面与家庭晚餐')).toBeInTheDocument()
    expect(screen.queryByText('粉色西装与黑色羔羊')).not.toBeInTheDocument()
  })

  it('loads the official in-site X player and keeps a source fallback', async () => {
    const createTweet = vi.fn().mockResolvedValue(document.createElement('iframe'))
    window.twttr = { widgets: { createTweet } }
    renderAt('/')
    fireEvent.change(screen.getByPlaceholderText('搜索案例、场景、工作流…'), {
      target: { value: '时间冻结' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查看 餐厅时间冻结与逆向复原 详情' }))
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

  it('publishes Toolkit and FAQ as standalone pages', () => {
    const toolkit = renderAt('/toolkit/')
    expect(screen.getByRole('heading', { name: '从提示词，一路接到成片。' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'MiniMax-AI / MiniMax-H3: 打开官方仓库' })).toHaveAttribute(
      'href',
      'https://github.com/MiniMax-AI/MiniMax-H3',
    )
    expect(screen.queryByRole('heading', { name: '先看效果，再拆工作流。' })).not.toBeInTheDocument()
    toolkit.unmount()

    renderAt('/faq/')
    expect(screen.getByRole('heading', { name: '先把边界讲清楚。' })).toBeInTheDocument()
    expect(screen.getByText('MiniMax H3 和 Hailuo 3.0 是什么关系？')).toBeInTheDocument()
    expect(screen.queryByText('打开官方仓库')).not.toBeInTheDocument()
  })
})

describe('language isolation', () => {
  it('renders the English home without duplicated Chinese case or interface copy', () => {
    renderAt('/en/')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('heading', { name: 'See the result. Trace the workflow.' })).toBeInTheDocument()
    expect(screen.getByText('After the Fleet Jumps')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search cases, scenes, workflows…')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Toolkit' })).toHaveAttribute('href', '/en/toolkit/')
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/')
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('keeps the language switch on the equivalent standalone route', () => {
    renderAt('/en/toolkit/')
    expect(screen.getByRole('heading', { name: 'From prompt to finished cut.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Chinese' })).toHaveAttribute('href', '/toolkit/')
    expect(screen.queryByText('打开官方仓库')).not.toBeInTheDocument()
  })

  it('localizes the English X player and case dialog', async () => {
    const createTweet = vi.fn().mockResolvedValue(document.createElement('iframe'))
    window.twttr = { widgets: { createTweet } }
    renderAt('/en/')
    fireEvent.change(screen.getByPlaceholderText('Search cases, scenes, workflows…'), {
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
})
