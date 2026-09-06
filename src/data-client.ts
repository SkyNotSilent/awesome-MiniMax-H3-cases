import tutorialGuidesUrl from '../data/tutorial-guides.json?url'
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

// The summary already carries the latest-release counts, which are the same
// for every visitor, so one cached request is enough.
export const loadCatalog = (force = false) => loadJson<CatalogPayload>('/api/catalog/summary', force)

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
export const loadTutorialGuides = (force = false) => loadJson<TutorialGuide[]>(tutorialGuidesUrl, force)
export const loadTutorialResources = (force = false) => loadJson<TutorialResource[]>('/data/tutorials.json', force)
export const loadCreators = (force = false) => loadJson<CreatorCatalog>('/data/creators.json', force)
