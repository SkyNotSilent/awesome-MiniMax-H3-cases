import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

describe('public collection dry run', () => {
  it('deduplicates the owned sample without network, writes, or publication', () => {
    const catalogPath = resolve(root, 'data/cases.json')
    const before = statSync(catalogPath).mtimeMs
    const output = execFileSync(process.execPath, ['scripts/public-collection-demo.mjs'], { cwd: root, encoding: 'utf8' })
    const report = JSON.parse(output)
    expect(report).toMatchObject({ dryRun: true, networkRequests: 0, filesWritten: 0, inputCount: 3, stagedCount: 2, duplicateCount: 1, rejectedCount: 0 })
    expect(report.staged.every((item) => item.nextRequiredGate === 'browser-source-and-media-verification')).toBe(true)
    expect(statSync(catalogPath).mtimeMs).toBe(before)
  })
})
