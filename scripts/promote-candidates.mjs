import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { requireEditorialCopy } from './editorial-copy.mjs'

const root = resolve(import.meta.dirname, '..')
const candidatesPath = resolve(root, 'data/candidates.json')
const casesPath = resolve(root, 'data/cases.json')
const posterDirectory = resolve(root, 'public/posters/x')
const apply = process.argv.includes('--apply')

const candidates = JSON.parse(await readFile(candidatesPath, 'utf8'))
const cases = JSON.parse(await readFile(casesPath, 'utf8'))
const promotionEvidence = process.env.PROMOTION_EVIDENCE_FILE
  ? JSON.parse(await readFile(resolve(root, process.env.PROMOTION_EVIDENCE_FILE), 'utf8'))
  : []
const cachedTweets = new Map(promotionEvidence
  .filter((item) => item?.entry?.xStatusId && item?.source)
  .map((item) => [item.entry.xStatusId, item.source]))

const sourceOverrides = new Map([
  [
    '2086458939869381051',
    {
      id: 'x-2086031009402003468',
      sourceUrl: 'https://x.com/AiPhotorealGirl/status/2086031009402003468',
      author: 'AIconia | アイコニア',
      authorHandle: '@AiPhotorealGirl',
      attributionNote: 'Resolved from the quoted post and native-media publisher metadata.',
    },
  ],
])

const deferredReasons = new Map([
  [
    '2086455862932218000',
    'The post is a topic/reaction compilation and points to an original source only in a reply; keep it out of the public catalog until the original post is resolved.',
  ],
])

function sourcePostId(candidate) {
  return candidate.sourceUrl.match(/status\/(\d+)/)?.[1]
}

const pendingSource = candidates.filter((item) => item.reviewStatus === 'pending')
const pending = pendingSource
  .filter((item) => !deferredReasons.has(sourcePostId(item)))
  .map((item) => ({ ...item, ...(sourceOverrides.get(sourcePostId(item)) ?? {}) }))
const deferred = pendingSource.filter((item) => deferredReasons.has(sourcePostId(item)))

if (!pending.length) {
  console.log('No pending candidates to promote.')
  process.exit(0)
}

const existingIds = new Set(cases.map((item) => item.id))
const existingSources = new Set(cases.map((item) => item.sourceUrl.replace(/\?.*$/, '')))
const seenCandidateIds = new Set()
const seenCandidateSources = new Set()

for (const candidate of pending) {
  const normalizedSource = candidate.sourceUrl.replace(/\?.*$/, '')
  requireEditorialCopy(candidate)
  if (existingIds.has(candidate.id)) throw new Error(`Candidate id is already public: ${candidate.id}`)
  if (existingSources.has(normalizedSource)) throw new Error(`Candidate source is already public: ${normalizedSource}`)
  if (seenCandidateIds.has(candidate.id)) throw new Error(`Duplicate candidate id: ${candidate.id}`)
  if (seenCandidateSources.has(normalizedSource)) throw new Error(`Duplicate candidate source: ${normalizedSource}`)
  if (candidate.promptProvenance === 'not-published' && candidate.prompt !== null) {
    throw new Error(`Unpublished prompt must remain null: ${candidate.id}`)
  }
  if (candidate.promptProvenance !== 'not-published' && !candidate.prompt?.trim()) {
    throw new Error(`Published prompt is empty: ${candidate.id}`)
  }
  seenCandidateIds.add(candidate.id)
  seenCandidateSources.add(normalizedSource)
}

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

async function retry(label, work, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(attempt * 500)
    }
  }
  throw new Error(`${label}: ${lastError?.message ?? lastError}`)
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run))
  return results
}

function postIdFor(candidate) {
  const postId = candidate.sourceUrl.match(/status\/(\d+)/)?.[1]
  if (!postId) throw new Error(`Cannot read X post id: ${candidate.sourceUrl}`)
  return postId
}

async function fetchTweet(candidate) {
  const postId = postIdFor(candidate)
  const cachedTweet = cachedTweets.get(postId)
  if (cachedTweet) {
    const video = cachedTweet.media?.videos?.[0] ?? cachedTweet.media?.all?.find((item) => item.type === 'video')
    if (!video) throw new Error(`Cached X metadata for ${postId} has no native video`)
    if (!Number.isFinite(video.duration) || !video.width || !video.height || !video.thumbnail_url) {
      throw new Error(`Cached X metadata for ${postId} is incomplete`)
    }
    return { tweet: cachedTweet, video }
  }
  return retry(`Fetch X metadata for ${postId}`, async () => {
    const response = await fetch(`https://api.fxtwitter.com/status/${postId}`, {
      headers: { 'User-Agent': 'awesome-minimax-h3-cases/1.0 metadata-cache' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (payload.code !== 200 || !payload.tweet) throw new Error(payload.message || 'Missing tweet payload')
    const tweet = payload.tweet
    const video = tweet.media?.videos?.[0] ?? tweet.media?.all?.find((item) => item.type === 'video')
    if (!video) throw new Error('Original post has no native video metadata')
    if (!Number.isFinite(video.duration) || !video.width || !video.height || !video.thumbnail_url) {
      throw new Error('Native video metadata is incomplete')
    }
    return { tweet, video }
  })
}

function modeFor(candidate, caption) {
  const declared = candidate.classification?.mode ?? candidate.initialClassification?.mode
  if (declared && declared !== 'unknown') return declared
  if (/\b(?:Ref2VA|R2V)\b|reference\s*(?:to|2)\s*video/i.test(caption)) return 'Ref2VA'
  if (/\b(?:FL2VA|I2V)\b|image\s*(?:to|2)\s*video|first[- ]?frame|last[- ]?frame|首帧|尾帧|图生视频/i.test(caption)) return 'FL2VA'
  if (/\b(?:T2VA|T2V)\b|txt2vid|text\s*(?:to|2)\s*video|pure text-to-video|纯文本|文生视频/i.test(caption)) return 'T2VA'
  return 'Unknown'
}

function categoryFor(candidate, caption) {
  const initial = candidate.classification?.category ?? candidate.initialClassification?.category
  const explicit = {
    comparison: 'Model Comparison',
    music: 'Music Video',
    dance: 'Local Generation & Dance',
    dialogue: 'Character & Dialogue',
    action: 'Cinematic & VFX',
    advertising: 'UGC & Advertising',
    'local-generation': 'Local Generation',
    community: 'Community Showcase',
  }[initial]
  if (explicit) return explicit
  if (/\bvs\b|comparison|compare|比較|对比|對比/i.test(caption) || initial === 'comparison') return 'Model Comparison'
  if (/music|\bMV\b|song|音楽|歌|曲/i.test(caption) || initial === 'music') return 'Music Video'
  if (/dance|ダンス|舞蹈/i.test(caption) || initial === 'dance') return 'Local Generation & Dance'
  if (/lip.?sync|dialogue|speech|セリフ|台词|对白|口パク/i.test(caption) || initial === 'dialogue') return 'Character & Dialogue'
  if (/fight|combat|battle|戦闘|格闘|格斗|战斗|アクション/i.test(caption) || initial === 'action') return 'Cinematic & VFX'
  if (/advert|commercial|广告|廣告|宣传片|spot ad|\bPV\b/i.test(caption) || initial === 'advertising') return 'UGC & Advertising'
  if (/\blocal(?:ly)?\b|comfyui|\brtx\b|本地|ローカル/i.test(caption)) return 'Local Generation'
  return 'Community Showcase'
}

const categoryMetadata = {
  'Model Comparison': {
    style: 'Comparative', scene: 'Model Comparison', tag: '模型对比',
  },
  'Music Video': {
    style: 'Music Video', scene: 'Music Video', tag: '音乐视频',
  },
  'Local Generation & Dance': {
    style: 'Dance', scene: 'Character dance', tag: '舞蹈视频',
  },
  'Character & Dialogue': {
    style: 'Dialogue', scene: 'Dialogue', tag: '角色对白',
  },
  'Cinematic & VFX': {
    style: 'Action', scene: 'Action Test', tag: '动作特效',
  },
  'UGC & Advertising': {
    style: 'Advertising', scene: 'Product Advertising', tag: '广告视频',
  },
  'Local Generation': {
    style: 'Technical', scene: 'Local H3 generation test', tag: '本地生成',
  },
  'Community Showcase': {
    style: 'Unspecified', scene: 'MiniMax H3 test clip', tag: '社区案例',
  },
}

function inputTypesFor(mode) {
  if (mode === 'T2VA') return ['text']
  if (mode === 'FL2VA') return ['text', 'image']
  return ['unknown']
}

function aspectRatioFor(width, height) {
  if (Math.abs(width - height) / Math.max(width, height) < 0.05) return 'square'
  return width > height ? 'landscape' : 'portrait'
}

function engagementFor(candidate, tweet) {
  return {
    replies: Number(tweet.replies ?? candidate.engagement?.replies ?? 0),
    reposts: Number(tweet.retweets ?? candidate.engagement?.reposts ?? 0),
    likes: Number(tweet.likes ?? candidate.engagement?.likes ?? 0),
    views: Number(tweet.views ?? candidate.engagement?.views ?? 0),
    snapshotAt: new Date().toISOString(),
  }
}

function buildCase(candidate, tweet, video) {
  const postId = postIdFor(candidate)
  const handle = tweet.author?.screen_name || candidate.authorHandle?.replace(/^@/, '') || candidate.sourceUrl.match(/x\.com\/([^/]+)/)?.[1]
  const authorHandle = `@${handle}`
  const caption = tweet.text?.trim() || candidate.text.trim()
  const mode = modeFor(candidate, caption)
  const category = categoryFor(candidate, caption)
  const metadata = categoryMetadata[category]
  const duration = Math.max(1, Math.round(video.duration))
  const publishedAt = tweet.created_at ? new Date(tweet.created_at).toISOString() : candidate.publishedAt
  const promptPublished = candidate.promptProvenance !== 'not-published'
  const outputZh = `${duration} 秒 · ${video.width}×${video.height}`
  const outputEn = `${duration}s · ${video.width}×${video.height}`
  const editorial = requireEditorialCopy(candidate)
  const addedAt = new Date().toISOString()

  return {
    id: candidate.id,
    title: editorial.title,
    titleEn: editorial.titleEn,
    model: 'MiniMax H3（创作者标注）',
    mode,
    summary: `${editorial.summary} 原生视频规格为 ${outputZh}。${promptPublished ? '原帖完整公开了 Prompt，本页按原文保留。' : '原帖未公开完整 Prompt，本库不反推或补写。'}`,
    summaryEn: `${editorial.summaryEn} Native-video output: ${outputEn}. ${promptPublished ? 'The creator published the complete prompt, preserved here verbatim.' : 'The source did not publish a complete prompt, so this library does not infer or complete one.'}`,
    prompt: candidate.prompt,
    ...(candidate.promptSourceUrl ? { promptSourceUrl: candidate.promptSourceUrl.replace(/\?.*$/, '') } : {}),
    sourceUrl: candidate.sourceUrl.replace(/\?.*$/, ''),
    sourceLabel: `X 原帖 · ${authorHandle}`,
    author: tweet.author?.name || candidate.author,
    publishedAt,
    addedAt,
    mediaUrl: null,
    posterUrl: `/posters/x/${postId}.jpg`,
    duration,
    aspectRatio: aspectRatioFor(video.width, video.height),
    resolution: `${video.width}×${video.height}`,
    tags: ['MiniMax H3', metadata.tag, promptPublished ? '公开 Prompt' : '来源未公开 Prompt', 'X 原帖'],
    category,
    styles: [metadata.style],
    scenes: [metadata.scene],
    inputTypes: inputTypesFor(mode),
    promptProvenance: candidate.promptProvenance,
    sourceType: 'x',
    verified: false,
    sourceCaption: caption,
    engagement: engagementFor(candidate, tweet),
    approvedAt: addedAt,
    editorialBasis: editorial.basis,
    ...(candidate.attributionNote ? { attributionNote: candidate.attributionNote } : {}),
  }
}

async function downloadPoster(item) {
  const path = resolve(posterDirectory, `${item.postId}.jpg`)
  try {
    await access(path)
    return path
  } catch {
    // Download below.
  }

  await retry(`Download poster for ${item.postId}`, async () => {
    const response = await fetch(item.video.thumbnail_url, {
      headers: { 'User-Agent': 'awesome-minimax-h3-cases/1.0 poster-cache' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length < 1_000) throw new Error(`Poster is unexpectedly small: ${bytes.length} bytes`)
    await writeFile(path, bytes)
  })
  return path
}

const enriched = await mapConcurrent(pending, 6, async (candidate) => {
  const { tweet, video } = await fetchTweet(candidate)
  return { candidate, tweet, video, postId: postIdFor(candidate) }
})

const promoted = enriched.map(({ candidate, tweet, video }) => buildCase(candidate, tweet, video))

if (!apply) {
  const promptCount = promoted.filter((item) => item.prompt).length
  const categoryCounts = Object.groupBy(promoted, (item) => item.category)
  console.log(JSON.stringify({
    dryRun: true,
    existingCases: cases.length,
    candidates: pendingSource.length,
    promotedCandidates: pending.length,
    deferredCandidates: deferred.length,
    resultingCases: cases.length + promoted.length,
    publicPromptsAdded: promptCount,
    categories: Object.fromEntries(Object.entries(categoryCounts).map(([key, items]) => [key, items.length])),
  }, null, 2))
  console.log('Re-run with --apply to cache posters, append cases, and clear the pending queue.')
  process.exit(0)
}

await mkdir(posterDirectory, { recursive: true })
await mapConcurrent(enriched, 6, downloadPoster)
await writeFile(casesPath, `${JSON.stringify([...cases, ...promoted], null, 2)}\n`)
const deferredQueue = candidates
  .filter((item) => item.reviewStatus !== 'pending' || deferredReasons.has(sourcePostId(item)))
  .map((item) => {
    const deferredReason = deferredReasons.get(sourcePostId(item))
    return deferredReason
      ? { ...item, reviewStatus: 'needs-context', reviewNote: deferredReason }
      : item
  })
await writeFile(candidatesPath, `${JSON.stringify(deferredQueue, null, 2)}\n`)

console.log(`Promoted ${promoted.length} candidates. Public catalog now contains ${cases.length + promoted.length} cases; ${deferredQueue.length} candidate records remain deferred or rejected.`)
