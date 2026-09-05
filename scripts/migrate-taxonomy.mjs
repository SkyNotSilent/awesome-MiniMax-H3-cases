import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sanitizeTaxonomyClassification, taxonomyKeys } from './taxonomy.mjs'

const root = resolve(process.cwd())
const casesPath = resolve(root, 'data/cases.json')
const aliasesPath = resolve(root, 'data/taxonomy-aliases.json')
const reviewRoot = resolve(root, '.review')
const reportPath = resolve(reviewRoot, 'taxonomy-migration-report.md')
const checkpointPath = resolve(reviewRoot, 'taxonomy-migration-checkpoint.json')

const categoryKeys = new Set(taxonomyKeys('categories'))
const styleKeys = new Set(taxonomyKeys('styles'))
const sceneKeys = new Set(taxonomyKeys('scenes'))

const fallbackCategoryAliases = {
  'Cinematic & VFX': 'action-vfx',
  'Action & VFX': 'action-vfx',
  'Character & Dialogue': 'dialogue',
  'Music Video': 'music',
  'UGC & Advertising': 'advertising',
  'Model Comparison': 'comparison',
  'Animated Story': 'animation',
  Anime: 'animation',
  'Local Generation': 'workflow',
  'Local Generation Benchmark': 'workflow',
}

const fallbackStyleAliases = {
  Cinematic: 'cinematic-realistic', Realistic: 'cinematic-realistic', Narrative: 'cinematic-realistic',
  Photoreal: 'photoreal', Photorealistic: 'photoreal', Anime: 'anime', Animation: 'anime',
  'Hand-painted': 'illustration', Illustrative: 'illustration', Painterly: 'illustration', Storybook: 'illustration',
  'Ink Wash': 'illustration', Papercut: 'illustration', Experimental: 'stylized', Abstract: 'stylized',
  Surreal: 'stylized', Techspressionism: 'stylized', Stylized: 'stylized', '1950s': 'retro',
  Retro: 'retro', 'Retro Pop': 'retro', 'Vintage Film': 'retro', Horror: 'dark', Gothic: 'dark', Noir: 'dark',
  Advertising: 'commercial', Commercial: 'commercial', 'Social UGC': 'ugc', 'Social Video': 'ugc',
  Handheld: 'ugc', 'Motion Graphics': 'motion-graphics', Graphic: 'motion-graphics', Vertical: 'vertical',
  'Portrait Format': 'vertical', '3D Workflow': 'cg-3d', Mecha: 'cg-3d', 'Game UI': 'cg-3d',
}

const fallbackSceneAliases = {
  Dialogue: 'dialogue', 'Dialogue Scene': 'dialogue', 'Two-character dialogue': 'dialogue',
  'Two-Character Dialogue': 'dialogue', 'Single-character dialogue': 'dialogue', 'Living-room dialogue': 'dialogue',
  'Character dance': 'dance', 'Street Dance': 'dance', 'Music Video': 'music-performance',
  'Music video': 'music-performance', 'Music performance': 'music-performance', 'Music Performance': 'music-performance',
  'Stage performance': 'music-performance', 'Band Performance': 'music-performance', 'Female singer': 'music-performance',
  'Product Advertising': 'product', 'Product advertising': 'product', 'Product Seeding': 'product',
  'Localized Advertising': 'product', Food: 'food', 'Eating ramen': 'food', 'Shaved Ice': 'food',
  'Fashion film': 'fashion', 'Rainy Tokyo': 'city', 'Rainy street': 'city', 'Subway carriage': 'city',
  'Neon City': 'city', 'Japanese street': 'city', 'Futuristic City': 'city', Beach: 'nature', Jungle: 'nature',
  'Mountain Pass': 'nature', Cliffside: 'nature', 'Mountain garden': 'nature', 'Fantasy forest': 'fantasy',
  'Fantasy landscape': 'fantasy', 'Magical girl transformation': 'fantasy', 'Space-cruise cabin': 'sci-fi',
  'Black-hole window view': 'sci-fi', 'Space Battle': 'sci-fi', 'Starship bridge': 'sci-fi',
  'Action Test': 'combat', 'Action sequence': 'combat', Combat: 'combat', 'Combat sequence': 'combat',
  'Close-quarters combat': 'combat', 'Vehicle Chase': 'combat', 'Animal Character': 'creatures',
  'Creature transformation': 'creatures', 'Deep-sea encyclopedia': 'creatures', 'Cyclops cave': 'creatures',
  Family: 'daily-life', Diner: 'daily-life', Supermarket: 'daily-life', 'Slice of life': 'daily-life',
  'Mother and child': 'daily-life', 'Daily stretching routine': 'daily-life',
}

const comparisonPattern = /(?:\b(?:vs\.?|versus|comparison|compare|benchmark|a\/b|side[- ]by[- ]side)\b|对比|比较|比較|比拼|同(?:一|场景|词)|モデル.*比較)/iu
const workflowPattern = /(?:\b(?:local(?:ly)?|comfyui|workflow|benchmark|rtx|gpu|quantiz|upscal|install|setup|render test|infill|extension)\b|本地|工作流|部署|安装|超分|ローカル|導入|生成テスト)/iu
const dancePattern = /(?:\b(?:dance|dancer|dancing|choreograph|ballet|flamenco|tap[- ]dance)\b|舞蹈|跳舞|舞步|起舞|独舞|编舞|ダンス|踊|バレエ)/iu
const dialoguePattern = /(?:\b(?:dialogue|conversation|speaks?|talking|lip[- ]?sync|sitcom)\b|对白|对话|说话|口型|台词|会話|セリフ|口パク)/iu
const musicPattern = /(?:\b(?:music video|lyric video|singer|song|band|concert|idol|soundtrack|beat[- ]sync)\b|音乐视频|歌曲|歌手|演唱|偶像|音楽|歌|曲|ライブ)/iu
const advertisingPattern = /(?:\b(?:advertis|commercial|product|brand|promo|fashion film|campaign|ugc)\b|广告|產品|产品|宣传片|商品|时尚|廣告|広告)/iu
const animationPattern = /(?:\b(?:anime|animation|animated|cartoon|illustrat|watercolor|sketch|storybook|papercut|chibi)\b|动画|动漫|插画|水彩|线稿|卡通|アニメ|イラスト)/iu
const actionPattern = /(?:\b(?:fight|combat|battle|chase|explosion|vfx|action|warrior|soldier|dragon|martial|gunfight|wrestler)\b|打斗|战斗|追逐|爆炸|特效|战士|士兵|演武|格斗|戦闘|アクション)/iu
const cinematicPattern = /(?:\b(?:cinematic|film|movie|trailer|narrative|story|scene|drama|noir|survival|horror)\b|电影|短片|叙事|故事|预告|场景|剧情|影视|映画|物語)/iu

function withoutModelNames(value) {
  return String(value ?? '')
    .replace(/seedance(?:\s*\d+(?:\.\d+)?)?/giu, ' ')
    .replace(/minimax[- ]?h3|hailuo[- ]?(?:h3|3\.0)|海螺\s*(?:h3|3\.0)/giu, ' ')
}

function publicEvidenceText(item) {
  return withoutModelNames([
    item.title, item.titleEn, item.summary, item.summaryEn, item.sourceCaption, item.editorialBasis,
  ].filter(Boolean).join('\n'))
}

function directAlias(value, aliases, fallback, allowed) {
  if (allowed.has(value)) return value
  if (Object.hasOwn(aliases ?? {}, value)) return aliases[value]
  return fallback[value]
}

function addMatches(target, rules, text) {
  for (const [key, pattern] of rules) if (pattern.test(text) && !target.includes(key)) target.push(key)
}

function inferCategory(item, aliases, text) {
  const direct = directAlias(item.category, aliases.categories, fallbackCategoryAliases, categoryKeys)
  const ambiguous = item.category === 'Community Showcase' || item.category === 'Local Generation & Dance' || direct === null
  if (!ambiguous && direct) return { key: direct, basis: `legacy category: ${item.category}` }
  if (comparisonPattern.test(text)) return { key: 'comparison', basis: 'public text: comparison evidence' }
  if (dancePattern.test(text)) return { key: 'dance', basis: 'public text: dance evidence' }
  if (dialoguePattern.test(text)) return { key: 'dialogue', basis: 'public text: dialogue evidence' }
  if (musicPattern.test(text)) return { key: 'music', basis: 'public text: music-video evidence' }
  if (advertisingPattern.test(text)) return { key: 'advertising', basis: 'public text: advertising/product evidence' }
  if (animationPattern.test(text)) return { key: 'animation', basis: 'public text: animation evidence' }
  if (actionPattern.test(text)) return { key: 'action-vfx', basis: 'public text: action/VFX evidence' }
  if (workflowPattern.test(text)) return { key: 'workflow', basis: 'public text: local/workflow evidence' }
  if (cinematicPattern.test(text)) return { key: 'cinematic', basis: 'public text: cinematic/narrative evidence' }
  return { key: 'showcase', basis: 'insufficient public evidence for a narrower category' }
}

function inferStyles(item, aliases, text) {
  const values = []
  for (const legacy of item.styles ?? []) {
    const mapped = directAlias(legacy, aliases.styles, fallbackStyleAliases, styleKeys)
    if (mapped === 'stylized' && legacy === 'Dance' && !dancePattern.test(text)) continue
    if (mapped && !values.includes(mapped)) values.push(mapped)
  }
  addMatches(values, [
    ['motion-graphics', /(?:motion graphics?|kinetic typography|title cards?|typography|动态图形|动态排版|标题卡)/iu],
    ['illustration', /(?:illustrat|watercolor|sketch|hand[- ]?paint|painter|storybook|papercut|ink wash|line art|插画|水彩|线稿|手绘|剪纸)/iu],
    ['anime', /(?:\banime\b|manga|chibi|动漫|动画角色|アニメ)/iu],
    ['cg-3d', /(?:\b(?:3d|cg|low[- ]poly|three\.js|mecha|gameplay)\b|低多边形|机甲|三维)/iu],
    ['dark', /(?:\b(?:horror|gothic|dark|dracula|noir)\b|恐怖|暗黑|吸血鬼)/iu],
    ['retro', /(?:\b(?:retro|vintage|1950s|film grain|spaghetti western)\b|复古|胶片|怀旧)/iu],
    ['commercial', advertisingPattern],
    ['ugc', /(?:\b(?:ugc|handheld|selfie|vlog|phone camera)\b|手持|自拍|随拍)/iu],
    ['photoreal', /(?:\b(?:photoreal|photo-real)\b|照片级|超写实)/iu],
    ['cinematic-realistic', /(?:\b(?:cinematic|narrative film|film trailer|realistic|live[- ]action)\b|电影感|写实|真人)/iu],
    ['stylized', /(?:\b(?:stylized|experimental|abstract|surreal|techspressionism|neon)\b|风格化|实验|抽象|超现实|霓虹)/iu],
  ], text)
  if (item.aspectRatio === 'portrait') values.push('vertical')
  return [...new Set(values)].filter((value) => styleKeys.has(value)).slice(0, 2)
}

function inferScenes(item, aliases, text) {
  const values = []
  for (const legacy of item.scenes ?? []) {
    const mapped = directAlias(legacy, aliases.scenes, fallbackSceneAliases, sceneKeys)
    if (mapped === 'dance' && !dancePattern.test(text)) continue
    if (mapped && !values.includes(mapped)) values.push(mapped)
  }
  addMatches(values, [
    ['dialogue', dialoguePattern],
    ['dance', dancePattern],
    ['music-performance', /(?:\b(?:singer|band|concert|music performance|stage performance|idol)\b|歌手|乐队|演唱|舞台|偶像|ライブ)/iu],
    ['product', advertisingPattern],
    ['food', /(?:\b(?:food|ramen|bakery|cake|cooking|kitchen|diner|restaurant)\b|美食|拉面|面包|烘焙|厨房|餐厅|料理)/iu],
    ['fashion', /(?:\b(?:fashion|runway|outfit|dress|model shoot)\b|时尚|服装|走秀)/iu],
    ['nature', /(?:\b(?:nature|landscape|forest|mountain|beach|ocean|garden|desert|canyon|cliff|jungle)\b|自然|风景|森林|山|海滩|花园|沙漠|峡谷)/iu],
    ['city', /(?:\b(?:city|street|subway|tokyo|rooftop|alley|urban|laundromat|supermarket)\b|城市|街头|地铁|东京|屋顶|巷|洗衣店|超市)/iu],
    ['sci-fi', /(?:\b(?:sci[- ]?fi|space|starship|black hole|futuristic|cyberpunk|android|mecha)\b|科幻|太空|星舰|黑洞|未来|赛博|机器人|机甲)/iu],
    ['fantasy', /(?:\b(?:fantasy|magic|magical|dragon|angel|shrine|altar|moonlit)\b|奇幻|魔法|龙|天使|神社|祭坛|月夜)/iu],
    ['combat', actionPattern],
    ['creatures', /(?:\b(?:animal|cat|dog|lamb|bird|fish|creature|dragon|rodent|pufferfish|cyclops)\b|动物|猫|狗|羊|鸟|鱼|生物|龙|独眼巨人)/iu],
    ['daily-life', /(?:\b(?:daily life|family|home|living room|classroom|hotel room|slice of life|weekend|stretching)\b|日常|家庭|家中|客厅|教室|酒店|周末|拉伸)/iu],
    ['performance', /(?:\b(?:actor|acting|performance|character|woman|man|girl|boy|portrait|close-up)\b|人物|角色|女子|男子|女孩|男孩|肖像|近景|表演)/iu],
  ], text)
  return [...new Set(values)].filter((value) => sceneKeys.has(value)).slice(0, 2)
}

export function classifyLegacyCase(item, aliases = { categories: {}, styles: {}, scenes: {} }) {
  const text = publicEvidenceText(item)
  const category = inferCategory(item, aliases, text)
  const sanitized = sanitizeTaxonomyClassification({
    category: category.key,
    styles: inferStyles(item, aliases, text),
    scenes: inferScenes(item, aliases, text),
  })
  return { ...sanitized, basis: category.basis }
}

export function migrateCaseTaxonomy(item, aliases = { categories: {}, styles: {}, scenes: {} }) {
  const result = classifyLegacyCase(item, aliases)
  return {
    ...item,
    category: result.category ?? 'showcase',
    styles: result.styles,
    scenes: result.scenes,
  }
}

export function stripTaxonomyFields(item) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => !['category', 'styles', 'scenes'].includes(key)))
}

function legacyValues(cases, field) {
  return [...new Set(cases.flatMap((item) => field === 'category' ? [item[field]] : item[field] ?? []))].sort()
}

function distribution(cases, field) {
  const counts = new Map()
  for (const item of cases) {
    for (const value of field === 'category' ? [item[field]] : item[field] ?? []) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

async function loadAliases() {
  return JSON.parse(await readFile(aliasesPath, 'utf8'))
}

async function run() {
  const apply = process.argv.includes('--apply')
  const cases = JSON.parse(await readFile(casesPath, 'utf8'))
  const aliases = await loadAliases()
  const missing = {}
  for (const field of ['category', 'styles', 'scenes']) {
    const aliasKind = field === 'category' ? 'categories' : field
    const allowed = new Set(taxonomyKeys(aliasKind))
    missing[field] = legacyValues(cases, field).filter((value) => !allowed.has(value) && !Object.hasOwn(aliases[aliasKind] ?? {}, value))
  }
  if (Object.values(missing).some((values) => values.length)) {
    throw new Error(`Unmapped legacy taxonomy values: ${JSON.stringify(missing)}`)
  }

  const migrated = []
  const reviews = []
  for (const [index, item] of cases.entries()) {
    const result = classifyLegacyCase(item, aliases)
    const next = migrateCaseTaxonomy(item, aliases)
    migrated.push(next)
    reviews.push({ id: item.id, from: { category: item.category, styles: item.styles, scenes: item.scenes }, to: { category: next.category, styles: next.styles, scenes: next.scenes }, basis: result.basis })
    if ((index + 1) % 100 === 0 || index === cases.length - 1) {
      await mkdir(reviewRoot, { recursive: true })
      await writeFile(checkpointPath, `${JSON.stringify({ version: 1, processed: index + 1, total: cases.length, lastId: item.id }, null, 2)}\n`)
    }
  }

  for (const [before, after] of cases.map((item, index) => [item, migrated[index]])) {
    if (JSON.stringify(stripTaxonomyFields(before)) !== JSON.stringify(stripTaxonomyFields(after))) {
      throw new Error(`Migration changed non-taxonomy fields for ${before.id}`)
    }
  }

  const section = (label, beforeField, afterField) => {
    const before = distribution(cases, beforeField)
    const after = distribution(migrated, afterField)
    return `## ${label}\n\n- Before: ${before.length} values\n- After: ${after.length} values\n\n${after.map(([value, count]) => `- ${value}: ${count}`).join('\n')}`
  }
  const report = `# Taxonomy migration report\n\nGenerated: ${new Date().toISOString()}\n\nCases: ${cases.length}\n\n${section('Categories', 'category', 'category')}\n\n${section('Styles', 'styles', 'styles')}\n\n${section('Scenes', 'scenes', 'scenes')}\n\n## Per-case review\n\n${reviews.map((item) => `- ${item.id}: ${item.from.category} → ${item.to.category}; styles [${item.to.styles.join(', ')}]; scenes [${item.to.scenes.join(', ')}]; ${item.basis}`).join('\n')}\n`
  await mkdir(reviewRoot, { recursive: true })
  await writeFile(reportPath, report)
  if (!apply) {
    console.log(`Taxonomy report written to ${reportPath}. Re-run with --apply to update data/cases.json.`)
    return
  }
  const temporaryPath = `${casesPath}.taxonomy-${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(migrated, null, 2)}\n`)
  await rename(temporaryPath, casesPath)
  console.log(`Migrated ${migrated.length} cases. Report: ${reportPath}`)
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isCli) await run()
