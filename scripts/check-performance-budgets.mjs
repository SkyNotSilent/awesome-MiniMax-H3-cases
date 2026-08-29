import { gzipSync } from 'node:zlib'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const budgets = [
  ['dist/index.html', 60 * 1024],
  ['dist/en/index.html', 60 * 1024],
  ['dist/data/catalog.json', 150 * 1024],
  ['dist/data/search-index.zh.json', 700 * 1024],
  ['dist/data/search-index.en.json', 700 * 1024],
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
