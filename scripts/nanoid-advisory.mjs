// nanoid contains an infinite loop in customAlphabet/customRandom when
// called with size=0 (CWE-835). Fixed in 3.3.18 (3.x backport) and 5.1.6 (5.x).
// GHSA-2v37-7h3g-55p8 / CVE-2026-67213
// https://github.com/advisories/GHSA-2v37-7h3g-55p8
export const NANOID_ADVISORY = {
  id: 'GHSA-2v37-7h3g-55p8',
  cve: 'CVE-2026-67213',
  url: 'https://github.com/advisories/GHSA-2v37-7h3g-55p8',
}

// Two disjoint affected ranges: the pre-patch 3.x line, and the 4.x/5.x line
// before its own fix. Omitting `gte` means "no lower bound" (i.e. just `< lt`).
export const AFFECTED_RANGES = [
  { lt: [3, 3, 18] },
  { gte: [4, 0, 0], lt: [5, 1, 6] },
]

export const SAFE_VERSIONS_NOTE = '3.3.18 (3.x line) or >=5.1.6 (5.x line)'

const NANOID_PACKAGE_PATH_PATTERN = /(^|\/)node_modules\/nanoid$/

export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version))
  if (!match) throw new Error(`Cannot parse version: ${version}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

export function isNanoidVersionAffected(version) {
  const parsed = parseVersion(version)
  return AFFECTED_RANGES.some(({ gte, lt }) => {
    const aboveLower = !gte || compareVersions(parsed, gte) >= 0
    const belowUpper = compareVersions(parsed, lt) < 0
    return aboveLower && belowUpper
  })
}

// Walks the lockfile's `packages` map (npm lockfileVersion >=2/3 shape) and
// returns every nanoid occurrence - flattened top-level or nested under any
// other package's node_modules - whose resolved version is affected.
export function findAffectedNanoidEntries(lockfile) {
  const packages = lockfile?.packages ?? {}
  const results = []
  for (const [path, entry] of Object.entries(packages)) {
    if (!NANOID_PACKAGE_PATH_PATTERN.test(path)) continue
    const version = entry?.version
    if (version && isNanoidVersionAffected(version)) {
      results.push({ path, version })
    }
  }
  return results
}
