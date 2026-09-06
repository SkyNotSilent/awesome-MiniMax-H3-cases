import type { CatalogCase, CatalogPayload, CatalogPage, Taxonomy, VideoCase } from '../src/types'
export class CatalogQueryError extends Error { status: number }
export interface ServerCatalog { version: number; catalogVersion: string; cases: Array<CatalogCase & { search: { zh: string; en: string } }>; tutorials: Array<{ id: string; addedAt: string }>; featuredCaseIds: string[]; taxonomy: Taxonomy; creators: Array<{ slug: string; caseIds: string[] }> }
export function searchText(item: VideoCase, language: 'zh' | 'en', taxonomy: Taxonomy): string
export function createCatalogIndex(data: ServerCatalog): unknown
export function queryCatalog(index: unknown, params?: URLSearchParams, favorites?: string[]): CatalogPage
export function catalogSummary(index: unknown, params?: URLSearchParams): CatalogPayload
