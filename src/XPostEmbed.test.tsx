import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { XPostEmbed } from './XPostEmbed'

const sourceUrl = 'https://x.com/icreat_ai/status/2085297962977227011'
const posterUrl = '/posters/x/x-icreat-time-freeze-diner.jpg'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete window.twttr
  document.querySelectorAll('script[data-x-widgets="true"]').forEach((script) => script.remove())
})

describe('XPostEmbed', () => {
  it('shows the real cover and distinguishes loading, slow, and timed-out states', async () => {
    vi.useFakeTimers()
    const createTweet = vi.fn(() => new Promise<HTMLElement | undefined>(() => {}))
    window.twttr = { widgets: { createTweet } }

    render(<XPostEmbed sourceUrl={sourceUrl} title="餐厅时间冻结与逆向复原" posterUrl={posterUrl} />)
    await act(async () => Promise.resolve())

    expect(screen.getByAltText('餐厅时间冻结与逆向复原 视频封面')).toHaveAttribute('src', posterUrl)
    expect(screen.getByLabelText('餐厅时间冻结与逆向复原 X 原帖播放器')).toHaveAttribute('data-state', 'loading')
    expect(screen.getByText('正在连接 X 播放器')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(6_000))
    expect(screen.getByText('X 响应较慢，仍在加载')).toBeInTheDocument()
    expect(screen.getByLabelText('餐厅时间冻结与逆向复原 X 原帖播放器')).toHaveAttribute('data-state', 'slow')

    act(() => vi.advanceTimersByTime(14_000))
    expect(screen.getByRole('alert')).toHaveTextContent('播放器加载失败')
    expect(screen.getByRole('button', { name: /重新加载/ })).toBeInTheDocument()
    expect(screen.getByLabelText('餐厅时间冻结与逆向复原 X 原帖播放器')).toHaveAttribute('data-state', 'error')
  })

  it('retries a failed player without losing the source fallback', async () => {
    const createTweet = vi.fn()
      .mockRejectedValueOnce(new Error('network blocked'))
      .mockResolvedValueOnce(document.createElement('iframe'))
    window.twttr = { widgets: { createTweet } }

    render(<XPostEmbed sourceUrl={sourceUrl} title="餐厅时间冻结与逆向复原" posterUrl={posterUrl} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('播放器加载失败')
    expect(screen.getByRole('link', { name: /播放器受限时在 X 打开原帖/ })).toHaveAttribute('href', sourceUrl)

    fireEvent.click(screen.getByRole('button', { name: /重新加载/ }))
    await waitFor(() => expect(createTweet).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByLabelText('餐厅时间冻结与逆向复原 X 原帖播放器')).toHaveAttribute('data-state', 'ready'))
  })

  it('replaces a failed widgets script before retrying', async () => {
    render(<XPostEmbed sourceUrl={sourceUrl} title="餐厅时间冻结与逆向复原" posterUrl={posterUrl} />)

    const firstScript = document.querySelector<HTMLScriptElement>('script[data-x-widgets="true"]')
    expect(firstScript).toBeInTheDocument()

    await act(async () => {
      firstScript?.dispatchEvent(new Event('error'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('播放器加载失败')
    expect(firstScript).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /重新加载/ }))
    let replacementScript: HTMLScriptElement | null = null
    await waitFor(() => {
      replacementScript = document.querySelector<HTMLScriptElement>('script[data-x-widgets="true"]')
      expect(replacementScript).toBeInTheDocument()
      expect(replacementScript).not.toBe(firstScript)
    })
    await act(async () => {
      replacementScript?.dispatchEvent(new Event('error'))
      await Promise.resolve()
    })
  })

  it('keeps every visible and accessible label in the selected language', async () => {
    vi.useFakeTimers()
    const createTweet = vi.fn(() => new Promise<HTMLElement | undefined>(() => {}))
    window.twttr = { widgets: { createTweet } }

    render(
      <XPostEmbed
        sourceUrl={sourceUrl}
        title="Diner time freeze and rewind"
        posterUrl={posterUrl}
        language="en"
      />,
    )
    await act(async () => Promise.resolve())

    expect(screen.getByLabelText('Diner time freeze and rewind X post player')).toHaveAttribute('data-state', 'loading')
    expect(screen.getByAltText('Diner time freeze and rewind video cover')).toHaveAttribute('src', posterUrl)
    expect(screen.getByText('X post player')).toBeInTheDocument()
    expect(screen.getByText('Media provided by X')).toBeInTheDocument()
    expect(screen.getByText('Connecting to the X player')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open the original post on X if the player is unavailable/ })).toHaveAttribute(
      'href',
      sourceUrl,
    )

    act(() => vi.advanceTimersByTime(6_000))
    expect(screen.getByText('X is responding slowly')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(14_000))
    expect(screen.getByRole('alert')).toHaveTextContent('Player failed to load')
    expect(screen.getByRole('button', { name: 'Reload player' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('播放器')
    expect(document.body).not.toHaveTextContent('加载')
    expect(createTweet).toHaveBeenCalledWith(
      '2085297962977227011',
      expect.any(HTMLElement),
      expect.objectContaining({ lang: 'en' }),
    )
  })
})
