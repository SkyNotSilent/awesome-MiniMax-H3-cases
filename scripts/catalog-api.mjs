import { gzipSync } from 'node:zlib'
import { CatalogQueryError, catalogSummary, queryCatalog } from '../shared/catalog-query.mjs'

function send(request, response, status, value) {
  const json = Buffer.from(JSON.stringify(value))
  const gzip = (request.headers['accept-encoding'] ?? '').split(',').some(value => {
    const match = value.trim().match(/^gzip(?:\s*;\s*q=([0-9.]+))?$/i)
    return match && (match[1] === undefined || Number(match[1]) > 0)
  })
  const body = gzip ? gzipSync(json) : json
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length,
    'Cache-Control': 'private, no-store', Vary: 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
  })
  response.end(request.method === 'HEAD' ? undefined : body)
}
export async function handleCatalogApi(request, response, index, accountApi) {
  const started = performance.now()
  const url = new URL(request.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/catalog')) return false
  try {
    if (!['/api/catalog', '/api/catalog/summary'].includes(url.pathname)) throw new CatalogQueryError('Not found', 404)
    if (!['GET', 'HEAD'].includes(request.method)) throw new CatalogQueryError('Method not allowed', 405)
    if (!index) throw new CatalogQueryError('Catalog unavailable', 503)
    if (url.search.length > 4096) throw new CatalogQueryError('Query too long')
    const personal = url.pathname === '/api/catalog' && url.searchParams.get('collection') === 'favorites'
      ? await accountApi.catalogContext(request, index) : null
    const result = url.pathname.endsWith('/summary') ? catalogSummary(index) : queryCatalog(index, url.searchParams, personal?.favorites ?? [])
    if (personal) result.accountId = personal.userId
    response.setHeader('Server-Timing', `catalog;dur=${(performance.now() - started).toFixed(3)}`)
    send(request, response, 200, result)
  } catch (error) {
    // Never log search terms, favorites, body data, or raw errors.
    send(request, response, error instanceof CatalogQueryError ? error.status : error.status ?? 503, { error: error instanceof CatalogQueryError ? error.message : 'Personal catalog unavailable' })
  }
  return true
}
