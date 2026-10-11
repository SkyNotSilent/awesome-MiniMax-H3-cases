import site from '../config/site.json' with { type: 'json' }

export const primaryOrigin = site.primaryOrigin
export const legacyOrigins = site.legacyOrigins

export function resolveSiteOrigin({ environment = process.env, site: explicit, production = Boolean(environment.RAILWAY_ENVIRONMENT_ID) || environment.NODE_ENV === 'production' } = {}) {
  const values = [explicit, environment.PUBLIC_SITE_URL, environment.SITE_BASE_URL].filter(Boolean).map(value => {
    let url
    try { url = new URL(value) } catch { throw new Error('SITE_ORIGIN_INVALID') }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SITE_ORIGIN_INVALID')
    return url.origin
  })
  if (new Set(values).size > 1) throw new Error('SITE_ORIGIN_CONFLICT')
  const origin = values[0] || primaryOrigin
  if (production && origin !== primaryOrigin) throw new Error('SITE_ORIGIN_NOT_PRIMARY')
  return origin
}
