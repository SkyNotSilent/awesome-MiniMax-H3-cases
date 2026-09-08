// Case buttons must open a creator post or an official model resource.
// Discovery catalogs are never public case destinations.
export function isOriginalCaseDestination(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
    const host = url.hostname.toLowerCase()
    if (host === 'x.com' || host === 'twitter.com') return /^\/[^/]+\/status\/\d+\/?$/.test(url.pathname)
    if (host === 'huggingface.co') return /^\/MiniMaxAI\/MiniMax-H3\/(blob|resolve)\//.test(url.pathname)
    if (host === 'reddit.com' || host === 'www.reddit.com') return /^\/r\/[^/]+\/comments\/[a-z0-9]+(?:\/[^/]*)?\/?$/i.test(url.pathname)
    if (host === 'youtube.com' || host === 'www.youtube.com') return url.pathname === '/watch' && /^[\w-]{11}$/.test(url.searchParams.get('v') || '')
    if (host === 'youtu.be') return /^\/[\w-]{11}$/.test(url.pathname)
    return false
  } catch {
    return false
  }
}
