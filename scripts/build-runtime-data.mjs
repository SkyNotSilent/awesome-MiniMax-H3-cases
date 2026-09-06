import { encodeCatalogSnapshot } from './catalog-snapshot.mjs'
import { createHash } from 'node:crypto'
import { searchText } from '../shared/catalog-query.mjs'
import { gzipSync } from 'node:zlib'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'public/data')
const detailRoot = resolve(outputRoot, 'cases')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const tutorials = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const tutorialResources = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const taxonomy = JSON.parse(await readFile(resolve(root, 'data/taxonomy.json'), 'utf8'))
const creators = JSON.parse(await readFile(resolve(root, 'data/creators.json'), 'utf8'))

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
  text: searchText(item, language, taxonomy),
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

const serverData = {
  version: 1, taxonomy, featuredCaseIds,
  cases: catalogCases.map((card, i) => ({ ...card, search: { zh: searchText(cases[i], 'zh', taxonomy), en: searchText(cases[i], 'en', taxonomy) } })),
  tutorials: catalog.tutorials,
  creators: creators.creators.map(({ slug, caseIds }) => ({ slug, caseIds })),
}
serverData.catalogVersion = createHash('sha256').update(JSON.stringify(serverData)).digest('hex')
await mkdir(resolve(root, 'build/server-data'), { recursive: true })
await writeFile(resolve(root, 'build/server-data/catalog.ndjson'), encodeCatalogSnapshot(serverData))
await rm(resolve(root, 'build/server-data/catalog.json'), { force: true })
const posterById = new Map(catalogCases.map(item => [item.id, item.posterUrl]))
const runtimeCreators = { ...creators, creators: creators.creators.map(creator => ({ ...creator, posterUrls: creator.caseIds.slice(0, 3).map(id => posterById.get(id)).filter(Boolean) })) }

const files = new Map([
  ['catalog.json', catalog],
  ['search-index.zh.json', searchIndex('zh')],
  ['search-index.en.json', searchIndex('en')],
  ['tutorial-guides.json', tutorials],
  ['tutorials.json', tutorialResources],
  ['creators.json', runtimeCreators],
])

for (const [name, value] of files) {
  await writeFile(resolve(outputRoot, name), `${JSON.stringify(value)}\n`)
}

await Promise.all(cases.map((item) => writeFile(
  resolve(detailRoot, `${encodeURIComponent(item.id)}.json`),
  `${JSON.stringify(detailFor(item))}\n`,
)))

// One-release compatibility files; new clients use bounded catalog API responses.
for (const name of ['catalog.json', 'search-index.zh.json', 'search-index.en.json']) {
  console.log(`Compatibility ${name}: ${gzipSync(await readFile(resolve(outputRoot, name))).byteLength} bytes gzip`)
}

const ids = new Set(catalogCases.map((item) => item.id))
if (ids.size !== cases.length) throw new Error('Catalog case IDs are not unique.')
if (catalogCases.length !== cases.length) throw new Error('Catalog is missing public cases.')
if (catalogCases.some((item) => !item.mediaUrl || !item.sourceUrl)) throw new Error('Catalog media/source URLs must be immediately available.')

console.log(`Generated ${catalogCases.length} catalog entries and case detail files.`)
