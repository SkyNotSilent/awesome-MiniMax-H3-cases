export const addedDatePresets = ['unseen', 'today', '7d', '30d', 'all'] as const

export type AddedDatePreset = (typeof addedDatePresets)[number]

export const updatesSeenThroughKey = 'minimax-h3-updates-seen-through-v1'

export interface AddedAtItem {
  addedAt: string
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

function localDayStart(now: Date, daysAgo: number) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - daysAgo)
  return start.getTime()
}

export function matchesAddedDate(
  addedAt: string,
  preset: AddedDatePreset,
  since: string | null,
  now = new Date(),
) {
  const timestamp = Date.parse(addedAt)
  if (Number.isNaN(timestamp)) return false
  if (preset === 'all') return true
  if (timestamp > now.getTime()) return false
  if (preset === 'unseen') return Boolean(since) && timestamp > Date.parse(since!)
  if (preset === 'today') return timestamp >= localDayStart(now, 0)
  if (preset === '7d') return timestamp >= localDayStart(now, 6)
  return timestamp >= localDayStart(now, 29)
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
  since: string | null,
) {
  if (preset === 'all') return path
  const params = new URLSearchParams({ added: preset })
  if (preset === 'unseen' && since) params.set('since', since)
  return `${path}?${params.toString()}`
}
