import { latestReleaseWindow, type ReleaseWindow } from '../shared/release-window.mjs'

export const addedDatePresets = ['all', 'release', '7d', '30d'] as const

export type AddedDatePreset = (typeof addedDatePresets)[number]
export type UpdateChannel = 'cases' | 'tutorials'
export type { ReleaseWindow }
export { latestReleaseWindow }

// Older links used the personal since-last-visit and today views; both now
// resolve to the latest release.
const legacyAddedDatePresets: Record<string, AddedDatePreset> = { unseen: 'release', today: 'release' }

export interface AddedAtItem {
  addedAt: string
}

export interface AddedDateContext {
  since?: string | null
  through?: string | null
  now?: Date
}

const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/

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
  if (value !== null && Object.hasOwn(legacyAddedDatePresets, value)) return legacyAddedDatePresets[value]
  return addedDatePresets.includes(value as AddedDatePreset) ? value as AddedDatePreset : 'all'
}

function parseInstant(value: string | null | undefined): number | null {
  return validAddedAt(value) ? Date.parse(value) : null
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
  if (preset === 'release') {
    const since = parseInstant(context.since)
    const through = parseInstant(context.through)
    return since !== null && through !== null && timestamp > since && timestamp <= through
  }

  if (timestamp > now.getTime()) return false
  if (preset === '7d') return timestamp >= localDayStart(now, 6)
  return timestamp >= localDayStart(now, 29)
}

export function sortByAddedAtDescending<T extends AddedAtItem>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => Date.parse(b.item.addedAt) - Date.parse(a.item.addedAt) || a.index - b.index)
    .map(({ item }) => item)
}

// Date-only values (the published release day) are calendar dates, so they are
// read in the viewer's own zone instead of as UTC midnight.
export function formatAddedDate(addedAt: string, language: 'zh' | 'en') {
  const dateOnly = dateOnlyPattern.exec(addedAt)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(addedAt)
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en', {
    month: language === 'zh' ? 'long' : 'short',
    day: 'numeric',
  }).format(date)
}

export function addedDateHref(path: string, preset: AddedDatePreset) {
  if (preset === 'all') return path
  return `${path}?${new URLSearchParams({ added: preset }).toString()}`
}
