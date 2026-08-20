import { createHash } from 'node:crypto'

const terminalStatuses = new Set(['blocked', 'rejected'])

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

export function normalizePrompt(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : ''
}

export function normalizeXUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) return null
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/)
    if (!match) return null
    return `https://x.com/${match[1]}/status/${match[2]}`
  } catch {
    return null
  }
}

export function xStatusId(value) {
  return normalizeXUrl(value)?.match(/\/status\/(\d+)$/)?.[1] ?? null
}

function promptHash(value) {
  const normalized = normalizePrompt(value)
  return normalized ? sha256(normalized) : null
}

function publicIndex(items) {
  return new Map(items.flatMap((item) => {
    const id = xStatusId(item.sourceUrl)
    return id ? [[id, item]] : []
  }))
}

function previousIndex(ledger) {
  return new Map((ledger?.entries ?? []).map((item) => [item.slug, item]))
}

function upstreamEntry(item, checkedAt) {
  const sourceUrl = normalizeXUrl(item?.source?.url)
  const statusId = xStatusId(sourceUrl)
  const slug = typeof item?.slug === 'string' && item.slug.trim() ? item.slug.trim() : statusId
  const promptSourceUrls = [...new Set((item?.promptSourceUrls ?? []).map(normalizeXUrl).filter(Boolean))]
  const upstreamPromptHash = promptHash(item?.prompt)
  const sourceFingerprint = sha256(JSON.stringify({ sourceUrl, promptSourceUrls, upstreamPromptHash }))

  return {
    slug,
    xStatusId: statusId,
    sourceUrl,
    promptSourceUrls,
    promptHash: upstreamPromptHash,
    sourceFingerprint,
    lastSeenAt: checkedAt,
  }
}

function classifyEntry(entry, previous, publicCase, candidate) {
  if (!entry.slug || !entry.sourceUrl || !entry.xStatusId) {
    return { status: 'rejected', action: null, caseId: null, lastError: 'Catalog entry has no valid original X status URL.' }
  }

  if (publicCase) {
    const localHash = promptHash(publicCase.prompt)
    if (localHash && previous?.verifiedPromptHash === localHash) {
      return { status: 'published', action: null, caseId: publicCase.id, lastError: null }
    }
    if (!entry.promptHash || localHash === entry.promptHash) {
      return { status: 'published', action: null, caseId: publicCase.id, lastError: null }
    }
    if (!localHash) {
      return { status: 'pending', action: 'enrich-prompt', caseId: publicCase.id, lastError: null }
    }
    return {
      status: 'conflict',
      action: 'compare-prompt-at-original-source',
      caseId: publicCase.id,
      lastError: 'The external Prompt fingerprint differs from the published case; do not overwrite without original-source verification.',
    }
  }

  if (candidate) {
    return { status: 'pending', action: 'verify-candidate', caseId: candidate.id ?? null, lastError: null }
  }

  if (previous && previous.sourceFingerprint === entry.sourceFingerprint && terminalStatuses.has(previous.status)) {
    return {
      status: previous.status,
      action: previous.action ?? null,
      caseId: previous.caseId ?? null,
      lastError: previous.lastError ?? null,
    }
  }

  return { status: 'pending', action: 'import-case', caseId: null, lastError: null }
}

export function buildExternalLedger({
  sourceId,
  catalog,
  catalogCommit,
  catalogHash,
  localDataHash,
  checkedAt,
  previousLedger = null,
  publicCases = [],
  candidates = [],
  batchLimit = 25,
}) {
  if (!catalog || !Array.isArray(catalog.prompts)) throw new Error('External catalog must contain a prompts array.')
  if (!sourceId) throw new Error('sourceId is required.')

  const published = publicIndex(publicCases)
  const queued = publicIndex(candidates)
  const previous = previousIndex(previousLedger)
  const seenStatusIds = new Map()
  const entries = []

  for (const item of catalog.prompts) {
    const entry = upstreamEntry(item, checkedAt)
    const duplicateOf = entry.xStatusId ? seenStatusIds.get(entry.xStatusId) : null
    if (duplicateOf) {
      entries.push({
        ...entry,
        status: 'duplicate',
        action: null,
        caseId: null,
        duplicateOf,
        lastError: 'Another catalog entry points to the same original X status.',
      })
      continue
    }
    if (entry.xStatusId) seenStatusIds.set(entry.xStatusId, entry.slug)

    const previousEntry = previous.get(entry.slug)
    const outcome = classifyEntry(
      entry,
      previousEntry,
      published.get(entry.xStatusId),
      queued.get(entry.xStatusId),
    )
    entries.push({
      ...entry,
      ...outcome,
      ...(previousEntry?.verifiedPromptHash ? {
        verifiedPromptHash: previousEntry.verifiedPromptHash,
        verifiedAt: previousEntry.verifiedAt,
        verificationSourceUrl: previousEntry.verificationSourceUrl,
      } : {}),
    })
  }

  const currentSlugs = new Set(entries.map((item) => item.slug))
  for (const oldEntry of previousLedger?.entries ?? []) {
    if (currentSlugs.has(oldEntry.slug)) continue
    entries.push({
      ...oldEntry,
      removedUpstreamAt: oldEntry.removedUpstreamAt ?? checkedAt,
      lastError: oldEntry.lastError ?? 'No longer present upstream; retained locally and never deleted automatically.',
    })
  }

  const counts = entries.reduce((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1
    return result
  }, {})

  return {
    version: 1,
    sourceId,
    catalogCommit,
    catalogHash,
    localDataHash,
    catalogUpdatedAt: catalog.updatedAt ?? null,
    checkedAt,
    batchLimit,
    counts,
    entries,
  }
}
