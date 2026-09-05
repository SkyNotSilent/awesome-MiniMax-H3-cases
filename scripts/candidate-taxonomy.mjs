import { sanitizeTaxonomyClassification, taxonomy } from './taxonomy.mjs'

const comparisonPattern = /(?:\b(?:vs\.?|versus|compare|comparison|benchmark|a\/b)\b|对比|比较|比較|比拼|同(?:一|场景|词)|モデル.*比較)/iu
const workflowPattern = /(?:\b(?:local(?:ly)?|comfyui|workflow|benchmark|rtx|gpu|quantiz|upscal|install|setup|render test)\b|本地|工作流|部署|安装|ローカル|導入|生成テスト)/iu
const dancePattern = /(?:\b(?:dance|dancer|dancing|choreograph|ballet|flamenco)\b|舞蹈|跳舞|舞步|起舞|编舞|ダンス|踊|バレエ)/iu
const dialoguePattern = /(?:\b(?:dialogue|conversation|speaking|speech|lip[ -]?sync)\b|对白|对话|台词|口型|会話|セリフ|口パク)/iu
const musicPattern = /(?:\b(?:music video|song|singer|concert|performance video|mv)\b|音乐视频|歌曲|演唱|歌手|音楽|歌唱)/iu
const actionPattern = /(?:\b(?:action|fight|combat|battle|explosion|vfx|visual effects)\b|动作|打斗|战斗|爆炸|特效|戦闘|格闘)/iu
const advertisingPattern = /(?:\b(?:advert|advertising|commercial|product spot|product film)\b|广告|產品|产品|宣传片|コマーシャル)/iu
const animationPattern = /(?:\b(?:anime|animation|animated|cartoon)\b|动漫|动画|卡通|アニメ)/iu
const cinematicPattern = /(?:\b(?:cinematic|short film|narrative|trailer|film scene)\b|电影|叙事|短片|预告片|映画)/iu

function withoutModelNames(value) {
  return String(value ?? '').replace(/seedance(?:\s*\d+(?:\.\d+)?)?/giu, ' ')
}

export function categoryForCandidate(candidate, caption = '') {
  const text = withoutModelNames(caption)
  const declared = sanitizeTaxonomyClassification(
    candidate.classification ?? candidate.initialClassification ?? {},
  ).category
  if (declared && declared !== 'showcase') return declared
  if (comparisonPattern.test(text)) return 'comparison'
  if (dancePattern.test(text)) return 'dance'
  if (workflowPattern.test(text)) return 'workflow'
  if (dialoguePattern.test(text)) return 'dialogue'
  if (musicPattern.test(text)) return 'music'
  if (actionPattern.test(text)) return 'action-vfx'
  if (advertisingPattern.test(text)) return 'advertising'
  if (animationPattern.test(text)) return 'animation'
  if (cinematicPattern.test(text)) return 'cinematic'
  return declared ?? 'showcase'
}

export function sanitizeCandidateClassification(raw = {}) {
  const taxonomy = sanitizeTaxonomyClassification(raw)
  return {
    ...raw,
    category: taxonomy.category,
    styles: taxonomy.styles,
    scenes: taxonomy.scenes,
    styleBasis: typeof raw.styleBasis === 'string' ? raw.styleBasis.trim().slice(0, 60) : '',
    sceneBasis: typeof raw.sceneBasis === 'string' ? raw.sceneBasis.trim().slice(0, 60) : '',
    invalidValues: taxonomy.invalidValues,
  }
}

export function taxonomyClassifierPrompt() {
  const vocabulary = Object.fromEntries(
    ['categories', 'styles', 'scenes'].map((kind) => [
      kind,
      taxonomy[kind].map(({ key, en }) => ({ key, meaning: en })),
    ]),
  )
  return [
    'Classify only from public source text, public metadata, and visible video content.',
    `Use exactly this taxonomy: ${JSON.stringify(vocabulary)}.`,
    'Return one category key. Return styles and scenes as independent arrays with at most 2 keys each.',
    'When evidence is insufficient, use category "showcase" and return empty arrays; never fill a field by guessing.',
    'Also return styleBasis and sceneBasis as short evidence statements (at most 30 Chinese characters or 60 Latin characters).',
    'Never infer a generation mode from appearance. Never infer, reconstruct, complete, paraphrase, or translate a prompt.',
  ].join(' ')
}

export function resolveCandidateTaxonomy(candidate, caption = '') {
  const raw = candidate.classification ?? candidate.initialClassification ?? {}
  const sanitized = sanitizeCandidateClassification(raw)
  if (sanitized.invalidValues.length) {
    throw new Error(`Candidate classification contains values outside data/taxonomy.json: ${sanitized.invalidValues.join(', ')}`)
  }
  let category = categoryForCandidate(candidate, caption)
  let styles = sanitized.styles
  let scenes = sanitized.scenes

  const needsVideoReview = category === 'showcase' && styles.length === 0 && scenes.length === 0
  const videoRaw = candidate.videoReview ?? {}
  const hasVideoTaxonomy = videoRaw.category || Array.isArray(videoRaw.styles) || Array.isArray(videoRaw.scenes)
  if (needsVideoReview && hasVideoTaxonomy) {
    const video = sanitizeCandidateClassification(videoRaw)
    if (video.invalidValues.length) {
      throw new Error(`Candidate video review contains values outside data/taxonomy.json: ${video.invalidValues.join(', ')}`)
    }
    category = video.category ?? category
    styles = video.styles
    scenes = video.scenes
  }
  return {
    category,
    styles,
    scenes,
    needsVideoReview: category === 'showcase' && styles.length === 0 && scenes.length === 0,
  }
}
