// Converts Markdown originals (GitHub READMEs, Hugging Face docs, Mintlify
// documentation) into the tutorial-original block format.
import { createHash } from 'node:crypto'
import { Lexer } from 'marked'
import { safeHref, textInlines } from './tutorial-original.mjs'
import { retry } from './tutorial-media.mjs'

const USER_AGENT = 'awesome-minimax-h3-cases/1.0 tutorial-original'
const BADGE_HOSTS = new Set(['img.shields.io', 'shields.io', 'badge.fury.io', 'badgen.net', 'codecov.io', 'api.netlify.com', 'deepwiki.com'])
const CALLOUTS = 'Note|Tip|Warning|Info|Check|Danger'
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function headingSlug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
}

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, name) => {
    if (name[0] === '#') {
      const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match
    }
    return ENTITIES[name.toLowerCase()] ?? match
  })
}

function attribute(attributes, name) {
  return attributes.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|\\{"([^"]*)"\\})`))?.slice(1).find((value) => value !== undefined) ?? null
}

function oneLine(text) {
  return text.replace(/<code>([\s\S]*?)<\/code>/g, (_match, code) => `\`${code.replace(/\\_/g, '_')}\``)
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const indentOf = (line) => line.length - line.trimStart().length

// Component nesting indents MDX content. Remove each paragraph's shared indent
// so Markdown does not read it as a code block, keeping nested list levels.
function dedent(markdown) {
  const output = []
  let paragraph = []
  let fence = null
  const flush = () => {
    if (!paragraph.length) return
    const indent = Math.min(...paragraph.map(indentOf))
    output.push(...paragraph.map((line) => line.slice(indent)))
    paragraph = []
  }
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^(\s*)(```+|~~~+)/)
    if (fence) {
      if (marker && marker[2].startsWith(fence.marker)) {
        output.push(line.trimStart())
        fence = null
      } else {
        output.push(line.slice(Math.min(fence.indent, indentOf(line))))
      }
    } else if (marker) {
      flush()
      fence = { indent: marker[1].length, marker: marker[2] }
      output.push(line.trimStart())
    } else if (!line.trim()) {
      flush()
      output.push('')
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return output.join('\n')
}

// Mintlify pages are MDX. Replace their layout components with Markdown equivalents.
export function normalizeMdx(mdx) {
  let text = mdx.replace(/^(?:>.*\n)+\n*/, (header) => (header.includes('Documentation Index') ? '' : header))
  text = text.replace(new RegExp(`<(${CALLOUTS})>([\\s\\S]*?)<\\/\\1>`, 'g'), (_match, _name, inner) => `\n${inner.trim().split('\n').map((line) => `> ${line.trim()}`).join('\n')}\n`)
  text = text.replace(/<Card\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Card>)/g, (_match, attributes, inner = '') => {
    const title = attribute(attributes, 'title') ?? ''
    const href = attribute(attributes, 'href')
    const label = href ? `[**${title}**](${href})` : `**${title}**`
    const detail = oneLine(inner)
    return `- ${label}${detail ? ` — ${detail}` : ''}`
  })
  text = text.replace(/<(Step|Accordion)\b([^>]*)>/g, (_match, name, attributes) => {
    const title = attribute(attributes, 'title')
    return title ? `\n${name === 'Step' ? '####' : '**'} ${title}${name === 'Step' ? '' : '**'}\n` : ''
  })
  text = text.replace(/<Tab\b([^>]*)>/g, (_match, attributes) => `\n**${attribute(attributes, 'title') ?? ''}**\n`)
  text = text.replace(/<img\b([^>]*?)\/?>/g, (_match, attributes) => {
    const src = attribute(attributes, 'src')
    return src ? `\n![${attribute(attributes, 'alt') ?? ''}](${src})\n` : ''
  })
  text = text.replace(/<video\b([^>]*?)(?:\/>|>[\s\S]*?<\/video>)/g, (_match, attributes) => {
    const src = attribute(attributes, 'src')
    return src ? `\n<video src="${src}"></video>\n` : ''
  })
  text = text.replace(/<[A-Z][A-Za-z]*\b[^>]*\/>/g, '')
  text = text.replace(/<\/?[A-Z][A-Za-z]*\b[^>]*>/g, '')
  return dedent(text).replace(/\n{3,}/g, '\n\n').trim()
}

function mediaId(url) {
  return `md-${createHash('sha1').update(url).digest('hex').slice(0, 12)}`
}

function isBadge(url) {
  try {
    const parsed = new URL(url)
    return BADGE_HOSTS.has(parsed.hostname) || /badge/i.test(parsed.pathname)
  } catch {
    return true
  }
}

function sameStyle(left, right) {
  return left.b === right.b && left.i === right.i && left.c === right.c && left.href === right.href
}

function pushRun(runs, run) {
  if (!run.t) return
  const previous = runs.at(-1)
  if (previous && sameStyle(previous, run)) previous.t += run.t
  else runs.push(run)
}

function imageBlock(src, alt, context) {
  const url = safeHref(context.resolveMedia(src))
  if (!url || isBadge(url)) return null
  const block = { type: 'image', remote: { url }, mediaId: mediaId(url) }
  if (alt) block.alt = alt
  return block
}

// Returns inline runs; images found inline are appended to `media` in order.
function inlineRuns(tokens, context, style = {}, media = [], runs = []) {
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'text':
        if (token.tokens?.length) inlineRuns(token.tokens, context, style, media, runs)
        else pushRun(runs, { ...style, t: decodeEntities(token.text) })
        break
      case 'escape':
        pushRun(runs, { ...style, t: token.text })
        break
      case 'strong':
        inlineRuns(token.tokens, context, { ...style, b: true }, media, runs)
        break
      case 'em':
        inlineRuns(token.tokens, context, { ...style, i: true }, media, runs)
        break
      case 'del':
        inlineRuns(token.tokens, context, style, media, runs)
        break
      case 'codespan':
        pushRun(runs, { ...style, c: true, t: decodeEntities(token.text) })
        break
      case 'br':
        pushRun(runs, { ...style, t: '\n' })
        break
      case 'image': {
        const block = imageBlock(token.href, token.text, context)
        if (block) media.push(block)
        break
      }
      case 'link': {
        const onlyImages = token.tokens?.length && token.tokens.every((child) => child.type === 'image')
        if (onlyImages) {
          inlineRuns(token.tokens, context, style, media, runs)
          break
        }
        const href = token.href.startsWith('#') ? null : safeHref(context.resolveLink(token.href))
        inlineRuns(token.tokens, context, href ? { ...style, href } : style, media, runs)
        break
      }
      case 'html':
        if (/^<br\s*\/?>$/i.test(token.text.trim())) pushRun(runs, { ...style, t: '\n' })
        else media.push(...htmlMedia(token.text, context))
        break
      default:
        if (token.raw) pushRun(runs, { ...style, t: decodeEntities(token.raw) })
    }
  }
  return runs
}

function trimRuns(runs) {
  const copy = runs.map((run) => ({ ...run }))
  while (copy.length && !copy[0].t.trim()) copy.shift()
  while (copy.length && !copy.at(-1).t.trim()) copy.pop()
  if (copy.length) {
    copy[0].t = copy[0].t.trimStart()
    copy.at(-1).t = copy.at(-1).t.trimEnd()
  }
  return copy
}

function listItems(list, context, depth, items, media) {
  for (const item of list.items) {
    const runs = []
    for (const child of item.tokens) {
      if (child.type === 'list') continue
      if (child.type === 'text' || child.type === 'paragraph') {
        if (runs.length) pushRun(runs, { t: ' ' })
        inlineRuns(child.tokens ?? [{ type: 'text', text: child.text }], context, {}, media, runs)
      }
    }
    const inlines = trimRuns(runs)
    if (inlines.length) items.push({ depth: Math.min(depth, 3), inlines })
    for (const child of item.tokens) if (child.type === 'list') listItems(child, context, depth + 1, items, media)
  }
  return items
}

function htmlMedia(html, context) {
  const blocks = []
  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const block = imageBlock(match[1], match[0].match(/\balt=["']([^"']*)["']/i)?.[1], context)
    if (block) blocks.push(block)
  }
  for (const match of html.matchAll(/<(?:video|source)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const url = safeHref(context.resolveMedia(match[1]))
    if (url) blocks.push({ type: 'video', remote: { url, variants: [] }, mediaId: mediaId(url) })
  }
  return blocks
}

function htmlBlocks(html, context) {
  const blocks = htmlMedia(html, context)
  const text = decodeEntities(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  if (text) blocks.push({ type: 'paragraph', inlines: textInlines(text) })
  return blocks
}

function tokenBlocks(tokens, context) {
  const blocks = []
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const inlines = trimRuns(inlineRuns(token.tokens, context))
        if (inlines.length) blocks.push({ type: 'heading', level: token.depth <= 2 ? 3 : 4, inlines })
        break
      }
      case 'paragraph': {
        const media = []
        const inlines = trimRuns(inlineRuns(token.tokens, context, {}, media))
        if (inlines.length) blocks.push({ type: 'paragraph', inlines })
        blocks.push(...media)
        break
      }
      case 'list': {
        const media = []
        const items = listItems(token, context, 0, [], media)
        if (items.length) blocks.push({ type: 'list', ordered: Boolean(token.ordered), items })
        blocks.push(...media)
        break
      }
      case 'blockquote': {
        const media = []
        const runs = []
        for (const child of token.tokens) {
          if (!child.tokens) continue
          if (runs.length) pushRun(runs, { t: '\n\n' })
          inlineRuns(child.tokens, context, {}, media, runs)
        }
        const inlines = trimRuns(runs)
        if (inlines.length) blocks.push({ type: 'quote', inlines })
        blocks.push(...media)
        break
      }
      case 'code': {
        const block = { type: 'code', text: token.text }
        if (token.lang && !['text', 'plaintext'].includes(token.lang)) block.language = token.lang.split(/\s/)[0]
        blocks.push(block)
        break
      }
      case 'table': {
        const cell = (value) => trimRuns(inlineRuns(value.tokens, context))
        blocks.push({ type: 'table', header: token.header.map(cell), rows: token.rows.map((row) => row.map(cell)) })
        break
      }
      case 'hr':
        blocks.push({ type: 'divider' })
        break
      case 'html':
        blocks.push(...htmlBlocks(token.text, context))
        break
      default:
        break
    }
  }
  return blocks
}

function sectionTokens(tokens, section) {
  const start = tokens.findIndex((token) => token.type === 'heading' && headingSlug(token.text) === section)
  if (start === -1) throw new Error(`Section not found: #${section}`)
  const depth = tokens[start].depth
  const end = tokens.findIndex((token, index) => index > start && token.type === 'heading' && token.depth <= depth)
  return tokens.slice(start, end === -1 ? undefined : end)
}

export function markdownToOriginalContent(markdown, { resolveLink, resolveMedia, section } = {}) {
  const context = { resolveLink: resolveLink ?? ((href) => href), resolveMedia: resolveMedia ?? ((src) => src) }
  const tokens = new Lexer({ gfm: true }).lex(markdown)
  const titleIndex = tokens.findIndex((token) => token.type === 'heading' && token.depth === 1)
  const title = titleIndex === -1 ? undefined : trimRuns(inlineRuns(tokens[titleIndex].tokens, context)).map((run) => run.t).join('')
  const body = tokens.filter((_token, index) => index !== titleIndex)
  const blocks = tokenBlocks(section ? sectionTokens(body, section) : body, context)
  return { title, blocks }
}

export function supportsMarkdownSource(guide) {
  const { platform, url } = guide.source
  if (platform === 'github') return /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url)
  if (platform === 'huggingface') return /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/blob\/[^/]+\/.+\.md$/.test(url)
  if (platform === 'docs') return url.startsWith('https://docs.comfy.org/')
  return false
}

async function fetchText(url, headers = {}) {
  return retry(`Fetch ${url}`, async () => {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  })
}

async function githubSource(url) {
  const [, owner, repo] = new URL(url).pathname.split('/')
  const api = `https://api.github.com/repos/${owner}/${repo}`
  const headers = { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }
  const meta = JSON.parse(await fetchText(api, headers))
  const readme = JSON.parse(await fetchText(`${api}/readme`, headers))
  const commit = JSON.parse(await fetchText(`${api}/commits/${meta.default_branch}`, headers))
  const directory = readme.path.includes('/') ? `${readme.path.slice(0, readme.path.lastIndexOf('/') + 1)}` : ''
  return {
    markdown: Buffer.from(readme.content, 'base64').toString('utf8'),
    resolveLink: (href) => new URL(href, `https://github.com/${owner}/${repo}/blob/${meta.default_branch}/${directory}`).href,
    resolveMedia: (src) => new URL(src, `https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}/${directory}`).href,
    revision: commit.sha,
    license: meta.license?.spdx_id && meta.license.spdx_id !== 'NOASSERTION' ? meta.license.spdx_id : undefined,
  }
}

async function huggingFaceSource(url) {
  const [, owner, repo, , revision, ...path] = new URL(url).pathname.split('/')
  const directory = path.slice(0, -1).join('/')
  return {
    markdown: await fetchText(`https://huggingface.co/${owner}/${repo}/raw/${revision}/${path.join('/')}`),
    resolveLink: (href) => new URL(href, `https://huggingface.co/${owner}/${repo}/blob/${revision}/${directory ? `${directory}/` : ''}`).href,
    resolveMedia: (src) => new URL(src, `https://huggingface.co/${owner}/${repo}/resolve/${revision}/${directory ? `${directory}/` : ''}`).href,
  }
}

async function docsSource(url) {
  const parsed = new URL(url)
  const page = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
  return {
    markdown: normalizeMdx(await fetchText(`${page}.md`)),
    resolveLink: (href) => new URL(href, `${page}`).href,
    resolveMedia: (src) => new URL(src, `${page}`).href,
    section: parsed.hash ? decodeURIComponent(parsed.hash.slice(1)) : undefined,
  }
}

export async function fetchMarkdownOriginal(guide, capturedAt) {
  const { platform, url } = guide.source
  const source = platform === 'github' ? await githubSource(url) : platform === 'huggingface' ? await huggingFaceSource(url) : await docsSource(url)
  const { title, blocks } = markdownToOriginalContent(source.markdown, source)
  if (!blocks.length) throw new Error('Markdown source has no content')
  const original = {
    tutorialId: guide.id,
    kind: 'markdown',
    language: guide.source.originalLanguage,
    capturedAt,
    source: { url, author: guide.source.author },
    sections: [{ url, blocks }],
  }
  if (title) original.title = title
  if (source.revision) original.source.revision = source.revision
  if (source.license) original.source.license = source.license
  return original
}
