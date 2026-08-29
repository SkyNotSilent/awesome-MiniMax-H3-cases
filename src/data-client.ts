import type {
  CaseDetail,
  CatalogPayload,
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
    jsonCache.set(path, request)
    request.catch(() => jsonCache.delete(path))
  }
  return request
}

export const loadCatalog = (force = false) => loadJson<CatalogPayload>('/data/catalog.json', force)
export const loadCaseDetail = (id: string, force = false) => loadJson<CaseDetail>(`/data/cases/${encodeURIComponent(id)}.json`, force)
export const loadSearchIndex = (language: Language, force = false) => loadJson<SearchRecord[]>(`/data/search-index.${language}.json`, force)
export const loadTutorialGuides = (force = false) => loadJson<TutorialGuide[]>('/data/tutorial-guides.json', force)
export const loadTutorialResources = (force = false) => loadJson<TutorialResource[]>('/data/tutorials.json', force)
export const loadCreators = (force = false) => loadJson<CreatorCatalog>('/data/creators.json', force)
