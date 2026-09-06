import { readCatalogSnapshot } from './catalog-snapshot.mjs'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { catalogSummary, createCatalogIndex, queryCatalog } from '../shared/catalog-query.mjs'
const root = resolve(import.meta.dirname, '..')
export async function buildMetrics() {
  const gzip = async path => gzipSync(await readFile(resolve(root, path))).length
  const names = await readdir(resolve(root, 'dist/assets'))
  const size = async extension => (await Promise.all(names.filter(name => name.endsWith(extension)).map(name => gzip(`dist/assets/${name}`)))).reduce((a, b) => a + b, 0)
  const index = createCatalogIndex(await readCatalogSnapshot(resolve(root, 'build/server-data/catalog.ndjson')))
  const first = queryCatalog(index)
  const next = queryCatalog(index, new URLSearchParams({ limit: '24', ...(first.nextCursor ? { cursor: first.nextCursor } : {}) }))
  const search = queryCatalog(index, new URLSearchParams({ q: 'H3' }))
  const encoded = value => gzipSync(JSON.stringify(value)).length
  const fonts = (await Promise.all((await readdir(resolve(root, 'dist/fonts'))).filter(x => x.endsWith('.woff2')).map(name => readFile(resolve(root, 'dist/fonts', name))))).reduce((sum, body) => sum + body.length, 0)
  const preloads = new Set()
  for (const path of ['dist/index.html', 'dist/en/index.html']) {
    const html = await readFile(resolve(root, path), 'utf8')
    for (const [link] of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!/\brel=["']preload["']/i.test(link) || !/\bas=["']font["']/i.test(link)) continue
      const href = link.match(/\bhref=["']([^"']+)["']/i)?.[1]
      if (!href?.startsWith('/') || href.startsWith('//')) throw new Error('Font preloads must reference measured local assets')
      preloads.add(href)
    }
  }
  const preloadedFonts = (await Promise.all([...preloads].map(href => readFile(resolve(root, 'dist', href.slice(1)))))).reduce((sum, body) => sum + body.length, 0)
  return { javascript: await size('.js'), css: await size('.css'), htmlZh: await gzip('dist/index.html'), htmlEn: await gzip('dist/en/index.html'), catalog: encoded(first), next: encoded(next), facets: encoded(first.facets), summaryRequests: 2 * encoded(catalogSummary(index)), decodedCatalog: Buffer.byteLength(JSON.stringify(first)), search: encoded(search), serverIndex: await gzip('build/server-data/catalog.ndjson'), fonts, preloadedFonts }
}
