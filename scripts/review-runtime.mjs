import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { acquirePublishLock, readJson, reviewRoot, writeJsonAtomic } from './review-paths.mjs'

export const runtimePath = resolve(reviewRoot, 'runtime-v1.json')
export const newRunId = () => `${new Date().toISOString().slice(0, 10)}-${randomUUID()}`
export function taskDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export async function updateRuntime(mutate, path = runtimePath) {
  const release = await acquirePublishLock()
  try {
    const state = await readJson(path, { version: 1, quotas: {}, runs: {}, discovery: {} })
    if (state.version !== 1) throw new Error('Unknown review runtime version; refusing to overwrite')
    const result = await mutate(state)
    await writeJsonAtomic(path, state)
    return result
  } finally { await release() }
}
export async function reserveQuota({ kind, units, limit, runId, channel = 'open', now = new Date(), path = runtimePath }) {
  if (!Number.isInteger(units) || units <= 0 || !Number.isInteger(limit) || limit < 0) throw new Error('Invalid quota reservation')
  return updateRuntime(state => {
    const day = taskDate(now)
    const daily = state.quotas[day] ??= {}
    const quota = daily[kind] ??= { attempts: 0, completed: 0, reservations: [] }
    if (kind === 'discovery') {
      if (!['open', 'radar'].includes(channel)) throw new Error('Invalid discovery channel')
      quota.channels ??= { open: 0, radar: 0 }
      if (channel === 'radar' && quota.channels.radar + units > Math.floor(limit / 2)) throw new Error('Reserve at least half of discovery capacity for open search')
    }
    if (quota.attempts + units > limit) throw new Error(`Daily ${kind} quota exhausted`)
    const id = randomUUID()
    quota.attempts += units
    if (kind === 'discovery') quota.channels[channel] += units
    quota.reservations.push({ id, runId, units, at: now.toISOString(), completed: false })
    return { id, day, kind }
  }, path)
}
export async function completeQuota(reservation, path = runtimePath) {
  return updateRuntime(state => {
    const quota = state.quotas[reservation.day]?.[reservation.kind]
    const entry = quota?.reservations.find(x => x.id === reservation.id)
    if (!entry) throw new Error('Unknown quota reservation')
    if (!entry.completed) { entry.completed = true; quota.completed += entry.units }
  }, path)
}
export async function fetchWithReviewRetry(url, options, { timeoutMs = 60000, deadline = Date.now() + 15 * 60000, fetchImpl = fetch, wait = sleep, reserve = async () => null, complete = async () => {}, now = Date.now, random = Math.random } = {}) {
  if (!Number.isFinite(deadline)) throw new Error('Invalid review deadline')
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - now()
    if (remaining <= 0) throw new Error('Review deadline exceeded')
    const reservation = await reserve()
    let response, retryAfter = 0
    try {
      response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)) })
      if (response.ok) {
        // Consume the body inside the retry/timeout boundary; invalid JSON remains a caller error.
        const body = await response.arrayBuffer()
        if (body.byteLength > 4 * 1024 * 1024) throw Object.assign(new Error('Model response exceeded 4 MiB'), { permanent: true })
        await complete(reservation)
        return new Response(body, { status: response.status, headers: response.headers })
      }
      if (response.status !== 429 && response.status < 500) throw Object.assign(new Error(`Model HTTP ${response.status}`), { permanent: true })
      const header = response.headers.get('retry-after')
      retryAfter = header ? (/^\d+(\.\d+)?$/.test(header) ? Number(header) * 1000 : Date.parse(header) - now()) : 0
      await response.body?.cancel()
    } catch (error) {
      if (error.permanent || error.message?.includes('quota')) throw error
    }
    if (attempt === 2) throw new Error('Model request failed after 3 attempts')
    const delay = Math.max(500 * 2 ** attempt + random() * 250, Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : 0)
    if (now() + delay >= deadline) throw new Error('Retry-After exceeds review deadline; resume later')
    await wait(delay)
  }
}

export function planDiscovery(previous, now = new Date()) {
  const end = now.getTime()
  const watermark = previous?.completedThrough ? Date.parse(previous.completedThrough) : end - 48 * 3600000
  if (!Number.isFinite(watermark) || watermark > end) throw new Error('Invalid discovery watermark')
  if (previous?.pending?.length) return { ...previous, backlogAlert: end - watermark > 7 * 86400000 }
  const start = previous?.completedThrough ? watermark - 6 * 3600000 : watermark
  const pending = []
  for (let from = start; from < end; from += 86400000) pending.push({ from: new Date(from).toISOString(), through: new Date(Math.min(from + 86400000, end)).toISOString(), cursor: null })
  return { completedThrough: previous?.completedThrough ?? null, earlierCoverage: previous?.earlierCoverage ?? 'unknown', pending, backlogAlert: end - watermark > 7 * 86400000 }
}
export function finishDiscoveryWindow(discovery, { from, through, complete, cursor = null, evidence }) {
  const next = structuredClone(discovery), first = next.pending[0]
  if (!first || first.from !== from || first.through !== through) throw new Error('Cannot skip an incomplete discovery window')
  if (!evidence || !/^[a-f0-9]{64}$/.test(evidence.artifactHash) || evidence.exitCode !== 0) throw new Error('Discovery requires verified evidence')
  if (complete) {
    next.completedThrough = !next.completedThrough || through > next.completedThrough ? through : next.completedThrough
    next.pending.shift()
  } else first.cursor = cursor
  return next
}
export function finishRun(run) {
  if (Object.values(run.stages).some(stage => stage.exitCode !== undefined && stage.exitCode !== 0)) return { ...run, status: 'blocked' }
  const discovery = run.stages.discovery, validation = run.stages.validation
  if (!discovery?.verified || !validation?.verified || discovery.exitCode !== 0 || validation.exitCode !== 0 || run.pendingWindows > 0) return { ...run, status: 'partial' }
  if (!run.publicChanges) return { ...run, status: 'no-change' }
  const commit = run.stages.commit, ci = run.stages.ci, deployment = run.stages.deployment, online = run.stages.online
  if (!commit?.sha || ![ci, deployment, online].every(stage => stage?.verified && stage.sha === commit.sha && stage.exitCode === 0)) return { ...run, status: 'partial' }
  return { ...run, status: 'complete' }
}
