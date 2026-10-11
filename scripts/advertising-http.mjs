import { readFile } from 'node:fs/promises'
import { advertisingConfig, adsTxt } from '../shared/advertising-config.mjs'

function send(request, response, status, body, type) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body) })
  response.end(request.method === 'HEAD' ? undefined : body)
}

export async function handleAdvertisingRequest(request, response, env = process.env) {
  const path = (request.url ?? '').split('?')[0]
  if (!['/ads-config.json', '/ads.txt', '/advertising-runtime.mjs'].includes(path)) return false
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD')
    send(request, response, 405, 'Method not allowed\n', 'text/plain; charset=utf-8')
    return true
  }
  if (path === '/ads-config.json') send(request, response, 200, JSON.stringify(advertisingConfig(env, request.headers.host)), 'application/json; charset=utf-8')
  if (path === '/ads.txt') {
    const body = adsTxt(env)
    send(request, response, body ? 200 : 404, body ?? 'Advertising is not configured.\n', 'text/plain; charset=utf-8')
  }
  if (path === '/advertising-runtime.mjs') send(request, response, 200, await readFile(new URL('../shared/advertising-runtime.mjs', import.meta.url), 'utf8'), 'text/javascript; charset=utf-8')
  return true
}
