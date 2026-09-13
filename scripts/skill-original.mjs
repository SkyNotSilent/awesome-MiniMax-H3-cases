// Turns SKILL.md files into titled sections of the tutorial-original block format.
import { markdownToOriginalContent } from './tutorial-original-markdown.mjs'
import { textInlines } from './tutorial-original.mjs'

function unquote(value) {
  const trimmed = value.trim()
  const quoted = trimmed.match(/^(["'])([\s\S]*)\1$/)
  return quoted ? quoted[2] : trimmed
}

// Reads only `name` and `description`; SKILL.md frontmatter is simple YAML.
export function parseSkillFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { name: '', description: '', body: text.trim() }
  const lines = match[1].split(/\r?\n/)
  const values = {}
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^([A-Za-z_-]+):\s*(.*)$/)
    if (!field) continue
    const [, key, rest] = field
    if (/^[>|][-+]?$/.test(rest.trim())) {
      const block = []
      while (index + 1 < lines.length && (/^\s+\S/.test(lines[index + 1]) || !lines[index + 1].trim())) block.push(lines[++index].trim())
      values[key] = rest.trim().startsWith('|') ? block.join('\n').trim() : block.filter(Boolean).join(' ')
    } else {
      values[key] = unquote(rest)
    }
  }
  return { name: values.name ?? '', description: values.description ?? '', body: text.slice(match[0].length).trim() }
}

export function skillAnchor(name) {
  return `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
}

export function detectLanguage(text) {
  if (/[぀-ヿ]/.test(text)) return 'ja'
  const cjk = (text.match(/[㐀-鿿]/g) ?? []).length
  const letters = (text.match(/[A-Za-z]/g) ?? []).length
  return cjk > letters / 4 ? 'zh' : 'en'
}

export function skillSection({ text, repository, branch, revision, path }) {
  const { name, description, body } = parseSkillFrontmatter(text)
  const directory = path.includes('/') ? `${path.slice(0, path.lastIndexOf('/') + 1)}` : ''
  const { title: heading, blocks: bodyBlocks } = markdownToOriginalContent(body, {
    resolveLink: (href) => new URL(href, `https://github.com/${repository}/blob/${branch}/${directory}`).href,
    resolveMedia: (src) => new URL(src, `https://raw.githubusercontent.com/${repository}/${revision}/${directory}`).href,
  })
  const title = name || path.split('/').at(-2) || path
  const lead = description ? [{ type: 'quote', inlines: textInlines(description) }] : []
  // Keep the document's own H1; the section title already carries the skill name.
  const blocks = heading ? [{ type: 'heading', level: 3, inlines: [{ t: heading }] }, ...bodyBlocks] : bodyBlocks
  return {
    url: `https://github.com/${repository}/blob/${branch}/${path}`,
    title,
    anchor: skillAnchor(title),
    blocks: [...lead, ...blocks],
  }
}
