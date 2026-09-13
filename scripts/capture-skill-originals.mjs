// Captures every curated H3 skill package into data/skill-originals/{id}.json
// and refreshes its public metadata in data/skills.json.
//
//   GITHUB_TOKEN=$(gh auth token) node scripts/capture-skill-originals.mjs [--only id,id]
//
// Packages list their SKILL.md paths. A package marked `catalog` is too large to
// reproduce file by file; its README and a complete skill index are captured instead.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { detectLanguage, parseSkillFrontmatter, skillSection } from './skill-original.mjs'
import { markdownToOriginalContent } from './tutorial-original-markdown.mjs'
import { collectOriginalMedia, rewriteOriginalMedia, textInlines, tutorialOriginalErrors } from './tutorial-original.mjs'
import { mirrorImage, retry } from './tutorial-media.mjs'

const root = resolve(import.meta.dirname, '..')
const skillsPath = resolve(root, 'data/skills.json')
const USER_AGENT = 'awesome-minimax-h3-cases/1.0 skill-original'
const onlyIndex = process.argv.indexOf('--only')
const onlyIds = new Set(onlyIndex === -1 ? [] : process.argv[onlyIndex + 1].split(',').map((value) => value.trim()).filter(Boolean))
const today = new Date().toISOString().slice(0, 10)

async function request(url, { json = true, api = false } = {}) {
  return retry(`Fetch ${url}`, async () => {
    const headers = { 'User-Agent': USER_AGENT }
    if (api) {
      headers.Accept = 'application/vnd.github+json'
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }
    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return json ? response.json() : response.text()
  })
}

const github = (path) => request(`https://api.github.com/${path}`, { api: true })
const raw = (repository, revision, path) => request(`https://raw.githubusercontent.com/${repository}/${revision}/${path.split('/').map(encodeURIComponent).join('/')}`, { json: false })

async function catalogSections(item, revision, branch) {
  const tree = await github(`repos/${item.repository}/git/trees/${revision}?recursive=1`)
  const paths = tree.tree.map((entry) => entry.path).filter((path) => path.endsWith('/SKILL.md') || path === 'SKILL.md').sort()
  const rows = []
  for (const path of paths) {
    const { name, description } = parseSkillFrontmatter(await raw(item.repository, revision, path))
    const label = name || path.split('/').at(-2)
    rows.push([[{ t: label, href: `https://github.com/${item.repository}/blob/${branch}/${path}` }], textInlines(description || '—')])
  }
  const readme = await github(`repos/${item.repository}/readme`)
  const directory = readme.path.includes('/') ? readme.path.slice(0, readme.path.lastIndexOf('/') + 1) : ''
  const { title, blocks } = markdownToOriginalContent(Buffer.from(readme.content, 'base64').toString('utf8'), {
    resolveLink: (href) => new URL(href, `https://github.com/${item.repository}/blob/${branch}/${directory}`).href,
    resolveMedia: (src) => new URL(src, `https://raw.githubusercontent.com/${item.repository}/${revision}/${directory}`).href,
  })
  return {
    skillCount: rows.length,
    sections: [
      { url: `https://github.com/${item.repository}/blob/${branch}/${readme.path}`, title: 'README', anchor: 'skill-readme', blocks: title ? [{ type: 'heading', level: 3, inlines: [{ t: title }] }, ...blocks] : blocks },
      { url: `https://github.com/${item.repository}/tree/${branch}`, title: `SKILL.md × ${rows.length}`, anchor: 'skill-index', blocks: [{ type: 'table', header: [[{ t: 'Skill' }], [{ t: 'Description' }]], rows }] },
    ],
  }
}

async function capture(item) {
  const meta = await github(`repos/${item.repository}`)
  const branch = meta.default_branch
  const revision = (await github(`repos/${item.repository}/commits/${branch}`)).sha
  let sections
  let skills = []
  let skillCount
  if (item.catalog) {
    ({ sections, skillCount } = await catalogSections(item, revision, branch))
  } else {
    sections = []
    for (const entry of item.skills) {
      const text = await raw(item.repository, revision, entry.path)
      const { name, description } = parseSkillFrontmatter(text)
      sections.push(skillSection({ text, repository: item.repository, branch, revision, path: entry.path }))
      skills.push({ name: name || entry.path.split('/').at(-2) || item.name, path: entry.path, description })
    }
    skillCount = skills.length
  }
  const capturedAt = new Date().toISOString()
  const draft = {
    skillId: item.id,
    kind: 'markdown',
    title: item.name,
    language: detectLanguage(sections.flatMap((section) => section.blocks.flatMap((block) => (block.inlines ?? []).map((run) => run.t))).join(' ')),
    capturedAt,
    source: { url: `https://github.com/${item.repository}`, author: meta.owner.login, revision },
    sections,
  }
  const license = meta.license?.spdx_id && meta.license.spdx_id !== 'NOASSERTION' ? meta.license.spdx_id : undefined
  if (license) draft.source.license = license
  const mirrored = new Map()
  for (const media of collectOriginalMedia(draft)) {
    if (media.kind !== 'image') continue
    try {
      mirrored.set(media.key, await mirrorImage({ root, tutorialId: item.id, key: media.key, url: media.url, directory: 'skill-media' }))
    } catch (error) {
      console.warn(`  image skipped for ${item.id}: ${error?.message || error}`)
    }
  }
  const original = rewriteOriginalMedia(draft, mirrored)
  const errors = tutorialOriginalErrors(original)
  if (errors.length) throw new Error(errors.slice(0, 5).join('; '))
  const path = resolve(root, `data/skill-originals/${item.id}.json`)
  let existing = null
  try { existing = JSON.parse(await readFile(path, 'utf8')) } catch { /* first capture */ }
  const same = existing && JSON.stringify({ ...existing, capturedAt: null }) === JSON.stringify({ ...original, capturedAt: null })
  if (!same) await writeFile(path, `${JSON.stringify(original, null, 2)}\n`)
  const next = {
    ...item,
    branch,
    author: meta.owner.login,
    skills,
    skillCount,
    stars: meta.stargazers_count,
    starsAt: today,
    updatedAt: meta.pushed_at.slice(0, 10),
    addedAt: item.addedAt ?? capturedAt,
    original: { kind: 'markdown', capturedAt: same ? existing.capturedAt : capturedAt },
  }
  if (license) next.license = license
  else delete next.license
  if (item.catalog) next.skills = []
  return { next, state: same ? 'unchanged' : existing ? 'updated' : 'captured' }
}

const packages = JSON.parse(await readFile(skillsPath, 'utf8'))
const results = []
const next = []
for (const item of packages) {
  if (onlyIds.size && !onlyIds.has(item.id)) { next.push(item); continue }
  try {
    const result = await capture(item)
    next.push(result.next)
    console.log(`${result.state.padEnd(9)} ${item.id} (${result.next.skillCount})`)
    results.push({ id: item.id, state: result.state })
  } catch (error) {
    next.push(item)
    results.push({ id: item.id, state: 'failed', error: error?.message || String(error) })
    console.error(`failed    ${item.id}: ${error?.message || error}`)
  }
}
await writeFile(skillsPath, `${JSON.stringify(next, null, 2)}\n`)
const failed = results.filter((result) => result.state === 'failed')
console.log(JSON.stringify({ total: results.length, failed: failed.length, failures: failed }, null, 2))
if (failed.length) process.exitCode = 1
