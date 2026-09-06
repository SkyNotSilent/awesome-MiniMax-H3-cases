import type { Taxonomy } from '../src/types'
export interface FilterState {
  category: string; style: string; scene: string; q: string
  duration: 'ALL' | 'UP_TO_5' | 'SIX_TO_10' | 'ELEVEN_TO_15' | 'OVER_15'
  collection: 'all' | 'featured' | 'latest' | 'prompt' | 'official' | 'long' | 'favorites'
  prompt: boolean; added: 'all' | 'unseen' | 'today' | '7d' | '30d'
  since: string | null; through: string | null
}
export const filterKeys: string[]
export const durations: FilterState['duration'][]
export const collections: FilterState['collection'][]
export function hasExplicitFilters(params: URLSearchParams): boolean
export function parseFilters(params: URLSearchParams, taxonomy: Taxonomy): FilterState
export function writeFilters(url: URL, state: Partial<FilterState>): string
