import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir, hostname } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { acquirePublishLock, recoverPublishLock, mergeReviewedRows } from './review-paths.mjs'

describe('writer lock ownership', () => {
  it('never reclaims an active or unknown owner', async () => {
    const root = await mkdtemp(join(tmpdir(), 'h3-lock-'))
    try {
      const release = await acquirePublishLock(root)
      await expect(acquirePublishLock(root)).rejects.toThrow('busy')
      await expect(recoverPublishLock(root)).rejects.toThrow('active')
      await release()
      await mkdir(join(root, '.review/publish-staging'), { recursive: true })
      await writeFile(join(root, '.review/publish-staging/.commit.lock'), JSON.stringify({ pid: 2147483647, hostname: 'unknown-host' }))
      await expect(recoverPublishLock(root)).rejects.toThrow('ownership')
      await writeFile(join(root, '.review/publish-staging/.commit.lock'), JSON.stringify({ pid: 2147483647, hostname: hostname() }))
      await recoverPublishLock(root)
      const nextRelease = await acquirePublishLock(root)
      await nextRelease()
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})


it('merges reviewed rows against fresh state without losing unrelated additions or edits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'h3-merge-')), path = join(root, 'candidates.json')
  try {
    const a = { id: 'a', text: 'original' }, b = { id: 'b', text: 'new' }
    await writeFile(path, JSON.stringify([a, b]))
    await mergeReviewedRows(path, [a], [{ ...a, classification: 'verified' }], root)
    expect(JSON.parse(await readFile(path))).toEqual([{ ...a, classification: 'verified' }, b])
    await writeFile(path, JSON.stringify([{ ...a, text: 'edited during review' }, b]))
    await expect(mergeReviewedRows(path, [a], [{ ...a, classification: 'outdated' }], root)).rejects.toThrow('Input changed')
    expect(JSON.parse(await readFile(path))[0].text).toBe('edited during review')
  } finally { await rm(root, { recursive: true, force: true }) }
})
