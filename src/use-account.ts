import { startGoogleLogin } from './account-navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export const legacyFavoritesKey = 'minimax-h3-favorite-cases'
const migrationKey = 'minimax-h3-favorites-import-v1'
const pendingKey = 'minimax-h3-pending-favorite'
export interface AccountUser {
  id: string
  name: string
  email: string
  picture: string | null
}
interface Session {
  enabled: boolean
  user: AccountUser | null
  csrfToken: string | null
}
interface AccountState extends Session {
  favorites: Set<string>
  loading: boolean
  error: 'unavailable' | 'login' | 'save' | 'import' | null
}
interface Migration {
  importId: string
  userId: string
  favorites: string[]
  done: boolean
}
interface Pending {
  id: string
  expires: number
  userId?: string
}
const initialState: AccountState = {
  enabled: false,
  user: null,
  csrfToken: null,
  favorites: new Set(),
  loading: true,
  error: null,
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...options.headers },
  })
  if (!response.ok) throw Object.assign(new Error('Account request failed'), { status: response.status })
  return response.json() as Promise<T>
}
function readPending(): Pending | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey) ?? 'null') as Pending | null
    return value && typeof value.id === 'string' && value.expires > Date.now() ? value : null
  } catch {
    return null
  }
}
async function importLegacy(session: Session, signal: AbortSignal) {
  if (!session.user) return
  const previous = JSON.parse(localStorage.getItem(migrationKey) ?? 'null') as Migration | null
  if (previous?.done) {
    localStorage.removeItem(legacyFavoritesKey)
    return
  }
  const raw = JSON.parse(localStorage.getItem(legacyFavoritesKey) ?? '[]') as unknown
  const ids = Array.isArray(raw)
    ? [
        ...new Set(raw.filter((id): id is string => typeof id === 'string' && /^[\w.-]{1,160}$/.test(id))),
      ].slice(0, 10000)
    : []
  if (!previous && !ids.length) return
  const migration = previous ?? {
    importId: crypto.randomUUID(),
    userId: session.user.id,
    favorites: ids,
    done: false,
  }
  if (migration.userId !== session.user.id) throw new Error('Legacy import belongs to another account')
  // Persist the receipt and owner before any write so retries and account switches are safe.
  localStorage.setItem(migrationKey, JSON.stringify(migration))
  for (let offset = 0; offset < Math.max(migration.favorites.length, 1); offset += 500) {
    await request('/api/me/favorites/import', {
      signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken! },
      body: JSON.stringify({
        importId: migration.importId,
        batchId: offset / 500,
        favorites: migration.favorites.slice(offset, offset + 500),
        final: offset + 500 >= migration.favorites.length,
      }),
    })
  }
  // Mark done first: storage removal failure must never restore cancelled favorites.
  localStorage.setItem(migrationKey, JSON.stringify({ ...migration, done: true }))
  localStorage.removeItem(legacyFavoritesKey)
}

export function useAccount() {
  const [state, setState] = useState<AccountState>(initialState)
  const current = useRef(state)
  const epoch = useRef(0)
  const refreshController = useRef<AbortController | null>(null)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const retryAction = useRef<(() => void) | null>(null)
  const update = useCallback((value: AccountState) => {
    current.current = value
    setState(value)
  }, [])
  const invalidate = useCallback(() => {
    ++epoch.current
    refreshController.current?.abort()
  }, [])
  const refresh = useCallback(async () => {
    const version = ++epoch.current
    refreshController.current?.abort()
    const controller = new AbortController()
    refreshController.current = controller
    const live = () => version === epoch.current && !controller.signal.aborted
    try {
      await writes.current
      const session = await request<Session>('/api/auth/session', { signal: controller.signal })
      if (!live()) return
      // Drop the previous account before requesting its replacement's personal data.
      update({
        ...session,
        favorites: session.user?.id === current.current.user?.id ? current.current.favorites : new Set(),
        loading: true,
        error: null,
      })
      let error: AccountState['error'] = null
      const url = new URL(window.location.href)
      const loginResult = url.searchParams.get('auth')
      if (loginResult) {
        url.searchParams.delete('auth')
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
      }
      if (loginResult === 'failed') {
        sessionStorage.removeItem(pendingKey)
        error = 'login'
      }
      if (session.user) {
        try {
          await importLegacy(session, controller.signal)
        } catch {
          if (live()) error = 'import'
        }
        const pending = readPending()
        if (
          pending &&
          (loginResult === 'success' || pending.userId === session.user.id) &&
          (!pending.userId || pending.userId === session.user.id)
        ) {
          try {
            sessionStorage.setItem(pendingKey, JSON.stringify({ ...pending, userId: session.user.id }))
            await request(`/api/me/favorites/${encodeURIComponent(pending.id)}`, {
              signal: controller.signal,
              method: 'PUT',
              headers: { 'X-CSRF-Token': session.csrfToken! },
            })
            sessionStorage.removeItem(pendingKey)
          } catch {
            error = 'save'
          }
        }
        const data = await request<{ userId: string; favorites: string[] }>('/api/me/favorites', {
          signal: controller.signal,
        })
        if (!live()) return
        if (data.userId !== session.user.id)
          throw Object.assign(new Error('Account changed'), { status: 401 })
        update({ ...session, favorites: new Set(data.favorites), loading: false, error })
      } else update({ ...session, favorites: new Set(), loading: false, error })
    } catch (error) {
      if (live())
        update({
          ...initialState,
          loading: false,
          error: (error as { status?: number }).status === 401 ? 'login' : 'unavailable',
        })
    }
  }, [update])
  useEffect(() => {
    let live = true
    void Promise.resolve().then(() => {
      if (live) void refresh()
    })
    const focused = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const changed = (event: StorageEvent) => {
      if (event.key === 'minimax-h3-account-change') void refresh()
    }
    window.addEventListener('focus', focused)
    window.addEventListener('storage', changed)
    return () => {
      live = false
      invalidate()
      window.removeEventListener('focus', focused)
      window.removeEventListener('storage', changed)
    }
  }, [invalidate, refresh])
  const login = (id?: string) => {
    if (!current.current.enabled || current.current.loading) {
      update({ ...current.current, error: 'unavailable' })
      return
    }
    try {
      if (id) sessionStorage.setItem(pendingKey, JSON.stringify({ id, expires: Date.now() + 600000 }))
      else sessionStorage.removeItem(pendingKey)
    } catch {
      /* Login remains usable with blocked browser storage. */
    }
    startGoogleLogin(`${window.location.pathname}${window.location.search}${window.location.hash}`)
  }
  const save = (id: string, add: boolean) => {
    const session = current.current
    if (!session.user) {
      login(id)
      return
    }
    if (session.loading) return
    const userId = session.user.id
    const previous = session.favorites.has(id)
    const next = new Set(session.favorites)
    if (add) next.add(id)
    else next.delete(id)
    update({ ...session, favorites: next, error: null })
    ++epoch.current
    refreshController.current?.abort()
    let succeeded = false
    writes.current = writes.current.then(async () => {
      if (current.current.user?.id !== userId) return
      try {
        await request(`/api/me/favorites/${encodeURIComponent(id)}`, {
          method: add ? 'PUT' : 'DELETE',
          headers: { 'X-CSRF-Token': session.csrfToken! },
        })
        succeeded = true
      } catch (error) {
        if (current.current.user?.id !== userId) return
        const reverted = new Set(current.current.favorites)
        if (previous) reverted.add(id)
        else reverted.delete(id)
        if ((error as { status?: number }).status === 401)
          update({ ...initialState, enabled: true, loading: false, error: 'login' })
        else update({ ...current.current, favorites: reverted, error: 'save' })
        retryAction.current = () => save(id, add)
      }
    })
    void writes.current.then(() => {
      if (succeeded && current.current.user?.id === userId) void refresh()
    })
  }
  const logout = async () => {
    const session = current.current
    ++epoch.current
    refreshController.current?.abort()
    update({ ...initialState, enabled: session.enabled, loading: true })
    try {
      await writes.current
      await request('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken! } })
      try {
        localStorage.setItem('minimax-h3-account-change', crypto.randomUUID())
      } catch {
        /* Cross-tab refresh also happens on focus. */
      }
    } catch {
      retryAction.current = () => {
        void refresh()
      }
      update({ ...initialState, enabled: session.enabled, loading: false, error: 'unavailable' })
      return
    }
    update({ ...initialState, enabled: session.enabled, loading: false })
  }
  return {
    ...state,
    login,
    toggleFavorite: (id: string) => save(id, !current.current.favorites.has(id)),
    logout,
    refresh,
    retry: () => {
      const action = retryAction.current
      retryAction.current = null
      if (action) action()
      else void refresh()
    },
  }
}
export type Account = ReturnType<typeof useAccount>
