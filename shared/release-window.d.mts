export interface ReleaseWindow { since: string; through: string }
export function latestReleaseWindow(maximum: string | null | undefined): ReleaseWindow | null
