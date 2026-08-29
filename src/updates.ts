export const addedDatePresets = ['unseen', 'today', '7d', '30d', 'all'] as const

export type AddedDatePreset = (typeof addedDatePresets)[number]
export type UpdateChannel = 'cases' | 'tutorials'

export const legacyUpdatesSeenThroughKey = 'minimax-h3-updates-seen-through-v1'
export const caseUpdatesSeenThroughKey = 'minimax-h3-cases-seen-through-v2'
export const tutorialUpdatesSeenThroughKey = 'minimax-h3-tutorials-seen-through-v2'
export const updateSessionStorageKey = 'minimax-h3-update-session-v2'

// Kept as an export for one release so older integrations can migrate without breaking.
export const updatesSeenThroughKey = legacyUpdatesSeenThroughKey

export interface AddedAtItem {
  addedAt: string
}

export interface AddedDateContext {
  since?: string | null
  through?: string | null
  now?: Date
}

export interface StoredUpdateWindow {
  since: string
  through: string
}

export interface StoredUpdateSession {
  version: 2
  firstVisit: boolean
  cases?: StoredUpdateWindow
  tutorials?: StoredUpdateWindow
}

const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

export function validAddedAt(value: string | null | undefined): value is string {
  return typeof value === 'string' && isoDateTimePattern.test(value) && !Number.isNaN(Date.parse(value))
}

export function maxAddedAt(items: readonly AddedAtItem[]): string {
  return items.reduce((latest, item) => {
    if (!validAddedAt(item.addedAt)) return latest
    if (!latest || Date.parse(item.addedAt) > Date.parse(latest)) return item.addedAt
    return latest
  }, '')
}

export function parseAddedDatePreset(value: string | null): AddedDatePreset {
  return addedDatePresets.includes(value as AddedDatePreset) ? value as AddedDatePreset : 'all'
}

export function parseSince(value: string | null): string | null {
  return validAddedAt(value) ? new Date(value).toISOString() : null
}

export function clampAddedAt(value: string | null, maximum: string): string | null {
  const parsed = parseSince(value)
  const parsedMaximum = parseSince(maximum)
  if (!parsed || !parsedMaximum) return null
  return Date.parse(parsed) > Date.parse(parsedMaximum) ? parsedMaximum : parsed
}

export function validUpdateWindow(value: unknown, maximum: string): StoredUpdateWindow | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<StoredUpdateWindow>
  const since = parseSince(candidate.since ?? null)
  const through = clampAddedAt(candidate.through ?? null, maximum)
  if (!since || !through || Date.parse(through) < Date.parse(since)) return null
  return { since, through }
}

export function parseStoredUpdateSession(value: string | null): StoredUpdateSession | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<StoredUpdateSession>
    if (parsed.version !== 2 || typeof parsed.firstVisit !== 'boolean') return null
    return {
      version: 2,
      firstVisit: parsed.firstVisit,
      ...(parsed.cases ? { cases: parsed.cases } : {}),
      ...(parsed.tutorials ? { tutorials: parsed.tutorials } : {}),
    }
  } catch {
    return null
  }
}

function localDayStart(now: Date, daysAgo: number) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - daysAgo)
  return start.getTime()
}

export function matchesAddedDate(
  addedAt: string,
  preset: AddedDatePreset,
  context: AddedDateContext = {},
) {
  const timestamp = Date.parse(addedAt)
  if (Number.isNaN(timestamp)) return false
  if (preset === 'all') return true

  const now = context.now ?? new Date()
  if (preset === 'unseen') {
    const since = parseSince(context.since ?? null)
    const through = parseSince(context.through ?? null)
    return Boolean(since && through)
      && timestamp > Date.parse(since!)
      && timestamp <= Date.parse(through!)
  }

  if (timestamp > now.getTime()) return false
  if (preset === 'today') return timestamp >= localDayStart(now, 0)
  if (preset === '7d') return timestamp >= localDayStart(now, 6)
  return timestamp >= localDayStart(now, 29)
}

export function sortByAddedAtDescending<T extends AddedAtItem>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => Date.parse(b.item.addedAt) - Date.parse(a.item.addedAt) || a.index - b.index)
    .map(({ item }) => item)
}

export function formatAddedDate(addedAt: string, language: 'zh' | 'en') {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en', {
    month: language === 'zh' ? 'long' : 'short',
    day: 'numeric',
  }).format(new Date(addedAt))
}

export function addedDateHref(
  path: string,
  preset: AddedDatePreset,
  context: Pick<AddedDateContext, 'since' | 'through'> = {},
) {
  if (preset === 'all') return path
  const params = new URLSearchParams({ added: preset })
  if (preset === 'unseen' && context.since) params.set('since', context.since)
  if (preset === 'unseen' && context.through) params.set('through', context.through)
  return `${path}?${params.toString()}`
}
