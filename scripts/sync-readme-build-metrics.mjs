import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { readmeScreenshotFiles } from './readme-screenshot-files.mjs'

const root = resolve(import.meta.dirname, '..')
const write = process.argv.includes('--write')

async function gzipBytes(relativePath) {
  return gzipSync(await readFile(resolve(root, relativePath))).byteLength
}

const assetNames = await readdir(resolve(root, 'dist/assets'))
const javascript = await Promise.all(assetNames
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFile(resolve(root, 'dist/assets', name))))

const metrics = {
  javascript: javascript.reduce((sum, body) => sum + gzipSync(body).byteLength, 0),
  htmlZh: await gzipBytes('dist/index.html'),
  htmlEn: await gzipBytes('dist/en/index.html'),
  catalog: await gzipBytes('dist/data/catalog.json'),
  searchZh: await gzipBytes('dist/data/search-index.zh.json'),
  searchEn: await gzipBytes('dist/data/search-index.en.json'),
}

const formatKilobytes = (bytes) => `${(bytes / 1_000).toFixed(1).replace(/\.0$/, '')} kB`
const blocks = [
  {
    path: resolve(root, 'README.md'),
    value: `**Current production build:** ${formatKilobytes(metrics.javascript)} homepage JavaScript gzip · ${formatKilobytes(metrics.htmlZh)} / ${formatKilobytes(metrics.htmlEn)} Chinese / English homepage HTML gzip · ${formatKilobytes(metrics.catalog)} catalog gzip · ${formatKilobytes(metrics.searchZh)} / ${formatKilobytes(metrics.searchEn)} Chinese / English search indexes gzip. Run \`npm run performance:budget\` for static budgets and \`npm run performance:browser\` against a local production server for browser behavior.`,
  },
  {
    path: resolve(root, 'README.zh-CN.md'),
    value: `**当前生产构建：** 首页 JavaScript gzip ${formatKilobytes(metrics.javascript)} · 中文 / 英文首页 HTML gzip ${formatKilobytes(metrics.htmlZh)} / ${formatKilobytes(metrics.htmlEn)} · 目录 gzip ${formatKilobytes(metrics.catalog)} · 中文 / 英文搜索索引 gzip ${formatKilobytes(metrics.searchZh)} / ${formatKilobytes(metrics.searchEn)}。静态预算运行 \`npm run performance:budget\`；启动本地生产服务后运行 \`npm run performance:browser\` 验证浏览器行为。`,
  },
]

function replaceBlock(markdown, value) {
  const pattern = /(<!-- build-metrics:start -->\n)[\s\S]*?(\n<!-- build-metrics:end -->)/
  if (!pattern.test(markdown)) throw new Error('README is missing build-metrics markers')
  return markdown.replace(pattern, `$1${value}$2`)
}

for (const block of blocks) {
  const markdown = await readFile(block.path, 'utf8')
  const expected = replaceBlock(markdown, block.value)
  if (write) {
    if (expected !== markdown) await writeFile(block.path, expected)
  } else if (expected !== markdown) {
    throw new Error(`${block.path} has stale build metrics; run npm run readme:build-metrics`)
  }
}

if (write) {
  console.log(`Synced README build metrics: ${formatKilobytes(metrics.javascript)} JavaScript, ${formatKilobytes(metrics.catalog)} catalog.`)
} else {
  console.log(`README build metrics are current: ${formatKilobytes(metrics.javascript)} JavaScript, ${formatKilobytes(metrics.catalog)} catalog.`)
}

if (!write) {
  const stats = JSON.parse(await readFile(resolve(root, 'data/project-stats.json'), 'utf8'))
  const manifest = JSON.parse(await readFile(resolve(root, 'docs/screenshots/snapshot.json'), 'utf8'))
  for (const key of ['generatedAt', 'cases', 'completePrompts', 'tutorials', 'rankedCreators']) {
    if (manifest[key] !== stats[key]) throw new Error(`README screenshot snapshot has stale ${key}; run npm run screenshots:capture`)
  }
  for (const filename of readmeScreenshotFiles) {
    const body = await readFile(resolve(root, 'docs/screenshots', filename))
    const hash = createHash('sha256').update(body).digest('hex')
    if (manifest.files?.[filename] !== hash) throw new Error(`README screenshot hash is stale for ${filename}; run npm run screenshots:capture`)
  }
  console.log(`README screenshot snapshot is current: ${manifest.cases} cases, ${manifest.completePrompts} Prompts, ${manifest.tutorials} tutorials.`)
}
