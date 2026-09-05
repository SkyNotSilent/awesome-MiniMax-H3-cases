import { gzipSync } from 'node:zlib'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'public/data')
const detailRoot = resolve(outputRoot, 'cases')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const tutorials = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const tutorialResources = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const creators = JSON.parse(await readFile(resolve(root, 'data/creators.json'), 'utf8'))

const normalize = (values) => values
  .filter((value) => typeof value === 'string' && value.trim())
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase()

const catalogCases = cases.map((item) => ({
  id: item.id,
  title: item.title,
  titleEn: item.titleEn,
  mode: item.mode,
  posterUrl: item.posterUrl,
  duration: item.duration,
  category: item.category,
  styles: item.styles,
  scenes: item.scenes,
  tags: item.tags,
  author: item.author,
  addedAt: item.addedAt,
  mediaUrl: item.mediaUrl ?? null,
  sourceUrl: item.sourceUrl,
  sourceType: item.sourceType,
  verified: item.verified,
  hasPrompt: item.promptProvenance !== 'not-published' && Boolean(item.prompt?.trim()),
}))

const featuredBasisOrder = new Map([['official', 0], ['manual', 1], ['trending', 2]])
const featuredCaseIds = cases
  .filter((item) => item.featured)
  .sort((a, b) => {
    const basis = (featuredBasisOrder.get(a.featured.basis) ?? 99) - (featuredBasisOrder.get(b.featured.basis) ?? 99)
    if (basis !== 0) return basis
    return Date.parse(b.featured.at) - Date.parse(a.featured.at) || a.id.localeCompare(b.id)
  })
  .map((item) => item.id)

const detailFor = (item) => ({
  id: item.id,
  summary: item.summary,
  summaryEn: item.summaryEn,
  prompt: item.prompt,
  ...(item.promptSourceUrl ? { promptSourceUrl: item.promptSourceUrl } : {}),
  model: item.model,
  sourceLabel: item.sourceLabel,
  publishedAt: item.publishedAt,
  aspectRatio: item.aspectRatio,
  resolution: item.resolution,
  promptProvenance: item.promptProvenance,
})

const searchIndex = (language) => cases.map((item) => ({
  id: item.id,
  text: language === 'zh'
    ? normalize([item.title, item.summary, item.prompt, item.author, item.sourceLabel, ...item.tags, item.category, ...item.styles, ...item.scenes])
    : normalize([item.titleEn, item.summaryEn, item.prompt, item.author, item.category, ...item.styles, ...item.scenes]),
}))

await rm(outputRoot, { recursive: true, force: true })
await mkdir(detailRoot, { recursive: true })

const catalog = {
  version: 1,
  generatedAt: [...cases, ...tutorials].map((item) => item.addedAt).sort().at(-1),
  featuredCaseIds,
  cases: catalogCases,
  tutorials: tutorials.map(({ id, addedAt }) => ({ id, addedAt })),
}

const files = new Map([
  ['catalog.json', catalog],
  ['search-index.zh.json', searchIndex('zh')],
  ['search-index.en.json', searchIndex('en')],
  ['tutorial-guides.json', tutorials],
  ['tutorials.json', tutorialResources],
  ['creators.json', creators],
])

for (const [name, value] of files) {
  await writeFile(resolve(outputRoot, name), `${JSON.stringify(value)}\n`)
}

await Promise.all(cases.map((item) => writeFile(
  resolve(detailRoot, `${encodeURIComponent(item.id)}.json`),
  `${JSON.stringify(detailFor(item))}\n`,
)))

const budgets = [
  ['catalog.json', 150 * 1024],
  ['search-index.zh.json', 700 * 1024],
  ['search-index.en.json', 700 * 1024],
]

for (const [name, budget] of budgets) {
  const body = await readFile(resolve(outputRoot, name))
  const gzipBytes = gzipSync(body).byteLength
  if (gzipBytes > budget) {
    throw new Error(`${name} is ${gzipBytes} bytes gzip; budget is ${budget} bytes.`)
  }
  console.log(`${name}: ${gzipBytes} bytes gzip`)
}

const ids = new Set(catalogCases.map((item) => item.id))
if (ids.size !== cases.length) throw new Error('Catalog case IDs are not unique.')
if (catalogCases.length !== cases.length) throw new Error('Catalog is missing public cases.')
if (catalogCases.some((item) => !item.mediaUrl || !item.sourceUrl)) throw new Error('Catalog media/source URLs must be immediately available.')

console.log(`Generated ${catalogCases.length} catalog entries and case detail files.`)
