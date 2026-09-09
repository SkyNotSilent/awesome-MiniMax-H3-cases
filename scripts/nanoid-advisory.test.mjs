import { describe, expect, it } from 'vitest'
import { compareVersions, findAffectedNanoidEntries, isNanoidVersionAffected, parseVersion } from './nanoid-advisory.mjs'

const lockfileWith = (entries) => ({
  lockfileVersion: 3,
  packages: { '': {}, ...entries },
})

describe('isNanoidVersionAffected', () => {
  it('flags versions just below the 3.x patch', () => {
    expect(isNanoidVersionAffected('3.3.17')).toBe(true)
  })
  it('passes the exact 3.x patched version', () => {
    expect(isNanoidVersionAffected('3.3.18')).toBe(false)
  })
  it('flags 4.x versions below the 5.x patch', () => {
    expect(isNanoidVersionAffected('4.0.2')).toBe(true)
  })
  it('passes the exact 5.x patched version', () => {
    expect(isNanoidVersionAffected('5.1.6')).toBe(false)
  })
  it('passes versions well above the 5.x patch', () => {
    expect(isNanoidVersionAffected('5.2.0')).toBe(false)
  })
})

describe('findAffectedNanoidEntries', () => {
  it('reports an affected top-level nanoid entry', () => {
    const lockfile = lockfileWith({ 'node_modules/nanoid': { version: '3.3.10' } })
    expect(findAffectedNanoidEntries(lockfile)).toEqual([{ path: 'node_modules/nanoid', version: '3.3.10' }])
  })

  it('passes a patched top-level nanoid entry', () => {
    const lockfile = lockfileWith({ 'node_modules/nanoid': { version: '3.3.18' } })
    expect(findAffectedNanoidEntries(lockfile)).toEqual([])
  })

  it('reports nanoid nested only under another package (transitive), not flattened', () => {
    const lockfile = lockfileWith({
      'node_modules/postcss': { dependencies: { nanoid: '^3.3.16' } },
      'node_modules/postcss/node_modules/nanoid': { version: '3.3.10' },
    })
    expect(findAffectedNanoidEntries(lockfile)).toEqual([
      { path: 'node_modules/postcss/node_modules/nanoid', version: '3.3.10' },
    ])
  })

  it('passes a patched nested/transitive nanoid entry', () => {
    const lockfile = lockfileWith({
      'node_modules/postcss': { dependencies: { nanoid: '^3.3.16' } },
      'node_modules/postcss/node_modules/nanoid': { version: '3.3.18' },
    })
    expect(findAffectedNanoidEntries(lockfile)).toEqual([])
  })

  it('does not misread a dependency range as a resolved version', () => {
    const lockfile = lockfileWith({ 'node_modules/postcss': { dependencies: { nanoid: '^3.3.16' } } })
    expect(findAffectedNanoidEntries(lockfile)).toEqual([])
  })
})

describe('compareVersions / parseVersion', () => {
  it('parses and orders major.minor.patch triples', () => {
    expect(parseVersion('3.3.18')).toEqual([3, 3, 18])
    expect(compareVersions([3, 3, 17], [3, 3, 18])).toBe(-1)
    expect(compareVersions([5, 1, 6], [5, 1, 6])).toBe(0)
    expect(compareVersions([5, 2, 0], [5, 1, 6])).toBe(1)
  })
})
