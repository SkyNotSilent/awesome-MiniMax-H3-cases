import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccount, legacyFavoritesKey } from './use-account'
import { startGoogleLogin } from './account-navigation'
vi.mock('./account-navigation', () => ({ startGoogleLogin: vi.fn() }))
const accountA = { id: 'account-a', name: 'A', email: 'a@example.com', picture: null }
const accountB = { id: 'account-b', name: 'B', email: 'b@example.com', picture: null }
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status })
}
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.mocked(startGoogleLogin).mockClear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('account favorites', () => {
  it('merges local favorites once and completes the initiating save after sign-in', async () => {
    localStorage.setItem(legacyFavoritesKey, JSON.stringify(['old-case', 'old-case', 'invalid/id']))
    sessionStorage.setItem(
      'minimax-h3-pending-favorite',
      JSON.stringify({ id: 'new-case', expires: Date.now() + 60000 }),
    )
    window.history.replaceState({}, '', '/en/?auth=success#catalog')
    const favorites = new Set(['cloud-case'])
    const imports: unknown[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
      const path = String(input)
      if (path === '/api/auth/session') return response({ enabled: true, user: accountA, csrfToken: 'csrf' })
      if (path.endsWith('/import')) {
        const data = JSON.parse(options!.body as string)
        imports.push(data)
        data.favorites.forEach((id: string) => favorites.add(id))
        return response({ ok: true })
      }
      if (options?.method === 'PUT') {
        favorites.add(path.split('/').at(-1)!)
        return response({ ok: true })
      }
      return response({ userId: accountA.id, favorites: [...favorites] })
    })
    const { result } = renderHook(() => useAccount())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect([...result.current.favorites].sort()).toEqual(['cloud-case', 'new-case', 'old-case'])
    expect(localStorage.getItem(legacyFavoritesKey)).toBeNull()
    expect(sessionStorage.getItem('minimax-h3-pending-favorite')).toBeNull()
    expect(window.location.href).toContain('/en/#catalog')
    await act(async () => {
      await result.current.refresh()
    })
    expect(imports).toHaveLength(1)
  })
  it('retains old data on an interrupted import and retries with the same receipt', async () => {
    localStorage.setItem(legacyFavoritesKey, JSON.stringify(['old-case']))
    let fail = true
    const receipts: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
      if (String(input) === '/api/auth/session')
        return response({ enabled: true, user: accountA, csrfToken: 'csrf' })
      if (String(input).endsWith('/import')) {
        receipts.push(JSON.parse(options!.body as string).importId)
        return response({}, fail ? 503 : 200)
      }
      return response({ userId: accountA.id, favorites: [] })
    })
    const { result } = renderHook(() => useAccount())
    await waitFor(() => expect(result.current.error).toBe('import'))
    expect(localStorage.getItem(legacyFavoritesKey)).not.toBeNull()
    fail = false
    await act(async () => {
      await result.current.refresh()
    })
    expect(localStorage.getItem(legacyFavoritesKey)).toBeNull()
    expect(new Set(receipts).size).toBe(1)
  })
  it('rolls back a failed save and provides an idempotent retry', async () => {
    let fail = true
    const favorites = new Set<string>()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
      if (String(input) === '/api/auth/session')
        return response({ enabled: true, user: accountA, csrfToken: 'csrf' })
      if (options?.method === 'PUT') {
        if (fail) return response({}, 503)
        favorites.add('case-one')
        return response({ ok: true })
      }
      return response({ userId: accountA.id, favorites: [...favorites] })
    })
    const { result } = renderHook(() => useAccount())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.toggleFavorite('case-one'))
    await waitFor(() => expect(result.current.error).toBe('save'))
    expect(result.current.favorites.has('case-one')).toBe(false)
    fail = false
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.favorites.has('case-one')).toBe(true))
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
  it('clears account A and discards its delayed response when switching to B', async () => {
    let user = accountA
    let resolveOld: ((value: Response) => void) | undefined
    let slow = false
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/auth/session') return response({ enabled: true, user, csrfToken: 'csrf' })
      if (user === accountA && slow)
        return new Promise((resolve) => {
          resolveOld = resolve
        })
      return response({ userId: user.id, favorites: user === accountA ? ['a-case'] : ['b-case'] })
    })
    const { result } = renderHook(() => useAccount())
    await waitFor(() => expect(result.current.favorites.has('a-case')).toBe(true))
    slow = true
    act(() => {
      void result.current.refresh()
    })
    await waitFor(() => expect(resolveOld).toBeDefined())
    user = accountB
    await act(async () => {
      await result.current.refresh()
    })
    await act(async () => {
      resolveOld!(response({ userId: accountA.id, favorites: ['a-private'] }))
    })
    expect(result.current.user?.id).toBe(accountB.id)
    expect([...result.current.favorites]).toEqual(['b-case'])
  })
  it('never merges a previously claimed browser import into another account', async () => {
    localStorage.setItem(legacyFavoritesKey, JSON.stringify(['old-case']))
    localStorage.setItem(
      'minimax-h3-favorites-import-v1',
      JSON.stringify({
        importId: crypto.randomUUID(),
        userId: accountA.id,
        favorites: ['old-case'],
        done: false,
      }),
    )
    const mocked = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) =>
        response(
          String(input) === '/api/auth/session'
            ? { enabled: true, user: accountB, csrfToken: 'csrf' }
            : { userId: accountB.id, favorites: [] },
        ),
      )
    const { result } = renderHook(() => useAccount())
    await waitFor(() => expect(result.current.error).toBe('import'))
    expect(mocked.mock.calls.some(([input]) => String(input).endsWith('/import'))).toBe(false)
    expect(localStorage.getItem(legacyFavoritesKey)).not.toBeNull()
  })
  it('shows login failures without completing the pending save', async () => {
    window.history.replaceState({}, '', '/?auth=failed')
    sessionStorage.setItem(
      'minimax-h3-pending-favorite',
      JSON.stringify({ id: 'case-one', expires: Date.now() + 60000 }),
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ enabled: true, user: null, csrfToken: null }))
    const { result } = renderHook(() => useAccount())
    await waitFor(() => expect(result.current.error).toBe('login'))
    expect(sessionStorage.getItem('minimax-h3-pending-favorite')).toBeNull()
    expect(result.current.favorites.size).toBe(0)
  })
})
