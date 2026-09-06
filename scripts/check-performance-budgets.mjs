import { buildMetrics } from './build-metrics.mjs'
import { gzipSync } from 'node:zlib'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const budgets = [
  ['dist/index.html', 60 * 1024],
  ['dist/en/index.html', 60 * 1024],
]

for (const [relativePath, budget] of budgets) {
  const body = await readFile(resolve(root, relativePath))
  const bytes = gzipSync(body).byteLength
  if (bytes > budget) throw new Error(`${relativePath}: ${bytes} bytes gzip exceeds ${budget}`)
  console.log(`${relativePath}: ${bytes} bytes gzip`)
}

const assetNames = await readdir(resolve(root, 'dist/assets'))
const javascript = await Promise.all(assetNames
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFile(resolve(root, 'dist/assets', name))))
const javascriptBytes = javascript.reduce((sum, body) => sum + gzipSync(body).byteLength, 0)
if (javascriptBytes > 180 * 1024) throw new Error(`Homepage JavaScript: ${javascriptBytes} bytes gzip exceeds 184320`)

const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const representativePrompt = cases.find((item) => item.prompt?.length > 300)?.prompt.slice(0, 160)
const bundleText = Buffer.concat(javascript).toString('utf8')
if (representativePrompt && bundleText.includes(representativePrompt)) throw new Error('Homepage JavaScript contains a complete case Prompt.')
if (bundleText.includes('sourceCaption')) throw new Error('Homepage JavaScript contains sourceCaption data.')
console.log(`Homepage JavaScript: ${javascriptBytes} bytes gzip; no case Prompt or sourceCaption payload detected.`)

const metrics = await buildMetrics()
for (const [key, budget] of Object.entries({ catalog: 50 * 1024, decodedCatalog: 250 * 1024, next: 40 * 1024, facets: 8 * 1024, preloadedFonts: 40 * 1024 })) {
  if (metrics[key] > budget) throw new Error(`${key}: ${metrics[key]} exceeds ${budget}`)
  if (metrics[key] > budget * 0.8) console.warn(`Budget warning: ${key} is above 80%`)
}
const critical = Math.max(metrics.htmlZh, metrics.htmlEn) + metrics.css + metrics.javascript + metrics.catalog + metrics.summaryRequests + metrics.preloadedFonts
if (critical > 350 * 1024) throw new Error(`Critical first-load resources: ${critical} exceeds 358400`)
const css = (await Promise.all(assetNames.filter(name => name.endsWith('.css')).map(name => readFile(resolve(root, 'dist/assets', name), 'utf8')))).join('')
if (/fonts\.(googleapis|gstatic)\.com|@import/.test(css)) throw new Error('Blocking external stylesheet found')
console.log(JSON.stringify({ ...metrics, critical, excludedFromCritical: 'posters and user-initiated video measured separately in browser checks' }))
