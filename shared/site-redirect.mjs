import { legacyOrigins, primaryOrigin } from './site-config.mjs'

const legacyHosts = new Set(legacyOrigins.map(value => new URL(value).host))

export function legacyPageRedirect({ host, path, method = 'GET', mode = 'off' }) {
  if (!['temporary', 'permanent'].includes(mode) || !['GET', 'HEAD'].includes(method) || !legacyHosts.has(String(host).toLowerCase())) return null
  if (!path?.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  const pathname = path.split('?')[0]
  if (/^\/(?:api|media|assets|posters|data|fonts)(?:\/|$)/.test(pathname) || /\.[^/]+$/.test(pathname)) return null
  return { status: mode === 'permanent' ? 308 : 302, location: `${primaryOrigin}${path}` }
}
