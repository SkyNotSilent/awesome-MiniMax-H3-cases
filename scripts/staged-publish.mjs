const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

async function drainBody(response) {
  try {
    await response.arrayBuffer()
  } catch {
    // A redirect may not expose a readable body.
  }
}

export async function verifyVideoRoute({ siteBaseUrl, caseId, fetchImpl = fetch, attempts = 3, timeoutMs = 15_000 }) {
  const routeUrl = `${siteBaseUrl.replace(/\/$/, '')}/media/${encodeURIComponent(caseId)}.mp4`
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const redirect = await fetchImpl(routeUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: { Range: 'bytes=0-1' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      await drainBody(redirect)
      if (redirect.status !== 307) throw new Error(`App media route returned ${redirect.status}; expected 307`)
      const location = redirect.headers.get('location')
      if (!location) throw new Error('App media redirect is missing Location')
      const signedUrl = new URL(location, routeUrl)
      if (signedUrl.protocol !== 'https:') throw new Error('App media redirect must use HTTPS')

      const ranged = await fetchImpl(signedUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: { Range: 'bytes=0-1' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      const contentRange = ranged.headers.get('content-range')
      await drainBody(ranged)
      if (ranged.status !== 206) throw new Error(`Bucket range request returned ${ranged.status}; expected 206`)
      if (!/^bytes 0-1\/\d+$/i.test(contentRange || '')) throw new Error('Bucket response is missing a valid Content-Range')
      return { appStatus: 307, bucketStatus: 206, contentRange }
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(attempt * 400)
    }
  }

  throw new Error(lastError?.message || 'Video verification failed')
}

function normalizedSource(value) {
  return value?.replace(/\?.*$/, '')
}

export async function prepareStagedCommit({ stagedCases, publicCases, verifyVideo, posterExists }) {
  const publicById = new Map(publicCases.map((item) => [item.id, item]))
  const publicBySource = new Map(publicCases.map((item) => [normalizedSource(item.sourceUrl), item]))
  const batchIds = new Set()
  const batchSources = new Set()
  const ready = []
  const alreadyCommitted = []
  const failed = []

  for (const item of stagedCases) {
    if (!/^[a-zA-Z0-9_-]+$/.test(item.id || '')) {
      failed.push({ item, reason: 'case id is missing or invalid' })
      continue
    }
    try {
      const sourceUrl = new URL(item.sourceUrl)
      if (sourceUrl.protocol !== 'https:') throw new Error('not HTTPS')
    } catch {
      failed.push({ item, reason: 'source URL is missing or invalid' })
      continue
    }
    const source = normalizedSource(item.sourceUrl)
    const existingById = publicById.get(item.id)
    const existingBySource = publicBySource.get(source)

    if (existingById && normalizedSource(existingById.sourceUrl) === source) {
      alreadyCommitted.push(item)
      continue
    }
    if (existingById) {
      failed.push({ item, reason: 'case id conflicts with an existing public case' })
      continue
    }
    if (existingBySource) {
      failed.push({ item, reason: 'source URL already belongs to another public case' })
      continue
    }
    if (batchIds.has(item.id) || batchSources.has(source)) {
      failed.push({ item, reason: 'duplicate case or source inside the staging batch' })
      continue
    }
    batchIds.add(item.id)
    batchSources.add(source)

    if (item.mediaUrl !== `/media/${item.id}.mp4`) {
      failed.push({ item, reason: 'hosted media path is missing or invalid' })
      continue
    }
    if (!await posterExists(item)) {
      failed.push({ item, reason: 'staged poster is missing' })
      continue
    }
    try {
      await verifyVideo(item)
      ready.push(item)
    } catch (error) {
      failed.push({ item, reason: error?.message || 'video playback verification failed' })
    }
  }

  return { ready, alreadyCommitted, failed }
}

export function updatePrivateCandidates({ candidates, ready, alreadyCommitted, failed }) {
  const successfulIds = new Set([...ready, ...alreadyCommitted].map((item) => item.id))
  const successfulSources = new Set([...ready, ...alreadyCommitted].map((item) => normalizedSource(item.sourceUrl)))
  const failureById = new Map(failed.map(({ item, reason }) => [item.id, reason]))

  return candidates
    .filter((item) => !successfulIds.has(item.id) && !successfulSources.has(normalizedSource(item.sourceUrl)))
    .map((item) => failureById.has(item.id)
      ? { ...item, reviewStatus: 'media-failed', reviewNote: `Publication staging blocked: ${failureById.get(item.id)}` }
      : item)
}
