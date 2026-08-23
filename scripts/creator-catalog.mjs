const DAY = 86_400_000

export const creatorRankKeys = ['overall', 'active', 'cases', 'prompts', 'rising', 'tutorials']

export function normalizeHandle(value = '') {
  return String(value).trim().replace(/^@/, '').toLowerCase()
}

export function extractXHandle(sourceUrl = '') {
  try {
    const url = new URL(sourceUrl)
    if (!/(^|\.)x\.com$/i.test(url.hostname)) return null
    const handle = url.pathname.split('/').filter(Boolean)[0]
    if (!handle || handle.toLowerCase() === 'i') return null
    return normalizeHandle(handle)
  } catch {
    return null
  }
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const finite = (value) => Number.isFinite(value) ? value : 0
const parsedTime = (value) => Number.isNaN(Date.parse(value)) ? 0 : Date.parse(value)
const newestFirst = (a, b) => parsedTime(b.addedAt) - parsedTime(a.addedAt)
const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function engagementSignal(item) {
  if (!item.engagement) return null
  const { likes, reposts, replies, views } = item.engagement
  if (![likes, reposts, replies, views].every(Number.isFinite)) return null
  return Math.log1p(likes)
    + 1.3 * Math.log1p(reposts)
    + 0.8 * Math.log1p(replies)
    + 0.25 * Math.log1p(views)
}

function engagementAgeBucket(item) {
  const snapshotAt = item.engagement?.snapshotAt ?? item.engagement?.capturedAt
  const ageDays = (parsedTime(snapshotAt) - parsedTime(item.publishedAt)) / DAY
  if (!Number.isFinite(ageDays) || ageDays < 0) return 'unknown'
  if (ageDays <= 1) return 'day-1'
  if (ageDays <= 3) return 'day-3'
  if (ageDays <= 7) return 'day-7'
  return 'mature'
}

function percentile(value, cohort) {
  if (!cohort.length) return 0
  const below = cohort.filter((candidate) => candidate < value).length
  const equal = cohort.filter((candidate) => candidate === value).length
  return clamp((below + equal * 0.5) / cohort.length)
}

function engagementPercentiles(cases) {
  const measured = cases
    .map((item) => ({ id: item.id, bucket: engagementAgeBucket(item), signal: engagementSignal(item) }))
    .filter((item) => item.signal !== null)
  const all = measured.map((item) => item.signal)
  const byBucket = new Map()
  for (const item of measured) {
    const values = byBucket.get(item.bucket) ?? []
    values.push(item.signal)
    byBucket.set(item.bucket, values)
  }
  return new Map(measured.map((item) => {
    const cohort = byBucket.get(item.bucket)
    return [item.id, percentile(item.signal, cohort.length >= 8 ? cohort : all)]
  }))
}

function weekKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day)
  return date.toISOString().slice(0, 10)
}

function daysSince(value, now) {
  const time = parsedTime(value)
  return time ? Math.max(0, (now.getTime() - time) / DAY) : Number.POSITIVE_INFINITY
}

function recentWeight(value, now, halfLifeDays = 14) {
  const days = daysSince(value, now)
  return Number.isFinite(days) ? Math.exp((-Math.LN2 * days) / halfLifeDays) : 0
}

function cleanDisplayName(value, handle) {
  const cleaned = String(value ?? '').trim()
  if (!cleaned || normalizeHandle(cleaned) === handle) return `@${handle}`
  return cleaned
}

function identityResolver(aliasConfig = { creators: [] }) {
  const aliases = new Map()
  for (const entry of aliasConfig.creators ?? []) {
    const currentHandle = normalizeHandle(entry.currentHandle)
    if (!entry.id || !currentHandle) continue
    for (const handle of [currentHandle, ...(entry.aliases ?? []).map(normalizeHandle)]) {
      aliases.set(handle, {
        id: entry.id,
        currentHandle,
        aliases: [...new Set((entry.aliases ?? []).map(normalizeHandle).filter(Boolean))],
        displayName: entry.displayName,
      })
    }
  }
  return (handle) => aliases.get(handle) ?? {
    id: `x-${handle}`,
    currentHandle: handle,
    aliases: [],
    displayName: undefined,
  }
}

function assignRanks(items, key, score, eligible = () => true) {
  const ranked = items
    .filter(eligible)
    .sort((a, b) => score(b) - score(a) || b.caseCount - a.caseCount || a.handle.localeCompare(b.handle))
  ranked.forEach((item, index) => {
    item._scores[key] = score(item)
    item.ranks[key] = index + 1
  })
}

function normalizedLog(value, max) {
  return max > 0 ? Math.log1p(value) / Math.log1p(max) : 0
}

function completenessScore(tutorial) {
  return [
    tutorial.commands?.length,
    tutorial.checks?.zh?.length && tutorial.checks?.en?.length,
    tutorial.troubleshooting?.length,
    tutorial.expectedResult?.zh && tutorial.expectedResult?.en,
    tutorial.testedVersions?.length,
  ].filter(Boolean).length / 5
}

function publicCreator(item, previousById) {
  const previous = previousById.get(item.id)
  const previousRanks = previous?.ranks ?? {}
  const rankDelta = Object.fromEntries(creatorRankKeys.map((key) => [
    key,
    item.ranks[key] && previousRanks[key] ? previousRanks[key] - item.ranks[key] : null,
  ]))
  const safe = Object.fromEntries(Object.entries(item).filter(([key]) => !key.startsWith('_')))
  return { ...safe, rankDelta }
}

export function buildCreatorCatalog(cases, tutorialGuides, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now())
  const resolveIdentity = identityResolver(options.aliasConfig)
  const previousById = new Map((options.previousCatalog?.creators ?? []).map((item) => [item.id, item]))
  const engagementByCase = engagementPercentiles(cases)
  const creators = new Map()

  const ensure = (handle) => {
    const identity = resolveIdentity(handle)
    if (!creators.has(identity.id)) {
      creators.set(identity.id, {
        id: identity.id,
        slug: identity.currentHandle,
        handle: identity.currentHandle,
        aliases: identity.aliases,
        displayName: identity.displayName ?? `@${identity.currentHandle}`,
        xUrl: `https://x.com/${identity.currentHandle}`,
        roles: [],
        caseIds: [],
        promptCaseIds: [],
        tutorialIds: [],
        representativeCaseIds: [],
        latestCaseIds: [],
        caseCount: 0,
        promptCount: 0,
        promptRate: 0,
        tutorialCount: 0,
        recentCaseCount: 0,
        activeWeeks: 0,
        firstAddedAt: null,
        lastAddedAt: null,
        engagementPercentile: 0,
        badges: [],
        reasons: [],
        ranks: Object.fromEntries(creatorRankKeys.map((key) => [key, null])),
        _scores: {},
        _caseEngagement: [],
        _tutorialEngagement: [],
        _caseRecords: [],
        _tutorialRecords: [],
      })
    }
    return creators.get(identity.id)
  }

  for (const item of cases) {
    const handle = extractXHandle(item.sourceUrl)
    if (!handle || item.sourceType !== 'x') continue
    const creator = ensure(handle)
    creator._caseRecords.push(item)
    creator.displayName = cleanDisplayName(item.author, creator.handle)
    const engagement = engagementByCase.get(item.id)
    if (Number.isFinite(engagement)) creator._caseEngagement.push(engagement)
  }

  for (const tutorial of tutorialGuides) {
    if (tutorial.contentType !== 'community' || tutorial.source?.platform !== 'x') continue
    const handle = normalizeHandle(tutorial.source.handle) || extractXHandle(tutorial.source.url)
    if (!handle) continue
    const creator = ensure(handle)
    creator._tutorialRecords.push(tutorial)
    if (creator.displayName.startsWith('@')) creator.displayName = cleanDisplayName(tutorial.source.author, creator.handle)
    if (tutorial.engagement) {
      const signal = Math.log1p(finite(tutorial.engagement.likes))
        + 1.3 * Math.log1p(finite(tutorial.engagement.reposts))
        + 0.8 * Math.log1p(finite(tutorial.engagement.replies))
        + 0.25 * Math.log1p(finite(tutorial.engagement.views))
      creator._tutorialEngagement.push(signal)
    }
  }

  const allCreators = [...creators.values()]
  for (const creator of allCreators) {
    creator._caseRecords.sort(newestFirst)
    creator._tutorialRecords.sort(newestFirst)
    creator.caseIds = creator._caseRecords.map((item) => item.id)
    creator.promptCaseIds = creator._caseRecords
      .filter((item) => item.promptProvenance !== 'not-published' && item.prompt?.trim())
      .map((item) => item.id)
    creator.tutorialIds = creator._tutorialRecords.map((item) => item.id)
    creator.caseCount = creator.caseIds.length
    creator.promptCount = creator.promptCaseIds.length
    creator.promptRate = creator.caseCount ? Number((creator.promptCount / creator.caseCount).toFixed(3)) : 0
    creator.tutorialCount = creator.tutorialIds.length
    creator.recentCaseCount = creator._caseRecords.filter((item) => daysSince(item.addedAt, now) <= 30).length
    creator.activeWeeks = new Set(creator._caseRecords.map((item) => weekKey(item.publishedAt)).filter(Boolean)).size
    const allAdded = [...creator._caseRecords, ...creator._tutorialRecords].map((item) => item.addedAt).filter(Boolean).sort()
    creator.firstAddedAt = allAdded[0] ?? null
    creator.lastAddedAt = allAdded.at(-1) ?? null
    creator.engagementPercentile = Number(median(creator._caseEngagement).toFixed(3))
    creator._recentWeight = creator._caseRecords.reduce((sum, item) => sum + recentWeight(item.addedAt, now), 0)
    creator._tutorialRecentWeight = creator._tutorialRecords.reduce((sum, item) => sum + recentWeight(item.addedAt, now, 21), 0)
    creator._tutorialCompleteness = creator._tutorialRecords.length
      ? creator._tutorialRecords.reduce((sum, item) => sum + completenessScore(item), 0) / creator._tutorialRecords.length
      : 0
    creator._tutorialEngagementMedian = median(creator._tutorialEngagement)
    creator._hasBreakout = creator._caseEngagement.some((value) => value >= 0.9)
    creator._hasHostedVideo = creator._caseRecords.some((item) => item.mediaUrl === `/media/${item.id}.mp4`)
    creator._videoEligible = creator._hasHostedVideo && (creator.caseCount >= 2 || creator._hasBreakout)
    creator._tutorialEligible = creator.tutorialCount > 0
    creator.roles = [creator._videoEligible ? 'video' : null, creator._tutorialEligible ? 'tutorial' : null].filter(Boolean)
    creator.representativeCaseIds = [...creator._caseRecords]
      .sort((a, b) => {
        const promptDelta = Number(Boolean(b.prompt)) - Number(Boolean(a.prompt))
        return promptDelta || finite(engagementByCase.get(b.id)) - finite(engagementByCase.get(a.id)) || newestFirst(a, b)
      })
      .slice(0, 3)
      .map((item) => item.id)
    creator.latestCaseIds = creator.caseIds.slice(0, 6)
  }

  const publicCreators = allCreators.filter((creator) => creator._videoEligible || creator._tutorialEligible)
  const videoCreators = publicCreators.filter((creator) => creator._videoEligible)
  const tutorialCreators = publicCreators.filter((creator) => creator._tutorialEligible)
  const maxCases = Math.max(0, ...videoCreators.map((item) => item.caseCount))
  const maxPrompts = Math.max(0, ...videoCreators.map((item) => item.promptCount))
  const maxRecent = Math.max(0, ...videoCreators.map((item) => item._recentWeight))
  const maxWeeks = Math.max(0, ...videoCreators.map((item) => item.activeWeeks))
  const maxTutorials = Math.max(0, ...tutorialCreators.map((item) => item.tutorialCount))
  const maxTutorialRecent = Math.max(0, ...tutorialCreators.map((item) => item._tutorialRecentWeight))
  const maxTutorialEngagement = Math.max(0, ...tutorialCreators.map((item) => item._tutorialEngagementMedian))

  const overall = (item) => 0.35 * normalizedLog(item.caseCount, maxCases)
    + 0.25 * normalizedLog(item.promptCount, maxPrompts)
    + 0.2 * (maxRecent ? item._recentWeight / maxRecent : 0)
    + 0.1 * normalizedLog(item.activeWeeks, maxWeeks)
    + 0.1 * item.engagementPercentile
  const active = (item) => maxRecent ? item._recentWeight / maxRecent : 0
  const prompt = (item) => item.promptCount + item.promptRate / 10
  const rising = (item) => 0.65 * active(item) + 0.35 * item.engagementPercentile
  const tutorial = (item) => 0.4 * normalizedLog(item.tutorialCount, maxTutorials)
    + 0.25 * item._tutorialCompleteness
    + 0.2 * (maxTutorialEngagement ? item._tutorialEngagementMedian / maxTutorialEngagement : 0)
    + 0.15 * (maxTutorialRecent ? item._tutorialRecentWeight / maxTutorialRecent : 0)

  assignRanks(videoCreators, 'overall', overall)
  assignRanks(videoCreators, 'active', active)
  assignRanks(videoCreators, 'cases', (item) => item.caseCount)
  assignRanks(videoCreators, 'prompts', prompt)
  assignRanks(videoCreators, 'rising', rising, (item) => daysSince(item.firstAddedAt, now) <= 30)
  assignRanks(tutorialCreators, 'tutorials', tutorial)

  const prolificFloor = [...videoCreators].sort((a, b) => b.caseCount - a.caseCount)[Math.max(0, Math.ceil(videoCreators.length * 0.1) - 1)]?.caseCount ?? 4
  for (const creator of publicCreators) {
    if (creator.caseCount >= Math.max(4, prolificFloor)) creator.badges.push('prolific')
    if (creator.promptCount >= 3 && creator.promptRate >= 0.5) creator.badges.push('prompt-contributor')
    if (creator.recentCaseCount > 0) creator.badges.push('recently-active')
    if (creator.ranks.rising) creator.badges.push('rising')
    if (creator._hasBreakout) creator.badges.push('breakout')
    if (creator.tutorialCount > 0) creator.badges.push('guide-author')
    if (creator.activeWeeks >= 3) creator.badges.push('consistent')

    const reasons = [
      [creator.caseCount >= Math.max(4, prolificFloor), 'high-output'],
      [creator.promptCount >= 3 && creator.promptRate >= 0.5, 'prompt-contributor'],
      [creator.recentCaseCount > 0, 'recently-active'],
      [creator._hasBreakout, 'breakout'],
      [creator.tutorialCount > 0, 'tutorial-author'],
      [creator.activeWeeks >= 3, 'consistent'],
    ].filter(([enabled]) => enabled).map(([, reason]) => reason)
    creator.reasons = reasons.slice(0, 3)
  }

  const published = publicCreators
    .map((item) => publicCreator(item, previousById))
    .sort((a, b) => finite(a.ranks.overall) - finite(b.ranks.overall) || finite(a.ranks.tutorials) - finite(b.ranks.tutorials) || a.handle.localeCompare(b.handle))

  return {
    version: 1,
    generatedAt: now.toISOString(),
    methodology: 'site-verified-content',
    stats: {
      sourceCreators: allCreators.filter((item) => item.caseCount > 0).length,
      rankedCreators: published.length,
      videoCreators: videoCreators.length,
      tutorialCreators: tutorialCreators.length,
    },
    creators: published,
  }
}
