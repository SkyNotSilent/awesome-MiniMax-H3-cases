import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const write = process.argv.includes('--write')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const guides = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const resources = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const creatorCatalog = JSON.parse(await readFile(resolve(root, 'data/creators.json'), 'utf8'))
const dates = [
  ...cases.map((item) => item.addedAt),
  ...guides.map((item) => item.addedAt),
  ...resources.map((item) => item.verifiedAt),
].filter(Boolean).sort()

const stats = {
  generatedAt: new Date().toISOString().slice(0, 10),
  cases: cases.length,
  completePrompts: cases.filter((item) => item.promptProvenance !== 'not-published' && item.prompt?.trim()).length,
  hostedVideos: cases.filter((item) => item.mediaUrl === `/media/${item.id}.mp4`).length,
  officialCases: cases.filter((item) => item.sourceType === 'official').length,
  communityCases: cases.filter((item) => item.sourceType !== 'official').length,
  tutorials: guides.length,
  foundationTutorials: guides.filter((item) => item.contentType === 'foundation').length,
  communityTutorials: guides.filter((item) => item.contentType === 'community').length,
  flagshipTutorials: guides.filter((item) => item.flagship).length,
  resources: resources.length,
  sourceCreators: creatorCatalog.stats.sourceCreators,
  rankedCreators: creatorCatalog.stats.rankedCreators,
  videoCreators: creatorCatalog.stats.videoCreators,
  tutorialCreators: creatorCatalog.stats.tutorialCreators,
  latestContentAt: dates.at(-1)?.slice(0, 10) ?? null,
}

const canonicalPath = resolve(root, 'data/project-stats.json')
const publicPath = resolve(root, 'public/site-stats.json')
const serialized = `${JSON.stringify(stats, null, 2)}\n`
const readmeBlocks = [
  {
    path: resolve(root, 'README.md'),
    stats: `**The most complete source-attributed MiniMax H3 case and tutorial library: ${stats.cases} playable videos, ${stats.completePrompts} complete public Prompts, and ${stats.tutorials} practical guides.**`,
    snapshot: `**Current generated snapshot:** ${stats.cases} cases · ${stats.completePrompts} complete public Prompts · ${stats.tutorials} tutorials · ${stats.rankedCreators} ranked creators from ${stats.sourceCreators} source authors · ${stats.flagshipTutorials} flagship guides · ${stats.resources} ecosystem resources · content checked through ${stats.latestContentAt}.`,
    creatorStats: `The dynamic creator board turns the archive into a compounding discovery system. It currently ranks **${stats.rankedCreators} featured creators from ${stats.sourceCreators} source-attributed X authors**, with separate views for overall quality, recent activity, case volume, complete Prompt contribution, rising creators, and tutorial authors.`,
  },
  {
    path: resolve(root, 'README.zh-CN.md'),
    stats: `**更完整、更可信的 MiniMax H3 案例与教程库：${stats.cases} 个可播放视频、${stats.completePrompts} 条完整公开 Prompt、${stats.tutorials} 篇实用教程。**`,
    snapshot: `**当前自动统计：** ${stats.cases} 个案例 · ${stats.completePrompts} 条完整公开 Prompt · ${stats.tutorials} 篇教程 · ${stats.sourceCreators} 位来源作者中的 ${stats.rankedCreators} 位优质创作者 · ${stats.flagshipTutorials} 篇旗舰教程 · ${stats.resources} 个生态资源 · 内容核验至 ${stats.latestContentAt}。`,
    creatorStats: `动态创作者榜把案例库变成持续复利的发现系统。目前从 **${stats.sourceCreators} 位来源明确的 X 作者中筛选出 ${stats.rankedCreators} 位优质创作者**，可查看综合优质、近期活跃、案例最多、Prompt 贡献、新锐作者和教程作者榜。`,
  },
]

function replaceBlock(markdown, name, value) {
  const pattern = new RegExp(`(<!-- ${name}:start -->\\n)[\\s\\S]*?(\\n<!-- ${name}:end -->)`)
  if (!pattern.test(markdown)) throw new Error(`README is missing ${name} markers`)
  return markdown.replace(pattern, `$1${value}$2`)
}

async function expectedReadme(block) {
  const markdown = await readFile(block.path, 'utf8')
  return replaceBlock(replaceBlock(replaceBlock(markdown, 'project-stats', block.stats), 'project-snapshot', block.snapshot), 'creator-stats', block.creatorStats)
}

if (write) {
  const readmes = await Promise.all(readmeBlocks.map(async (block) => ({
    path: block.path,
    markdown: await expectedReadme(block),
  })))
  await Promise.all([
    writeFile(canonicalPath, serialized),
    writeFile(publicPath, serialized),
    ...readmes.map((item) => writeFile(item.path, item.markdown)),
  ])
  console.log(`Synced project stats: ${stats.cases} cases, ${stats.completePrompts} Prompts, ${stats.tutorials} tutorials.`)
} else {
  const [canonical, publicStats, ...readmes] = await Promise.all([
    readFile(canonicalPath, 'utf8'),
    readFile(publicPath, 'utf8'),
    ...readmeBlocks.map((block) => readFile(block.path, 'utf8')),
  ])
  const normalizeDate = (text) => ({ ...JSON.parse(text), generatedAt: stats.generatedAt })
  if (JSON.stringify(normalizeDate(canonical)) !== JSON.stringify(stats)) throw new Error('data/project-stats.json is stale; run npm run sync:stats')
  if (JSON.stringify(normalizeDate(publicStats)) !== JSON.stringify(stats)) throw new Error('public/site-stats.json is stale; run npm run sync:stats')
  for (const [index, block] of readmeBlocks.entries()) {
    const expected = replaceBlock(replaceBlock(replaceBlock(readmes[index], 'project-stats', block.stats), 'project-snapshot', block.snapshot), 'creator-stats', block.creatorStats)
    if (expected !== readmes[index]) throw new Error(`${block.path} has stale project statistics; run npm run sync:stats`)
  }
  console.log(`Project stats are current: ${stats.cases} cases, ${stats.completePrompts} Prompts, ${stats.tutorials} tutorials.`)
}
