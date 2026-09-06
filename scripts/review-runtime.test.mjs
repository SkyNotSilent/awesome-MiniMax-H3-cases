import { describe, expect, it, vi } from 'vitest'
import { fetchWithReviewRetry, finishDiscoveryWindow, finishRun, planDiscovery, taskDate } from './review-runtime.mjs'
const evidence = { artifactHash: 'a'.repeat(64), exitCode: 0 }

describe('daily collection recovery', () => {
  it.each([1, 3, 7])('keeps every window after missing %i days and never skips a failed head', days => {
    const now = new Date('2026-09-08T00:00:00Z')
    const completedThrough = new Date(+now - days * 86400000).toISOString()
    const plan = planDiscovery({ completedThrough }, now)
    expect(plan.pending[0].from).toBe(new Date(Date.parse(completedThrough) - 6 * 3600000).toISOString())
    for (let i = 1; i < plan.pending.length; i++) expect(plan.pending[i].from).toBe(plan.pending[i - 1].through)
    const interrupted = finishDiscoveryWindow(plan, { ...plan.pending[0], complete: false, cursor: 'next-page', evidence })
    expect(interrupted.completedThrough).toBe(completedThrough)
    expect(interrupted.pending[0].cursor).toBe('next-page')
    expect(() => finishDiscoveryWindow(plan, { ...plan.pending[1], complete: true, evidence })).toThrow('skip')
    expect(planDiscovery(interrupted, new Date(+now + 86400000)).pending).toEqual(interrupted.pending)
  })
  it('bootstraps 48 hours with unknown earlier coverage', () => {
    const plan = planDiscovery(null, new Date('2026-09-08T00:00:00Z'))
    expect(plan.pending[0].from).toBe('2026-09-06T00:00:00.000Z')
    expect(plan.earlierCoverage).toBe('unknown')
    expect(taskDate(new Date('2026-09-07T17:00:00Z'))).toBe('2026-09-08')
  })
  it('does not treat a successful validation or failed CI as a complete published run', () => {
    const run = { stages: { discovery: { verified: true, exitCode: 0 }, validation: { verified: true, exitCode: 0 } }, pendingWindows: 0, publicChanges: false }
    expect(finishRun(run).status).toBe('no-change')
    expect(finishRun({ ...run, publicChanges: true, stages: { ...run.stages, commit: { sha: 'abc' }, ci: { verified: true, exitCode: 1, sha: 'abc' } } }).status).toBe('blocked')
    expect(finishRun({ ...run, pendingWindows: 1 }).status).toBe('partial')
  })
  it('retries 429 with Retry-After, counts attempts, and fails immediately on authentication errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '2' } })).mockResolvedValueOnce(new Response('{}'))
    const wait = vi.fn(), reserve = vi.fn(), complete = vi.fn()
    await fetchWithReviewRetry('https://example.invalid', {}, { fetchImpl, wait, reserve, complete, random: () => 0 })
    expect(wait).toHaveBeenCalledWith(2000)
    expect(reserve).toHaveBeenCalledTimes(2)
    expect(complete).toHaveBeenCalledTimes(1)
    fetchImpl.mockReset().mockResolvedValue(new Response(null, { status: 401 }))
    await expect(fetchWithReviewRetry('https://example.invalid', {}, { fetchImpl, wait })).rejects.toThrow('401')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('bounds network failures and refuses waits past the deadline', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('network')), wait = vi.fn()
    await expect(fetchWithReviewRetry('https://example.invalid', {}, { fetchImpl, wait })).rejects.toThrow('3 attempts')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    await expect(fetchWithReviewRetry('https://example.invalid', {}, { deadline: 0, fetchImpl })).rejects.toThrow('deadline')
  })
})


it('retries a transient response-body interruption within the request boundary', async () => {
  const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.reject(new TypeError('stream interrupted')) }).mockResolvedValueOnce(new Response('{}'))
  const response = await fetchWithReviewRetry('https://example.invalid', {}, { fetchImpl, wait: vi.fn() })
  expect(await response.json()).toEqual({})
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})
