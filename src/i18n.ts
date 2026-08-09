import type { CaseMode, VideoCase } from './types'

export type Language = 'zh' | 'en'
export type AppPage = 'home' | 'toolkit' | 'faq'

export interface AppRoute {
  language: Language
  page: AppPage
}

export function resolveRoute(pathname: string): AppRoute {
  const segments = pathname.split('/').filter(Boolean)
  const language: Language = segments[0] === 'en' ? 'en' : 'zh'
  const pageSegment = segments[language === 'en' ? 1 : 0]
  const page: AppPage = pageSegment === 'toolkit' || pageSegment === 'faq' ? pageSegment : 'home'
  return { language, page }
}

export function pathFor(language: Language, page: AppPage) {
  const prefix = language === 'en' ? '/en' : ''
  return page === 'home' ? `${prefix}/` : `${prefix}/${page}/`
}

export function casePath(language: Language, id: string) {
  return `${language === 'en' ? '/en' : ''}/cases/${encodeURIComponent(id)}/`
}

export const copy = {
  zh: {
    htmlLang: 'zh-CN',
    siteTitle: 'Awesome MiniMax H3 — 视频案例库',
    siteDescription: '可筛选、可追溯、可站内观看的 MiniMax H3 / Hailuo 3.0 视频案例库。',
    nav: { cases: '案例', toolkit: '工具链', faq: '常见问题', source: '源码', language: 'EN' },
    intro: {
      kicker: 'COMMUNITY VIDEO ARCHIVE / 2026',
      lineOne: 'H3',
      lineTwo: 'FIELD NOTES',
      description: 'MiniMax H3 社区视频实验档案',
      ready: '案例界面已就绪',
      skip: '跳过开场',
    },
    catalog: {
      index: '01 / 案例索引',
      title: '先看效果，再拆工作流。',
      description: '公开视频、提示词来源和生成路径，点开封面即可站内观看。',
      searchLabel: '搜索案例',
      searchPlaceholder: '搜索案例、场景、工作流…',
      clearSearch: '清除搜索',
      filterLabel: '案例筛选',
      mode: '生成模式',
      advanced: '更多筛选',
      advancedActive: '更多筛选 · 已启用',
      category: '内容分类',
      style: '视觉风格',
      scene: '场景',
      resultUnit: '条案例',
      noMatchesEyebrow: '没有匹配结果',
      noMatches: '换一个关键词或筛选条件试试。',
    },
    card: {
      open: (title: string) => `查看 ${title} 详情`,
      cover: (title: string) => `${title} 视频封面`,
      play: '播放',
      view: '查看',
      verified: '官方可复现',
      community: 'X 社区',
    },
    dialog: {
      close: '关闭详情',
      seconds: '秒',
      prompt: '提示词记录',
      copy: '复制',
      copied: '已复制',
      source: '查看原始来源',
    },
    toolkit: {
      index: '02 / H3 工具链',
      title: '从提示词，一路接到成片。',
      description: '把真正影响落地效率的官方 Skill、加速 LoRA、长视频续接和音视频工作流放在一个独立工作台。',
      speedLabel: '实战笔记 / 速度组合',
      speedTitle: '少叠插件，先把采样链路跑稳。',
      speedBody: '优先尝试 Turbo LoRA + SageAttention。4 步适合预览，6–8 步用于成片；EasyCache 更适合原生 20 步工作流，不建议和 4 步 Turbo 叠加。',
      speedFootnote: '当前 H3 LoRA 的生态热点仍集中在加速，人物与画风训练处于早期。',
      pipelineLabel: '下一条流水线 / 自动出片',
      pipeline: ['组织提示词', '生成音视频', '自动剪辑与交付'],
    },
    faq: {
      index: '03 / 常见问题',
      title: '先把边界讲清楚。',
      description: '关于模型命名、生成模式、案例来源和审核方式。',
      items: [
        ['MiniMax H3 和 Hailuo 3.0 是什么关系？', '本项目把 MiniMax H3 作为模型名称，同时覆盖社区常用的 Hailuo 3.0 / 海螺 3.0 检索表达，方便找到同一技术生态下的视频案例。'],
        ['这里有哪些 AI 视频生成模式？', '当前收录 T2VA 文字生视频、FL2VA 首尾帧条件视频，以及 Ref2VA 全模态参考视频；案例可包含图像、视频、声音、对白和时间轴控制。'],
        ['X 上发现的案例会自动发布吗？', '不会。浏览器任务只写入候选队列；核对模型、作者、原帖、提示词来源和版权风险并经人工批准后，才进入公开案例库。'],
        ['为什么有些案例没有完整提示词？', '我们不会推断或伪造未公开提示词。案例仍可用于观察模型效果，但会明确标注提示词来源和信息缺口。'],
      ],
    },
    footer: {
      mark: '开放社区档案',
      note: '仅收录公开来源；版权归原作者所有。发现错误或希望移除内容，请提交 Issue。',
    },
  },
  en: {
    htmlLang: 'en',
    siteTitle: 'Awesome MiniMax H3 — Video Case Library',
    siteDescription: 'A filterable, source-attributed MiniMax H3 / Hailuo 3.0 video case library with in-site playback.',
    nav: { cases: 'Cases', toolkit: 'Toolkit', faq: 'FAQ', source: 'Source', language: 'ZH' },
    intro: {
      kicker: 'COMMUNITY VIDEO ARCHIVE / 2026',
      lineOne: 'H3',
      lineTwo: 'FIELD NOTES',
      description: 'A field archive of MiniMax H3 video experiments',
      ready: 'Case browser ready',
      skip: 'Skip intro',
    },
    catalog: {
      index: '01 / CASE INDEX',
      title: 'See the result. Trace the workflow.',
      description: 'Public videos, prompt provenance, and generation paths. Open any cover to watch in place.',
      searchLabel: 'Search cases',
      searchPlaceholder: 'Search cases, scenes, workflows…',
      clearSearch: 'Clear search',
      filterLabel: 'Case filters',
      mode: 'Generation mode',
      advanced: 'More filters',
      advancedActive: 'More filters · Active',
      category: 'Category',
      style: 'Visual style',
      scene: 'Scene',
      resultUnit: 'cases',
      noMatchesEyebrow: 'NO MATCHES',
      noMatches: 'Try another search or filter.',
    },
    card: {
      open: (title: string) => `View details for ${title}`,
      cover: (title: string) => `Video cover for ${title}`,
      play: 'Play',
      view: 'View',
      verified: 'Official reproduction',
      community: 'X community',
    },
    dialog: {
      close: 'Close details',
      seconds: 'sec',
      prompt: 'Prompt record',
      copy: 'Copy',
      copied: 'Copied',
      source: 'View original source',
    },
    toolkit: {
      index: '02 / H3 TOOLKIT',
      title: 'From prompt to finished cut.',
      description: 'A focused workbench for the official Skills, acceleration LoRA, clip continuation, and audio-video workflows that change production speed.',
      speedLabel: 'FIELD NOTE / SPEED STACK',
      speedTitle: 'Stabilize the sampling chain before stacking plugins.',
      speedBody: 'Start with Turbo LoRA + SageAttention. Use four steps for previews and six to eight for finals. EasyCache is better suited to the native 20-step workflow and should not be stacked with four-step Turbo.',
      speedFootnote: 'The H3 LoRA ecosystem currently concentrates on acceleration; character and style training remain early.',
      pipelineLabel: 'NEXT PIPELINE / AUTOMATED OUTPUT',
      pipeline: ['Structure prompts', 'Generate audio + video', 'Edit and deliver'],
    },
    faq: {
      index: '03 / FAQ',
      title: 'Clear boundaries first.',
      description: 'Model naming, generation modes, sources, and review policy.',
      items: [
        ['How are MiniMax H3 and Hailuo 3.0 related?', 'This project uses MiniMax H3 as the model name while also indexing the Hailuo 3.0 name commonly used by the community, so cases from the same technical ecosystem remain discoverable.'],
        ['Which AI video generation modes are included?', 'The library currently covers T2VA text-to-video with audio, FL2VA first/last-frame conditioning, and Ref2VA multimodal reference generation with image, video, audio, dialogue, and timeline controls.'],
        ['Are cases found on X published automatically?', 'No. Browser discovery only writes to a candidate queue. A case becomes public after a human verifies the model, author, original post, prompt provenance, and rights risk.'],
        ['Why do some cases omit the full prompt?', 'We never infer or fabricate an undisclosed prompt. The case can still document model behavior, but its provenance and information gaps remain explicit.'],
      ],
    },
    footer: {
      mark: 'OPEN COMMUNITY ARCHIVE',
      note: 'Public sources only; rights remain with their creators. Open an Issue to correct or remove a record.',
    },
  },
} as const

const modeZh: Record<'ALL' | CaseMode, string> = {
  ALL: '全部案例',
  T2VA: '文字生视频 + 音频',
  FL2VA: '首尾帧视频 + 音频',
  Ref2VA: '全模态参考',
  Unknown: '模式待确认',
}

const modeEn: Record<'ALL' | CaseMode, string> = {
  ALL: 'All cases',
  T2VA: 'Text-to-Video + Audio',
  FL2VA: 'First/Last-Frame + Audio',
  Ref2VA: 'Multimodal Reference',
  Unknown: 'Unconfirmed mode',
}

export function modeLabel(mode: 'ALL' | CaseMode, language: Language) {
  return language === 'zh' ? modeZh[mode] : modeEn[mode]
}

const categoryZh: Record<string, string> = {
  'AI Film & Multimodal Reference': 'AI 电影与多模态参考',
  'Advertising & Comparison': '广告与模型对比',
  'Character & Dialogue': '角色与对白',
  'Character Consistency & Benchmark': '角色一致性与性能测试',
  'Cinematic & Survival': '电影叙事与生存',
  'Cinematic & Upscaling Workflow': '电影镜头与超分工作流',
  'Cinematic & VFX': '电影镜头与视觉特效',
  'Editing & Transformation': '视频编辑与变换',
  'Education & Storytelling': '教育与故事表达',
  'Food & Lifestyle': '美食与生活方式',
  'Food & Local Generation': '美食与本地生成',
  'Image-to-Video & Local Generation': '图片生视频与本地生成',
  'Image-to-Video Benchmark': '图片生视频性能测试',
  'Image-to-Video Workflow': '图片生视频工作流',
  'Interactive UI & Model Comparison': '交互界面与模型对比',
  'Local Generation': '本地生成',
  'Local Generation & Audio': '本地音视频生成',
  'Local Generation Benchmark': '本地生成性能测试',
  'Model Comparison': '模型对比',
  'Music Video': '音乐视频',
  'Music Video & Multi-scene Workflow': '音乐视频与多场景工作流',
  'Narrative Film & Local Workflow': '叙事电影与本地工作流',
  'UGC & Advertising': 'UGC 与广告',
}

const styleZh: Record<string, string> = {
  '1950s': '1950 年代', 'Character Edit': '角色编辑', Cinematic: '电影感', Commercial: '商业广告',
  'Fantasy UI': '奇幻界面', 'Film Trailer': '电影预告', 'Golden Hour': '黄金时刻', 'Hand-painted': '手绘',
  Illustrative: '插画', 'Layered Composition': '分层构图', 'Lyric Video': '歌词视频', 'Music Video': '音乐视频',
  Narrative: '叙事', 'Narrative Film': '叙事电影', Photorealistic: '照片级写实', Polished: '精致成片',
  Realistic: '写实', 'Sci-Fi': '科幻', 'Shallow Focus': '浅景深', 'Social UGC': '社交平台 UGC',
  'Stop-motion': '停格动画', Stylized: '风格化', Underwater: '水下', Unspecified: '未标注',
}

const sceneZh: Record<string, string> = {
  Blizzard: '暴风雪', 'Character sheet test': '角色表测试', 'Claude Code workflow': 'Claude Code 工作流',
  'ComfyUI benchmark': 'ComfyUI 性能测试', 'Creature transformation': '生物形态变换', 'Deep-sea encyclopedia': '深海生物百科',
  Dialogue: '对白', Diner: '餐厅', 'Eating ramen': '吃拉面', Editing: '视频编辑', Family: '家庭', 'Female singer': '女歌手',
  'Five-scene sequence': '五场景序列', 'Flight scene': '飞行场景', 'Fluid Simulation': '流体模拟', 'Fluid test': '流体测试',
  Food: '美食', 'Fur test': '毛发测试', 'I2V performance test': 'I2V 性能测试', 'Krea-to-H3 workflow': 'Krea 到 H3 工作流',
  'Localized Advertising': '本地化广告', 'Model Comparison': '模型对比', 'Mother and child': '母子',
  'Multi-reference film trailer': '多参考图电影预告', 'Music Storytelling': '音乐叙事', 'Music Video': '音乐视频',
  'Music video': '音乐视频', 'Object Composition': '对象分层构图', 'Person Replacement': '人物替换',
  'Product Advertising': '产品广告', 'Product Seeding': '商品种草', 'Rainy Tokyo': '雨中东京', 'Rendered text': '文字渲染',
  'Same-prompt comparison': '同提示词对比', Storytelling: '故事叙述', Survival: '生存', 'Textbook Recreation': '课本场景复刻',
  'The White Camellia': '白山茶', 'Time Freeze': '时间冻结', 'Turbo LoRA test': 'Turbo LoRA 测试', 'UI interaction': '界面交互', VFX: '视觉特效',
}

export type TaxonomyKind = 'category' | 'style' | 'scene'

export function taxonomyLabel(value: string, language: Language, kind: TaxonomyKind) {
  if (value === 'ALL') return language === 'zh' ? '全部' : 'All'
  if (language === 'en') return value
  if (kind === 'category') return categoryZh[value] ?? value
  if (kind === 'style') return styleZh[value] ?? value
  return sceneZh[value] ?? value
}

export function caseTitle(item: VideoCase, language: Language) {
  return language === 'zh' ? item.title : item.titleEn
}

export function caseSummary(item: VideoCase, language: Language) {
  return language === 'zh' ? item.summary : item.summaryEn
}

export function casePrompt(item: VideoCase, language: Language) {
  if (language === 'zh') return item.prompt
  return item.promptEn ?? item.prompt
}

export function sourceLabel(item: VideoCase, language: Language) {
  if (language === 'zh') return item.sourceLabel
  if (item.sourceType === 'official') return 'MiniMax official reproduction script'
  const handle = item.sourceUrl.match(/x\.com\/([^/]+)/)?.[1]
  return item.sourceType === 'x' ? `Original X post${handle ? ` · @${handle}` : ''}` : `Community source · ${item.author}`
}

export function modelLabel(item: VideoCase, language: Language) {
  if (language === 'zh') return item.model
  return item.model
    .replace('（创作者标注）', ' (creator-identified)')
    .replace(/^MiniMax H3 与 (.+) 对比$/, 'MiniMax H3 vs $1')
    .replaceAll(' 与 ', ' vs ')
}

export function metadataValue(value: string, language: Language) {
  if (language === 'en' && value === '原帖') return 'Original post'
  if (language === 'en' && value === '原帖未标注') return 'Not specified in the original post'
  return value
}

const provenanceZh: Record<VideoCase['promptProvenance'], string> = {
  'official-verbatim': '官方原文',
  'official-adapted': '官方改写',
  'creator-verbatim': '创作者原文',
  reconstructed: '人工重建',
  unknown: '未公开 / 待确认',
}

const provenanceEn: Record<VideoCase['promptProvenance'], string> = {
  'official-verbatim': 'Official verbatim',
  'official-adapted': 'Official adapted',
  'creator-verbatim': 'Creator verbatim',
  reconstructed: 'Reconstructed',
  unknown: 'Undisclosed / unconfirmed',
}

export function provenanceLabel(value: VideoCase['promptProvenance'], language: Language) {
  return language === 'zh' ? provenanceZh[value] : provenanceEn[value]
}
