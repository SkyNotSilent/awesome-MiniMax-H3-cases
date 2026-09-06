import { gzipSync } from 'node:zlib'
import { CatalogQueryError, catalogSummary, queryCatalog } from '../shared/catalog-query.mjs'

async function readFavorites(request) {
  if (Number(request.headers['content-length']) > 262144) { request.resume(); throw new CatalogQueryError('Request body too large', 413) }
  return new Promise((resolve, reject) => {
    let bytes = 0, chunks = [], failed = false
    const timer = setTimeout(() => { failed = true; chunks = []; reject(new CatalogQueryError('Request timed out', 408)) }, 5000)
    request.on('data', chunk => {
      bytes += chunk.length
      if (bytes > 262144 && !failed) { failed = true; chunks = []; clearTimeout(timer); reject(new CatalogQueryError('Request body too large', 413)) }
      if (!failed) chunks.push(chunk)
    })
    request.on('error', () => { clearTimeout(timer); reject(new CatalogQueryError('Request interrupted')) })
    request.on('end', () => {
      clearTimeout(timer)
      if (failed) return
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString())
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'favorites')) throw new Error()
        resolve(body.favorites ?? [])
      } catch { reject(new CatalogQueryError('Invalid JSON body')) }
    })
  })
}
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
export async function handleCatalogApi(request, response, index) {
  const started = performance.now()
  const url = new URL(request.url, 'http://localhost')
  if (!url.pathname.startsWith('/api/catalog')) return false
  try {
    if (!['/api/catalog', '/api/catalog/summary'].includes(url.pathname)) throw new CatalogQueryError('Not found', 404)
    if (!['GET', 'HEAD', ...(url.pathname === '/api/catalog' ? ['POST'] : [])].includes(request.method)) throw new CatalogQueryError('Method not allowed', 405)
    if (!index) throw new CatalogQueryError('Catalog unavailable', 503)
    if (url.search.length > 4096) throw new CatalogQueryError('Query too long')
    const favorites = request.method === 'POST' ? await readFavorites(request) : []
    const result = url.pathname.endsWith('/summary') ? catalogSummary(index, url.searchParams) : queryCatalog(index, url.searchParams, favorites)
    response.setHeader('Server-Timing', `catalog;dur=${(performance.now() - started).toFixed(3)}`)
    send(request, response, 200, result)
  } catch (error) {
    // Never log search terms, favorites, body data, or raw errors.
    send(request, response, error instanceof CatalogQueryError ? error.status : 500, { error: error instanceof CatalogQueryError ? error.message : 'Catalog query failed' })
  }
  return true
}
