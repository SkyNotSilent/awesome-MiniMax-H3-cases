// Captured tutorial originals use a small block format that React renders as
// plain elements. No captured HTML ever reaches the page.

export const ORIGINAL_KINDS = new Set(['x-article', 'x-thread', 'markdown'])
export const ORIGINAL_LANGUAGES = new Set(['zh', 'en', 'ja', 'other'])
const BLOCK_TYPES = new Set(['heading', 'paragraph', 'list', 'quote', 'code', 'image', 'video', 'youtube', 'divider', 'table', 'post-quote'])
const LOCAL_IMAGE = /^\/(?:tutorial|skill)-media\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.webp$/
const LOCAL_VIDEO = /^\/media\/tutorial-[A-Za-z0-9._-]+\.mp4$/
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const URL_PATTERN = /https?:\/\/[^\s<>"'）)\]]+[^\s<>"'）)\].,;:!?，。；：！？]/g
const HANDLE_PATTERN = /(^|[^\w/@])@([A-Za-z0-9_]{1,15})\b/g

export function safeHref(value) {
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

function sameStyle(left, right) {
  return left.b === right.b && left.i === right.i && left.c === right.c && left.href === right.href
}

function pushRun(runs, run) {
  const previous = runs.at(-1)
  if (previous && sameStyle(previous, run)) previous.t += run.t
  else runs.push(run)
}

// Draft.js offsets are UTF-16 code units, which match JavaScript string indices.
export function draftInlines(block, entityAt) {
  const text = block.text ?? ''
  const styles = block.inlineStyleRanges ?? []
  const entities = block.entityRanges ?? []
  const cuts = new Set([0, text.length])
  for (const range of [...styles, ...entities]) {
    cuts.add(Math.max(0, range.offset))
    cuts.add(Math.min(text.length, range.offset + range.length))
  }
  const points = [...cuts].sort((left, right) => left - right)
  const runs = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const value = text.slice(start, end)
    if (!value) continue
    const covers = (range) => range.offset <= start && range.offset + range.length >= end
    const active = new Set(styles.filter(covers).map((range) => range.style))
    const entityRange = entities.find(covers)
    const entity = entityRange ? entityAt(entityRange.key) : null
    const run = { t: value }
    if (active.has('Bold') || active.has('BOLD')) run.b = true
    if (active.has('Italic') || active.has('ITALIC')) run.i = true
    if (active.has('Code') || active.has('CODE')) run.c = true
    const href = entity?.type === 'LINK' ? safeHref(entity.data?.url) : null
    if (href) run.href = href
    pushRun(runs, run)
  }
  return runs
}

export function textInlines(text) {
  const matches = []
  for (const match of text.matchAll(URL_PATTERN)) {
    const href = safeHref(match[0])
    if (href) matches.push({ start: match.index, end: match.index + match[0].length, t: match[0], href })
  }
  for (const match of text.matchAll(HANDLE_PATTERN)) {
    const start = match.index + match[1].length
    const end = start + match[2].length + 1
    if (matches.some((item) => start < item.end && end > item.start)) continue
    matches.push({ start, end, t: `@${match[2]}`, href: `https://x.com/${match[2]}` })
  }
  matches.sort((left, right) => left.start - right.start)
  const runs = []
  let cursor = 0
  for (const match of matches) {
    if (match.start > cursor) pushRun(runs, { t: text.slice(cursor, match.start) })
    runs.push({ t: match.t, href: match.href })
    cursor = match.end
  }
  if (cursor < text.length) pushRun(runs, { t: text.slice(cursor) })
  return runs
}

export function youtubeVideoId(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\.|^m\./, '')
    const id = host === 'youtu.be'
      ? url.pathname.slice(1)
      : host === 'youtube.com'
        ? url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]
        : null
    return YOUTUBE_ID.test(id ?? '') ? id : null
  } catch {
    return null
  }
}

function paragraphsFromText(text) {
  return text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
    .map((part) => ({ type: 'paragraph', inlines: textInlines(part) }))
}

function remoteImage(url, width, height, mediaId, alt) {
  const block = { type: 'image', remote: { url }, mediaId: String(mediaId), width, height }
  if (alt) block.alt = alt
  return block
}

function bestMp4(media) {
  const variants = (media.formats ?? media.variants ?? []).filter((item) => (item.container === 'mp4' || item.content_type === 'video/mp4') && item.url)
  const sorted = [...variants].sort((left, right) => Number(right.bitrate || 0) - Number(left.bitrate || 0))
  return { url: sorted[0]?.url ?? media.url, variants: sorted.map((item) => ({ url: item.url, bitrate: Number(item.bitrate || 0), content_type: 'video/mp4' })) }
}

function mediaBlocks(status) {
  const blocks = []
  for (const media of status.media?.all ?? []) {
    if (media.type === 'photo') blocks.push(remoteImage(media.url, media.width, media.height, media.id, media.altText))
    else if (media.type === 'video' || media.type === 'gif') {
      const { url, variants } = bestMp4(media)
      if (!url) continue
      const block = { type: 'video', remote: { url, variants, poster: media.thumbnail_url }, mediaId: String(media.id), width: media.width, height: media.height }
      if (media.duration) block.duration = Math.round(media.duration * 10) / 10
      blocks.push(block)
    }
  }
  return blocks
}

function quoteBlock(quote) {
  if (!quote?.url) return null
  const articleText = quote.article ? [quote.article.title, quote.article.preview_text].filter(Boolean).join('\n\n') : ''
  const block = {
    type: 'post-quote',
    url: quote.url,
    author: quote.author?.name || quote.author?.screen_name || '',
    handle: quote.author?.screen_name ? `@${quote.author.screen_name}` : undefined,
    inlines: textInlines((quote.text || articleText).trim()),
  }
  if (!block.handle) delete block.handle
  const first = quote.media?.all?.[0]
  const imageUrl = first?.type === 'photo' ? first.url : first?.thumbnail_url
  if (imageUrl && first?.id) block.image = { remote: { url: imageUrl }, mediaId: `${first.id}-quote`, width: first.width, height: first.height }
  return block
}

function codeFromMarkdown(markdown) {
  const match = markdown.match(/^```([\w+-]*)\n([\s\S]*?)\n?```\s*$/)
  if (!match) return { type: 'code', text: markdown.trim() }
  const block = { type: 'code', text: match[2] }
  if (match[1] && match[1] !== 'plaintext' && match[1] !== 'text') block.language = match[1]
  return block
}

export function draftArticleBlocks(article) {
  const entityList = article.content?.entityMap ?? []
  const entities = new Map((Array.isArray(entityList) ? entityList : Object.entries(entityList).map(([key, value]) => ({ key, value })))
    .map((entry) => [Number(entry.key), entry.value]))
  const entityAt = (key) => entities.get(Number(key))
  const mediaById = new Map((article.media_entities ?? []).map((item) => [String(item.media_id), item.media_info]))
  const blocks = []
  let list = null
  for (const block of article.content?.blocks ?? []) {
    const ordered = block.type === 'ordered-list-item'
    if (block.type === 'unordered-list-item' || ordered) {
      const depth = Math.min(Number(block.depth || 0), 3)
      if (!list || (depth === 0 && list.ordered !== ordered)) {
        list = { type: 'list', ordered, items: [] }
        blocks.push(list)
      }
      const item = { depth, inlines: draftInlines(block, entityAt) }
      if (depth > 0 && ordered) item.ordered = true
      list.items.push(item)
      continue
    }
    list = null
    if (block.type === 'atomic') {
      const entity = entityAt(block.entityRanges?.[0]?.key)
      if (entity?.type === 'MARKDOWN') blocks.push(codeFromMarkdown(entity.data?.markdown ?? ''))
      else if (entity?.type === 'DIVIDER') blocks.push({ type: 'divider' })
      else if (entity?.type === 'MEDIA') {
        for (const item of entity.data?.mediaItems ?? []) {
          const info = mediaById.get(String(item.mediaId))
          if (info?.original_img_url) blocks.push(remoteImage(info.original_img_url, info.original_img_width, info.original_img_height, item.mediaId))
        }
      }
      continue
    }
    const inlines = draftInlines(block, entityAt)
    if (!inlines.some((run) => run.t.trim())) continue
    if (/^header-(one|two|three)$/.test(block.type)) blocks.push({ type: 'heading', level: block.type === 'header-three' ? 4 : 3, inlines })
    else if (block.type === 'blockquote') blocks.push({ type: 'quote', inlines })
    else if (block.type === 'code-block') blocks.push({ type: 'code', text: block.text })
    else blocks.push({ type: 'paragraph', inlines })
  }
  return blocks
}

function statusBlocks(status) {
  const blocks = status.article ? draftArticleBlocks(status.article) : paragraphsFromText(status.text ?? '')
  const seenVideos = new Set()
  for (const block of paragraphsFromText(status.article ? '' : status.text ?? '')) {
    for (const run of block.inlines) {
      const id = run.href ? youtubeVideoId(run.href) : null
      if (id && !seenVideos.has(id)) {
        seenVideos.add(id)
        blocks.push({ type: 'youtube', videoId: id })
      }
    }
  }
  blocks.push(...mediaBlocks(status))
  const quote = quoteBlock(status.quote)
  if (quote) blocks.push(quote)
  return blocks
}

function isoDate(status) {
  return status.created_timestamp ? new Date(status.created_timestamp * 1000).toISOString().slice(0, 10) : undefined
}

export function xPayloadToOriginal(payload, { tutorialId, capturedAt, language }) {
  const statuses = payload.thread?.length ? payload.thread : [payload.status ?? payload.tweet].filter(Boolean)
  if (!statuses.length) throw new Error('X payload has no status')
  const lead = statuses[0]
  const handle = lead.author?.screen_name
  const own = statuses.filter((item) => item.author?.screen_name === handle)
  const article = lead.article
  const original = {
    tutorialId,
    kind: article ? 'x-article' : 'x-thread',
    language,
    capturedAt,
    source: { url: lead.url, author: lead.author?.name || handle, handle: handle ? `@${handle}` : undefined },
    sections: own.map((item) => ({ url: item.url, publishedAt: isoDate(item), blocks: statusBlocks(item) })),
  }
  if (!original.source.handle) delete original.source.handle
  if (article?.title) original.title = article.title
  const cover = article?.cover_media?.media_info
  if (cover?.original_img_url) original.cover = remoteImage(cover.original_img_url, cover.original_img_width, cover.original_img_height, `${article.cover_media.media_id}-cover`)
  return original
}

function childBlocks(block) {
  if (block.type === 'list') return block.items.flatMap((item) => item.blocks ?? [])
  if (block.type === 'quote') return block.blocks ?? []
  return []
}

function mediaTargets(original) {
  const targets = []
  if (original.cover?.remote) targets.push({ item: original.cover })
  const visit = (blocks) => {
    for (const block of blocks ?? []) {
      if ((block.type === 'image' || block.type === 'video') && block.remote) targets.push({ item: block })
      if (block.type === 'post-quote' && block.image?.remote) targets.push({ item: block.image })
      visit(childBlocks(block))
    }
  }
  for (const section of original.sections ?? []) visit(section.blocks)
  return targets
}

export function collectOriginalMedia(original) {
  const media = new Map()
  for (const { item } of mediaTargets(original)) {
    if (item.type === 'video') {
      media.set(item.mediaId, { kind: 'video', key: item.mediaId, url: item.remote.url, variants: item.remote.variants ?? [] })
      if (item.remote.poster) media.set(`${item.mediaId}-poster`, { kind: 'image', key: `${item.mediaId}-poster`, url: item.remote.poster })
    } else {
      media.set(item.mediaId, { kind: 'image', key: item.mediaId, url: item.remote.url })
    }
  }
  return [...media.values()]
}

function mirroredImage(item, mirrored) {
  const image = mirrored.get(item.mediaId)
  if (!image) return null
  const result = { src: image.src, width: image.width ?? item.width, height: image.height ?? item.height }
  if (item.alt) result.alt = item.alt
  return result
}

export function rewriteOriginalMedia(original, mirrored) {
  const copy = structuredClone(original)
  if (copy.cover?.remote) {
    const cover = mirroredImage(copy.cover, mirrored)
    if (cover) copy.cover = cover
    else delete copy.cover
  }
  const rewrite = (blocks) => blocks.flatMap((block) => {
      if (block.type === 'list' && block.items.some((item) => item.blocks)) {
        return [{ ...block, items: block.items.map((item) => {
          if (!item.blocks) return item
          const nested = rewrite(item.blocks)
          const rest = { ...item }
          delete rest.blocks
          return nested.length ? { ...rest, blocks: nested } : rest
        }) }]
      }
      if (block.type === 'quote' && block.blocks) {
        const nested = rewrite(block.blocks)
        return nested.length ? [{ ...block, blocks: nested }] : []
      }
      if (block.type === 'image' && block.remote) {
        const image = mirroredImage(block, mirrored)
        return image ? [{ type: 'image', ...image }] : []
      }
      if (block.type === 'video' && block.remote) {
        const video = mirrored.get(block.mediaId)
        const poster = mirrored.get(`${block.mediaId}-poster`)
        if (!video) return []
        const result = { type: 'video', src: video.src }
        if (poster) result.poster = poster.src
        result.width = block.width
        result.height = block.height
        if (block.duration) result.duration = block.duration
        return [result]
      }
      if (block.type === 'post-quote' && block.image?.remote) {
        const image = mirroredImage(block.image, mirrored)
        const result = { ...block }
        if (image) result.image = image
        else delete result.image
        return [result]
      }
      return [block]
    })
  for (const section of copy.sections) section.blocks = rewrite(section.blocks)
  return copy
}

function inlineErrors(inlines, path, errors) {
  if (!Array.isArray(inlines)) { errors.push(`${path}: inline list required`); return }
  inlines.forEach((run, index) => {
    const at = `${path}[${index}]`
    if (typeof run?.t !== 'string' || !run.t) errors.push(`${at}.t: text required`)
    for (const key of Object.keys(run ?? {})) if (!['t', 'b', 'i', 'c', 'href'].includes(key)) errors.push(`${at}.${key}: not public`)
    if (run?.href !== undefined && !safeHref(run.href)) errors.push(`${at}.href: HTTP(S) URL required`)
  })
}

function imageErrors(image, path, errors) {
  if (!LOCAL_IMAGE.test(image?.src ?? '')) errors.push(`${path}.src: mirrored media required`)
  if (!Number.isSafeInteger(image?.width) || !Number.isSafeInteger(image?.height) || image.width < 1 || image.height < 1) errors.push(`${path}: image dimensions required`)
  if (image?.remote) errors.push(`${path}.remote: not public`)
}

function nestedErrors(blocks, path, errors) {
  if (!Array.isArray(blocks) || !blocks.length) { errors.push(`${path}: nested blocks required`); return }
  blocks.forEach((child, index) => blockErrors(child, `${path}[${index}]`, errors))
}

function blockErrors(block, path, errors) {
  if (!BLOCK_TYPES.has(block?.type)) { errors.push(`${path}.type: unsupported block`); return }
  if (block.remote || block.mediaId) errors.push(`${path}: capture fields must be removed`)
  switch (block.type) {
    case 'heading':
      if (![2, 3, 4].includes(block.level)) errors.push(`${path}.level: invalid heading level`)
      inlineErrors(block.inlines, `${path}.inlines`, errors)
      break
    case 'paragraph':
      inlineErrors(block.inlines, `${path}.inlines`, errors)
      break
    case 'quote':
      inlineErrors(block.inlines, `${path}.inlines`, errors)
      if (block.blocks !== undefined) nestedErrors(block.blocks, `${path}.blocks`, errors)
      if (!block.inlines?.length && !block.blocks?.length) errors.push(`${path}: quote content required`)
      break
    case 'list':
      if (block.start !== undefined && (!Number.isSafeInteger(block.start) || block.start < 0)) errors.push(`${path}.start: integer required`)
      if (!Array.isArray(block.items) || !block.items.length) errors.push(`${path}.items: list items required`)
      else block.items.forEach((item, index) => {
        inlineErrors(item.inlines, `${path}.items[${index}].inlines`, errors)
        if (item.blocks !== undefined) nestedErrors(item.blocks, `${path}.items[${index}].blocks`, errors)
        if (!item.inlines?.length && !item.blocks?.length) errors.push(`${path}.items[${index}]: item content required`)
      })
      break
    case 'code':
      if (typeof block.text !== 'string') errors.push(`${path}.text: code text required`)
      break
    case 'image':
      imageErrors(block, path, errors)
      break
    case 'video':
      if (!LOCAL_VIDEO.test(block.src ?? '')) errors.push(`${path}.src: mirrored media required`)
      if (block.poster !== undefined && !LOCAL_IMAGE.test(block.poster)) errors.push(`${path}.poster: mirrored media required`)
      break
    case 'youtube':
      if (!YOUTUBE_ID.test(block.videoId ?? '')) errors.push(`${path}.videoId: invalid YouTube id`)
      break
    case 'table':
      if (!Array.isArray(block.header)) errors.push(`${path}.header: table header required`)
      if (!Array.isArray(block.rows) || !Array.isArray(block.header)) errors.push(`${path}.rows: table rows required`)
      else [block.header, ...block.rows].forEach((row, rowIndex) => row.forEach((cell, cellIndex) => inlineErrors(cell, `${path}.rows[${rowIndex}][${cellIndex}]`, errors)))
      break
    case 'post-quote':
      if (!safeHref(block.url)) errors.push(`${path}.url: HTTP(S) URL required`)
      inlineErrors(block.inlines, `${path}.inlines`, errors)
      if (block.image) imageErrors(block.image, `${path}.image`, errors)
      break
    default:
      break
  }
}

export function tutorialOriginalErrors(original) {
  const errors = []
  const owner = original?.tutorialId ?? original?.skillId
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(owner ?? '') || (original.tutorialId && original.skillId)) errors.push('original.tutorialId: slug required')
  if (!ORIGINAL_KINDS.has(original?.kind)) errors.push('original.kind: unsupported kind')
  if (!ORIGINAL_LANGUAGES.has(original?.language)) errors.push('original.language: unsupported language')
  if (Number.isNaN(Date.parse(original?.capturedAt ?? ''))) errors.push('original.capturedAt: ISO date-time required')
  if (!safeHref(original?.source?.url)) errors.push('original.source.url: HTTP(S) URL required')
  if (!original?.source?.author) errors.push('original.source.author: required')
  if (original?.cover) imageErrors(original.cover, 'original.cover', errors)
  if (!Array.isArray(original?.sections) || !original.sections.length) errors.push('original.sections: at least one section required')
  else original.sections.forEach((section, sectionIndex) => {
    const path = `original.sections[${sectionIndex}]`
    if (section.url !== undefined && !safeHref(section.url)) errors.push(`${path}.url: HTTP(S) URL required`)
    if (section.title !== undefined && (typeof section.title !== 'string' || !section.title.trim())) errors.push(`${path}.title: text required`)
    if (section.anchor !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.anchor)) errors.push(`${path}.anchor: slug required`)
    if (!Array.isArray(section.blocks) || !section.blocks.length) errors.push(`${path}.blocks: content required`)
    else section.blocks.forEach((block, blockIndex) => blockErrors(block, `${path}.blocks[${blockIndex}]`, errors))
  })
  return errors
}

// Content identity for recapture: the capture time and upstream commit are not content.
export function originalSignature(original) {
  const source = { ...original.source }
  delete source.revision
  return JSON.stringify({ ...original, capturedAt: null, source })
}

function blockCount(original) {
  return original.sections.reduce((sum, section) => sum + section.blocks.length, 0)
}

// A degraded upstream response must not silently replace a good capture.
export function captureRegression(existing, next) {
  if (!existing) return null
  if (existing.kind !== next.kind) return `kind changed from ${existing.kind} to ${next.kind}`
  if (next.sections.length < existing.sections.length) return `sections dropped from ${existing.sections.length} to ${next.sections.length}`
  if (blockCount(next) < blockCount(existing) * 0.8) return `blocks dropped from ${blockCount(existing)} to ${blockCount(next)}`
  return null
}

// Every local image path a capture references (covers, figures, video posters, quote images).
export function referencedImages(original) {
  const paths = new Set()
  if (original.cover?.src) paths.add(original.cover.src)
  const visit = (blocks) => {
    for (const block of blocks ?? []) {
      if (block.type === 'image' && block.src) paths.add(block.src)
      if (block.type === 'video' && block.poster) paths.add(block.poster)
      if (block.type === 'post-quote' && block.image?.src) paths.add(block.image.src)
      visit(childBlocks(block))
    }
  }
  for (const section of original.sections ?? []) visit(section.blocks)
  return paths
}

