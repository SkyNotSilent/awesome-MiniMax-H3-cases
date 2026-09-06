import type { AppPage } from './i18n'
import type { CatalogPayload } from './types'
import { hasExplicitFilters } from '../shared/filter-state.mjs'
import { caseUpdatesSeenThroughKey, clampAddedAt, legacyUpdatesSeenThroughKey, matchesAddedDate, maxAddedAt, parseAddedDatePreset, parseSince, parseStoredUpdateSession, todayUpdateWindow, tutorialUpdatesSeenThroughKey, validUpdateWindow, updateSessionStorageKey, type AddedDatePreset, type StoredUpdateSession, type StoredUpdateWindow, type UpdateChannel } from './updates'

// 'last-visit' compares against the stored baseline; 'today' is the fallback for
// visitors without one (first visit or blocked storage).
export type UpdateWindowBasis = 'last-visit' | 'today'

interface ChannelUpdateSession extends StoredUpdateWindow {
  count: number
  explicit: boolean
  basis: UpdateWindowBasis
}

export interface UpdateSession {
  cases: ChannelUpdateSession
  tutorials: ChannelUpdateSession
  initialCasePreset: AddedDatePreset
  initialTutorialPreset: AddedDatePreset
  firstVisit: boolean
  persistentBaselines: Record<UpdateChannel, string>
  storedSession: StoredUpdateSession
  storageAvailable: boolean
  sessionStorageAvailable: boolean
}

export function createUpdateSession(
  catalog: CatalogPayload,
  routePage: AppPage,
): UpdateSession {
  const { cases, tutorials, summary } = catalog
  const maxima = summary?.maxima ?? {
    cases: maxAddedAt(cases),
    tutorials: maxAddedAt(tutorials),
  }
  const params = new URLSearchParams(window.location.search)
  const rawPreset = params.get('added')
  const requestedPreset = parseAddedDatePreset(rawPreset)
  const invalidPreset = rawPreset !== null && requestedPreset === 'all' && rawPreset !== 'all'
  const rawSince = params.get('since')
  const requestedSince = parseSince(rawSince)
  const rawThrough = params.get('through')
  const requestedThrough = parseSince(rawThrough)
  const invalidSince = requestedPreset === 'unseen' && rawSince !== null && requestedSince === null
  const invalidThrough = requestedPreset === 'unseen' && rawThrough !== null && requestedThrough === null
  const invalidRangeOrder = Boolean(requestedSince && requestedThrough)
    && Date.parse(requestedThrough!) < Date.parse(requestedSince!)
  const invalidExplicitWindow = invalidSince || invalidThrough || invalidRangeOrder
  // A shared fixed snapshot behaves like a returning visit, as before.
  const explicitRequested = requestedPreset === 'unseen' && !invalidExplicitWindow && rawSince !== null && Boolean(requestedSince)

  let storageAvailable = true
  let sessionStorageAvailable = true
  let legacyBaseline: string | null = null
  let storedCaseBaseline: string | null = null
  let storedTutorialBaseline: string | null = null
  let restoredSession: StoredUpdateSession | null = null
  try {
    legacyBaseline = parseSince(window.localStorage.getItem(legacyUpdatesSeenThroughKey))
    storedCaseBaseline = parseSince(window.localStorage.getItem(caseUpdatesSeenThroughKey))
    storedTutorialBaseline = parseSince(window.localStorage.getItem(tutorialUpdatesSeenThroughKey))
  } catch {
    storageAvailable = false
  }
  try {
    restoredSession = parseStoredUpdateSession(window.sessionStorage.getItem(updateSessionStorageKey))
  } catch {
    sessionStorageAvailable = false
  }

  const hadHistory = Boolean(storedCaseBaseline || storedTutorialBaseline || legacyBaseline)
  const persistentBaselines = {
    cases: clampAddedAt(storedCaseBaseline ?? legacyBaseline, maxima.cases) ?? maxima.cases,
    tutorials: clampAddedAt(storedTutorialBaseline ?? legacyBaseline, maxima.tutorials) ?? maxima.tutorials,
  }
  const firstVisit = explicitRequested ? false : (restoredSession?.firstVisit ?? !hadHistory)
  const basis: UpdateWindowBasis = storageAvailable && !firstVisit ? 'last-visit' : 'today'
  const now = new Date()

  const buildWindow = <T extends { id: string; addedAt: string }>(
    channel: UpdateChannel,
    items: readonly T[],
  ): ChannelUpdateSession => {
    const maximum = maxima[channel]
    // Only a last-visit batch is frozen for the tab; the today fallback is
    // recomputed on every load so newly published items are never hidden.
    const restored = basis === 'last-visit' && restoredSession?.[channel]
      ? validUpdateWindow(restoredSession[channel], maximum)
      : null
    const window = restored ?? (basis === 'last-visit'
      ? { since: persistentBaselines[channel], through: maximum }
      : todayUpdateWindow(maximum, now))
    const ids = new Set(items
      .filter((item) => matchesAddedDate(item.addedAt, 'unseen', window))
      .map((item) => item.id))
    return { ...window, count: summary?.counts[channel] ?? ids.size, explicit: false, basis }
  }

  let caseWindow = buildWindow('cases', cases)
  let tutorialWindow = buildWindow('tutorials', tutorials)

  const currentChannel: UpdateChannel = routePage === 'tutorials' ? 'tutorials' : 'cases'
  const currentItems = currentChannel === 'cases' ? cases : tutorials
  const currentMaximum = maxima[currentChannel]

  if (explicitRequested && requestedSince) {
    const since = clampAddedAt(requestedSince, currentMaximum) ?? currentMaximum
    const through = clampAddedAt(requestedThrough ?? currentMaximum, currentMaximum) ?? currentMaximum
    const explicitWindow: ChannelUpdateSession = {
      since,
      through,
      count: summary?.counts[currentChannel] ?? currentItems.filter(item => matchesAddedDate(item.addedAt, 'unseen', { since, through })).length,
      explicit: true,
      basis: 'last-visit',
    }
    if (currentChannel === 'cases') caseWindow = explicitWindow
    else tutorialWindow = explicitWindow
  }

  const storedSession: StoredUpdateSession = {
    version: 2,
    firstVisit,
    ...(caseWindow.count > 0 && !caseWindow.explicit && caseWindow.basis === 'last-visit'
      ? { cases: { since: caseWindow.since, through: caseWindow.through } }
      : {}),
    ...(tutorialWindow.count > 0 && !tutorialWindow.explicit && tutorialWindow.basis === 'last-visit'
      ? { tutorials: { since: tutorialWindow.since, through: tutorialWindow.through } }
      : {}),
  }

  const hasExplicitHomeFilter = hasExplicitFilters(params)
  const hasExplicitTutorialFilter = ['added', 'since', 'through'].some((key) => params.has(key))
  const requestedPresetIsValid = !invalidPreset && !invalidExplicitWindow
  const initialCasePreset = routePage === 'home'
    ? rawPreset !== null
      ? requestedPresetIsValid ? requestedPreset : 'all'
      : basis === 'last-visit' && !hasExplicitHomeFilter && caseWindow.count > 0
        ? 'unseen'
        : 'all'
    : 'all'
  const initialTutorialPreset = routePage === 'tutorials'
    ? rawPreset !== null
      ? requestedPresetIsValid ? requestedPreset : 'all'
      : basis === 'last-visit' && !hasExplicitTutorialFilter && tutorialWindow.count > 0
        ? 'unseen'
        : 'all'
    : 'all'

  return {
    cases: caseWindow,
    tutorials: tutorialWindow,
    initialCasePreset,
    initialTutorialPreset,
    firstVisit,
    persistentBaselines,
    storedSession,
    storageAvailable,
    sessionStorageAvailable,
  }
}
