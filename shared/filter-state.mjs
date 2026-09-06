export const filterKeys = ['category', 'style', 'scene', 'q', 'duration', 'prompt', 'collection', 'added', 'since', 'through']
export const durations = ['ALL', 'UP_TO_5', 'SIX_TO_10', 'ELEVEN_TO_15', 'OVER_15']
export const collections = ['all', 'featured', 'latest', 'official', 'favorites']
export const addedPresets = ['all', 'release', '7d', '30d']
// Retired shareable values keep resolving to the primary filter that replaced them.
const legacyCollections = { prompt: { prompt: true }, long: { duration: 'OVER_15' } }
// The personal since-last-visit and today views both became the latest release.
const legacyAddedPresets = { unseen: 'release', today: 'release' }
export function hasExplicitFilters(params) {
  return filterKeys.some(key => params.has(key))
}
export function parseFilters(params, taxonomy) {
  const pick = (key, allowed, fallback) => allowed.includes(params.get(key)) ? params.get(key) : fallback
  const rawCollection = params.get('collection')
  // Own-property checks keep prototype keys such as ?collection=constructor out of the state.
  const legacy = rawCollection !== null && Object.hasOwn(legacyCollections, rawCollection) ? legacyCollections[rawCollection] : {}
  const rawAdded = params.get('added')
  return {
    category: pick('category', taxonomy.categories.map(x => x.key), 'ALL'),
    style: pick('style', taxonomy.styles.map(x => x.key), 'ALL'),
    scene: pick('scene', taxonomy.scenes.map(x => x.key), 'ALL'),
    q: (params.get('q') ?? '').slice(0, 300),
    duration: pick('duration', durations, legacy.duration ?? 'ALL'),
    collection: pick('collection', collections, 'all'),
    prompt: params.get('prompt') === '1' || legacy.prompt === true,
    added: rawAdded !== null && Object.hasOwn(legacyAddedPresets, rawAdded) ? legacyAddedPresets[rawAdded] : pick('added', addedPresets, 'all'),
    since: params.get('since'), through: params.get('through'),
  }
}
export function writeFilters(url, state) {
  const keepAllDate = url.searchParams.has('added')
  for (const key of filterKeys) {
    const value = state[key]
    if (value && value !== 'ALL' && value !== 'all' && (!['since', 'through'].includes(key) || state.added === 'release')) {
      url.searchParams.set(key, value === true ? '1' : String(value))
    } else if (key === 'added' && value === 'all' && keepAllDate) url.searchParams.set('added', 'all')
    else url.searchParams.delete(key)
  }
  return `${url.pathname}${url.search}${url.hash}`
}
