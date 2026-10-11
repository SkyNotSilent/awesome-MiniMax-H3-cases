export const primaryOrigin: string
export const legacyOrigins: string[]
export function resolveSiteOrigin(options?: { environment?: NodeJS.ProcessEnv; site?: string; production?: boolean }): string
