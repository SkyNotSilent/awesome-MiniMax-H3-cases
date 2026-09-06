// Catalog publishes are dated in Asia/Shanghai (UTC+8, no daylight saving), so a
// release is every item added on the same Shanghai calendar day as the newest
// one. The window is shared by the browser and the catalog API so both count
// the same items.
const catalogDayOffsetMs = 8 * 60 * 60 * 1000
const dayMs = 24 * 60 * 60 * 1000

export function latestReleaseWindow(maximum) {
  const latest = Date.parse(maximum ?? '')
  if (!Number.isFinite(latest)) return null
  const dayStart = Math.floor((latest + catalogDayOffsetMs) / dayMs) * dayMs - catalogDayOffsetMs
  // `since` is exclusive, so back it up one millisecond to include the day start.
  return { since: new Date(dayStart - 1).toISOString(), through: new Date(latest).toISOString() }
}
