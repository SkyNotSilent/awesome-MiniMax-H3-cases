import { readCatalogSnapshot } from './catalog-snapshot.mjs'
import { createCatalogIndex, queryCatalog } from '../shared/catalog-query.mjs'
import { strict as assert } from 'node:assert'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { test } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const sourceCases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const sourceTutorials = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const catalogPath = resolve(root, 'public/data/catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))

test('versioned tutorial endpoint contains the current public guides and a content hash', async () => {
  const { createHash } = await import('node:crypto')
  const payload = JSON.parse(await readFile(resolve(root, 'public/data/tutorial-guides.v2.json'), 'utf8'))
  assert.equal(payload.schemaVersion, 2)
  assert.deepEqual(payload.guides, sourceTutorials)
  assert.equal(payload.contentVersion, createHash('sha256').update(JSON.stringify(sourceTutorials)).digest('hex'))
})

test('compatibility catalog is complete, unique, and contains no detail text', async () => {
  assert.equal(catalog.cases.length, sourceCases.length)
  assert.equal(new Set(catalog.cases.map((item) => item.id)).size, sourceCases.length)
  assert.ok(catalog.cases.every((item) => item.mediaUrl && item.sourceUrl))
  assert.ok(catalog.cases.every((item) => !Number.isNaN(Date.parse(item.addedAt))))
  assert.ok(catalog.cases.every((item) => !Object.hasOwn(item, 'summary') && !Object.hasOwn(item, 'prompt') && !Object.hasOwn(item, 'sourceCaption')))
  const index = createCatalogIndex(await readCatalogSnapshot(resolve(root, 'build/server-data/catalog.ndjson')))
  const first = queryCatalog(index)
  assert.equal(first.cases.length, 36)
  assert.equal(first.total, sourceCases.length)
  assert.ok(gzipSync(JSON.stringify(first)).byteLength <= 50 * 1024)
  assert.ok(Buffer.byteLength(JSON.stringify(first)) <= 250 * 1024)
  assert.ok(catalog.featuredCaseIds.length >= 24 && catalog.featuredCaseIds.length <= 28)
  assert.equal(new Set(catalog.featuredCaseIds).size, catalog.featuredCaseIds.length)
  assert.deepEqual(new Set(catalog.featuredCaseIds), new Set(sourceCases.filter((item) => item.featured).map((item) => item.id)))
  assert.equal(catalog.generatedAt, [...sourceCases, ...sourceTutorials].map((item) => item.addedAt).sort().at(-1))
})

test('case details and catalog entries reconstruct all dialog fields', async () => {
  const detailNames = await readdir(resolve(root, 'public/data/cases'))
  assert.equal(detailNames.length, sourceCases.length)
  for (const source of sourceCases) {
    const compact = catalog.cases.find((item) => item.id === source.id)
    const detail = JSON.parse(await readFile(resolve(root, 'public/data/cases', `${encodeURIComponent(source.id)}.json`), 'utf8'))
    assert.equal(detail.promptCompleteness, source.promptCompleteness)
    assert.deepEqual({
      id: compact.id,
      mediaUrl: compact.mediaUrl,
      sourceUrl: compact.sourceUrl,
      summary: detail.summary,
      summaryEn: detail.summaryEn,
      prompt: detail.prompt,
      model: detail.model,
      sourceLabel: detail.sourceLabel,
      resolution: detail.resolution,
      aspectRatio: detail.aspectRatio,
      promptProvenance: detail.promptProvenance,
    }, {
      id: source.id,
      mediaUrl: source.mediaUrl,
      sourceUrl: source.sourceUrl,
      summary: source.summary,
      summaryEn: source.summaryEn,
      prompt: source.prompt,
      model: source.model,
      sourceLabel: source.sourceLabel,
      resolution: source.resolution,
      aspectRatio: source.aspectRatio,
      promptProvenance: source.promptProvenance,
    })
  }
})

test('compatibility search indexes cover every public case while API search stays within its response budget', async () => {
  for (const language of ['zh', 'en']) {
    const path = resolve(root, `public/data/search-index.${language}.json`)
    const body = await readFile(path)
    const records = JSON.parse(body)
    assert.equal(records.length, sourceCases.length)
    assert.equal(new Set(records.map((item) => item.id)).size, sourceCases.length)
    assert.ok(records.every((item) => item.text === item.text.toLocaleLowerCase()))
    const index = createCatalogIndex(await readCatalogSnapshot(resolve(root, 'build/server-data/catalog.ndjson')))
    const page = queryCatalog(index, new URLSearchParams({ language, q: 'H3' }))
    assert.ok(page.cases.length <= 36)
    assert.ok(gzipSync(JSON.stringify(page)).byteLength <= 50 * 1024)
  }
})
