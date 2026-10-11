import { legacyOrigins, primaryOrigin } from './site-config.mjs'

const legacyHosts = new Set(legacyOrigins.map(value => new URL(value).host))

export function legacyPageRedirect({ host, path, method = 'GET', mode = 'off' }) {
  if (!['temporary', 'permanent'].includes(mode) || !['GET', 'HEAD'].includes(method) || !legacyHosts.has(String(host).toLowerCase())) return null
  if (!path?.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  const pathname = path.split('?')[0]
  // Keep a narrow entry on the old origin so its browser favorites can be imported.
  if (['/', '/en/'].includes(pathname) && new URLSearchParams(path.split('?')[1] || '').get('importFavorites') === '1') return null
  if (/^\/(?:api|media|assets|posters|data|fonts)(?:\/|$)/.test(pathname) || /\.[^/]+$/.test(pathname)) return null
  return { status: mode === 'permanent' ? 308 : 302, location: `${primaryOrigin}${path}` }
}
