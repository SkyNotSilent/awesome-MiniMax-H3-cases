import type { CatalogPayload } from './types'
import { latestReleaseWindow, matchesAddedDate, maxAddedAt, type ReleaseWindow, type UpdateChannel } from './updates'

export interface ReleaseBatch extends ReleaseWindow {
  count: number
}

export type ReleaseBatches = Record<UpdateChannel, ReleaseBatch>

// The latest release is the same for every visitor: everything added on the
// newest catalog day of each channel. Nothing about it is stored in the browser.
export function createReleaseBatches(catalog: CatalogPayload): ReleaseBatches {
  const { cases, tutorials, summary } = catalog
  const maxima = summary?.maxima ?? {
    cases: maxAddedAt(cases),
    tutorials: maxAddedAt(tutorials),
  }
  const build = (channel: UpdateChannel, items: readonly { addedAt: string }[]): ReleaseBatch => {
    const maximum = maxima[channel]
    const window = latestReleaseWindow(maximum) ?? { since: maximum, through: maximum }
    const count = summary?.counts[channel]
      ?? items.filter((item) => matchesAddedDate(item.addedAt, 'release', window)).length
    return { ...window, count }
  }
  return { cases: build('cases', cases), tutorials: build('tutorials', tutorials) }
}
