import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { queryCatalog } from '../shared/catalog-query.mjs'
import { loadCatalogPage } from './data-client'
import type { CatalogPage } from './types'

export function useCatalogQuery(params: URLSearchParams, favorites: string[], enabled: boolean, fixtureIndex: unknown = null) {
  const key = JSON.stringify([params.toString(), favorites])
  const [result, setResult] = useState<{ key: string; page: CatalogPage } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const [fixtureLimit, setFixtureLimit] = useState({ key, limit: 36 })
  const sequence = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const activeKey = useRef(key)
  useEffect(() => { activeKey.current = key }, [key])
  const fixturePage = useMemo(() => {
    if (!fixtureIndex || !enabled) return null
    const [query, ids] = JSON.parse(key) as [string, string[]]
    const first = queryCatalog(fixtureIndex, new URLSearchParams(query), ids)
    const limit = fixtureLimit.key === key ? fixtureLimit.limit : 36
    let page = first
    while (page.nextCursor && first.cases.length < limit) {
      const nextParams = new URLSearchParams(query)
      nextParams.set('limit', '24'); nextParams.set('cursor', page.nextCursor)
      page = queryCatalog(fixtureIndex, nextParams, ids)
      first.cases.push(...page.cases)
    }
    return { ...first, nextCursor: page.nextCursor }
  }, [enabled, fixtureIndex, fixtureLimit, key])

  const request = useCallback(async (cursor: string | null = null) => {
    if (!enabled || fixtureIndex) return
    const id = ++sequence.current
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setBusy(true); setFailure(null)
    const [query, ids] = JSON.parse(key) as [string, string[]]
    const nextParams = new URLSearchParams(query)
    if (cursor) { nextParams.set('cursor', cursor); nextParams.set('limit', '24') }
    try {
      let page: CatalogPage
      try { page = await loadCatalogPage(nextParams, ids, abort.signal) } catch (error) {
        if (!cursor || (error as { status?: number }).status !== 409) throw error
        nextParams.delete('cursor'); nextParams.set('limit', '36'); cursor = null
        page = await loadCatalogPage(nextParams, ids, abort.signal)
      }
      if (id !== sequence.current || abort.signal.aborted || activeKey.current !== key) return
      setResult(previous => ({ key, page: cursor && previous?.key === key && previous.page.catalogVersion === page.catalogVersion ? { ...page, cases: [...previous.page.cases, ...page.cases] } : page }))
    } catch {
      if (!abort.signal.aborted && id === sequence.current && activeKey.current === key) setFailure(key)
    } finally { if (id === sequence.current && !abort.signal.aborted) setBusy(false) }
  }, [enabled, fixtureIndex, key])
  useEffect(() => {
    // Queue so effect cleanup can abort an obsolete navigation before it starts.
    let live = true
    void Promise.resolve().then(() => { if (live) void request() })
    return () => { live = false; controller.current?.abort() }
  }, [request, retry])
  const page = fixturePage ?? result?.page ?? null
  return {
    page, error: failure === key,
    loading: !fixtureIndex && enabled && (busy || result?.key !== key) && failure !== key,
    retry: () => setRetry(value => value + 1),
    loadMore: () => {
      if (fixtureIndex) setFixtureLimit({ key, limit: (fixtureLimit.key === key ? fixtureLimit.limit : 36) + 24 })
      else if (!busy && result?.key === key && page?.nextCursor) void request(page.nextCursor)
    },
  }
}
