import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { legacyOrigins, primaryOrigin, resolveSiteOrigin } from '../shared/site-config.mjs'

const root = resolve(import.meta.dirname, '..')
const routes = ['/', '/en/', '/tutorials/', '/en/tutorials/', '/skills/', '/faq/']
const files = ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt']

export function checkCanonical(html, origin, path) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map(x => x[0])
  const canonical = tags.find(tag => /\brel=["']canonical["']/.test(tag))?.match(/\bhref=["']([^"']+)["']/)?.[1]
  if (canonical !== `${origin}${path}`) throw new Error('SITE_CANONICAL_MISMATCH')
}

export async function verifySite({ origin = primaryOrigin, legacyOrigin = legacyOrigins[0], redirectMode = 'off', fetchPage = fetch } = {}) {
  resolveSiteOrigin({ site: origin, environment: {}, production: true })
  let checked = 0
  const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
  const detail = cases.findLast(x => x.mediaUrl?.startsWith('/media/'))?.id
  for (const path of [...routes, `/cases/${detail}/`, `/en/cases/${detail}/`]) {
    const response = await fetchPage(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    if (response.status !== 200) throw new Error('SITE_PAGE_FAILED')
    checkCanonical(await response.text(), origin, path)
    checked++
  }
  for (const path of files) {
    const response = await fetchPage(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    const body = await response.text()
    if (response.status !== 200 || !body.includes(origin) || legacyOrigins.some(old => body.includes(old))) throw new Error('SITE_DISCOVERY_MISMATCH')
    checked++
  }
  const path = '/en/?added=release&category=cinematic&q=test%20case'
  const old = await fetchPage(`${legacyOrigin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
  const expected = redirectMode === 'permanent' ? 308 : redirectMode === 'temporary' ? 302 : 200
  if (old.status !== expected || (expected !== 200 && old.headers.get('location') !== `${origin}${path}`)) throw new Error('SITE_LEGACY_REDIRECT_FAILED')
  await old.body?.cancel()
  for (const path of ['/api/catalog/summary', '/data/catalog.json', '/data/tutorial-guides.v2.json', '/icon.svg', '/robots.txt']) {
    const response = await fetchPage(`${legacyOrigin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    if (response.status !== 200) throw new Error('SITE_LEGACY_CLIENT_FAILED')
    await response.body?.cancel()
  }
  return { pages: checked, canonical: true, discovery: true, legacyLinks: true, legacyClients: true }
}

export async function verifySiteBuild(directory = resolve(root, 'dist')) {
  const origin = resolveSiteOrigin()
  let checked = 0
  async function scan(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = resolve(path, entry.name)
      if (entry.isDirectory()) await scan(file)
      else if (/\.(?:html|xml|txt)$/.test(entry.name)) {
        const text = await readFile(file, 'utf8')
        if (legacyOrigins.some(old => text.includes(old))) throw new Error('SITE_BUILD_CONTAINS_LEGACY_ORIGIN')
        checked++
      }
    }
  }
  await scan(directory)
  for (const path of routes) checkCanonical(await readFile(resolve(directory, `.${path}`, 'index.html'), 'utf8'), origin, path)
  return { verified: true, files: checked, canonical: true }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { console.log(JSON.stringify(await verifySiteBuild())) }
  catch (error) { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'SITE_BUILD_VERIFICATION_FAILED'); process.exitCode = 1 }
}
