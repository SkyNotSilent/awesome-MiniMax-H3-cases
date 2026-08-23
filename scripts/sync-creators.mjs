import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildCreatorCatalog } from './creator-catalog.mjs'

const root = resolve(import.meta.dirname, '..')
const write = process.argv.includes('--write')
const canonicalPath = resolve(root, 'data/creators.json')
const publicPath = resolve(root, 'public/creators.json')
const [cases, tutorials, aliasConfig] = await Promise.all([
  readFile(resolve(root, 'data/cases.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'data/creator-aliases.json'), 'utf8').then(JSON.parse),
])

let previousCatalog = null
try {
  previousCatalog = JSON.parse(await readFile(canonicalPath, 'utf8'))
} catch {
  // First generation starts without rank history.
}

const generatedAt = new Date().toISOString()
let catalog = buildCreatorCatalog(cases, tutorials, { aliasConfig, previousCatalog, now: generatedAt })

function comparableCatalog(value) {
  return {
    ...value,
    generatedAt: null,
    creators: value.creators.map((creator) => ({ ...creator, rankDelta: null })),
  }
}

if (previousCatalog && JSON.stringify(comparableCatalog(previousCatalog)) === JSON.stringify(comparableCatalog(catalog))) {
  const previousById = new Map(previousCatalog.creators.map((creator) => [creator.id, creator]))
  catalog = {
    ...catalog,
    generatedAt: previousCatalog.generatedAt,
    creators: catalog.creators.map((creator) => ({
      ...creator,
      rankDelta: previousById.get(creator.id)?.rankDelta ?? creator.rankDelta,
    })),
  }
}
const serialized = `${JSON.stringify(catalog, null, 2)}\n`

if (write) {
  await Promise.all([
    writeFile(canonicalPath, serialized),
    writeFile(publicPath, serialized),
  ])
  console.log(`Synced ${catalog.stats.rankedCreators} ranked creators from ${catalog.stats.sourceCreators} source creators.`)
} else {
  const [canonical, publicCatalog] = await Promise.all([
    readFile(canonicalPath, 'utf8'),
    readFile(publicPath, 'utf8'),
  ])
  const normalize = (text) => {
    const value = JSON.parse(text)
    return {
      ...value,
      generatedAt: catalog.generatedAt,
      creators: value.creators.map((creator) => ({
        ...creator,
        rankDelta: Object.fromEntries(Object.keys(creator.rankDelta).map((key) => [key, null])),
      })),
    }
  }
  const expected = normalize(JSON.stringify(catalog))
  if (JSON.stringify(normalize(canonical)) !== JSON.stringify(expected)) {
    throw new Error('data/creators.json is stale; run npm run sync:creators')
  }
  if (JSON.stringify(normalize(publicCatalog)) !== JSON.stringify(expected)) {
    throw new Error('public/creators.json is stale; run npm run sync:creators')
  }
  console.log(`Creator catalog is current: ${catalog.stats.rankedCreators} ranked creators.`)
}
