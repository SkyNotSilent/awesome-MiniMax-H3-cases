import { createUpdateSession } from './update-session'
import { resolveRoute } from './i18n'
import type {
  CaseDetail,
  CatalogPayload,
  CatalogPage,
  CreatorCatalog,
  SearchRecord,
  TutorialGuide,
  TutorialResource,
} from './types'
import type { Language } from './i18n'

const jsonCache = new Map<string, Promise<unknown>>()

async function loadJson<T>(path: string, force = false): Promise<T> {
  if (force) jsonCache.delete(path)
  let request = jsonCache.get(path) as Promise<T> | undefined
  if (!request) {
    request = fetch(path, { headers: { Accept: 'application/json' } }).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return response.json() as Promise<T>
    })
    if (jsonCache.size >= 64) jsonCache.delete(jsonCache.keys().next().value!)
    jsonCache.set(path, request)
    request.catch(() => jsonCache.delete(path))
  }
  return request
}

export async function loadCatalog(force = false) {
  const metadata = await loadJson<CatalogPayload>('/api/catalog/summary', force)
  const window = createUpdateSession(metadata, resolveRoute(globalThis.window.location.pathname).page)
  const now = new Date(), today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const params = new URLSearchParams({ casesSince: window.cases.since, casesThrough: window.cases.through, tutorialsSince: window.tutorials.since, tutorialsThrough: window.tutorials.through, todayFrom: today.toISOString(), todayThrough: now.toISOString() })
  // Personal windows are never kept in the shared promise cache.
  const response = await fetch(`/api/catalog/summary?${params}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Catalog summary unavailable')
  return response.json() as Promise<CatalogPayload>
}

export async function loadCatalogPage(params: URLSearchParams, favorites: string[], signal: AbortSignal): Promise<CatalogPage> {
  const response = await fetch(`/api/catalog?${params}`, {
    signal, cache: 'no-store', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(favorites.length ? { method: 'POST', body: JSON.stringify({ favorites }) } : {}),
  })
  if (!response.ok) throw Object.assign(new Error('Catalog query unavailable'), { status: response.status })
  return response.json() as Promise<CatalogPage>
}
export const loadCaseDetail = (id: string, force = false) => loadJson<CaseDetail>(`/data/cases/${encodeURIComponent(id)}.json`, force)
export const loadSearchIndex = (language: Language, force = false) => loadJson<SearchRecord[]>(`/data/search-index.${language}.json`, force)
export const loadTutorialGuides = (force = false) => loadJson<TutorialGuide[]>('/data/tutorial-guides.json', force)
export const loadTutorialResources = (force = false) => loadJson<TutorialResource[]>('/data/tutorials.json', force)
export const loadCreators = (force = false) => loadJson<CreatorCatalog>('/data/creators.json', force)
