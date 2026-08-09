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
      title: '先看 MiniMax H3 的真实效果。',
      description: '收录公开发布的 H3 视频案例，站内可看，原帖可查。来源明确公开了 Prompt，才按原文呈现。',
      searchLabel: '搜索案例',
      searchPlaceholder: '搜索案例、场景或创作者…',
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
      prompt: '原始 Prompt',
      promptPublished: '来源公开',
      promptNotice: '以下内容按来源原文呈现。',
      promptUnavailable: '来源未公开 Prompt；本页只展示视频和公开信息。',
      copy: '复制 Prompt',
      copied: '已复制',
      source: '查看原始来源',
    },
    toolkit: {
      index: '02 / H3 工具链',
      title: 'H3 工具，按需取用。',
      description: '官方仓库、加速 LoRA、长视频续接与音视频节点独立整理，方便需要时直接查阅。',
      speedLabel: '实战笔记 / 速度组合',
      speedTitle: '少叠插件，先把采样链路跑稳。',
      speedBody: '优先尝试 Turbo LoRA + SageAttention。4 步适合预览，6–8 步用于成片；EasyCache 更适合原生 20 步工作流，不建议和 4 步 Turbo 叠加。',
      speedFootnote: '当前 H3 LoRA 的生态热点仍集中在加速，人物与画风训练处于早期。',
      principlesLabel: '案例库原则 / VIDEO FIRST',
      principles: ['真实视频优先', '原始来源可查', 'Prompt 只收原文'],
    },
    faq: {
      index: '03 / 常见问题',
      title: '先把边界讲清楚。',
      description: '关于案例来源、Prompt 边界与人工审核方式。',
      items: [
        ['这里收录什么？', '公开发布的 MiniMax H3 视频案例。每个案例优先展示真实视频，并链接原始来源。'],
        ['为什么有些案例没有 Prompt？', '只有来源明确公开 Prompt 时才会展示；没有公开的案例只展示视频和公开信息。'],
        ['这里展示的 Prompt 会被修改吗？', '不会。Prompt 保留来源中的语言、内容和格式；本站不补写、不改写，也不根据视频反推。'],
        ['X 上发现的案例会自动发布吗？', '不会。候选案例必须经人工核对模型、作者、原帖、Prompt 来源和版权风险后，才进入公开案例库。'],
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
      title: 'See what MiniMax H3 actually makes.',
      description: 'Publicly shared H3 video examples, viewable here and linked to their sources. Prompts appear only when the source publishes them.',
      searchLabel: 'Search cases',
      searchPlaceholder: 'Search cases, scenes, or creators…',
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
      prompt: 'Original Prompt',
      promptPublished: 'Published by source',
      promptNotice: 'Shown exactly as published by the source.',
      promptUnavailable: 'The source did not publish a prompt. This page shows the video and public details only.',
      copy: 'Copy Prompt',
      copied: 'Copied',
      source: 'View original source',
    },
    toolkit: {
      index: '02 / H3 TOOLKIT',
      title: 'H3 tools, ready when you need them.',
      description: 'Official resources, acceleration LoRA, clip continuation, and audio-video nodes collected in one focused reference page.',
      speedLabel: 'FIELD NOTE / SPEED STACK',
      speedTitle: 'Stabilize the sampling chain before stacking plugins.',
      speedBody: 'Start with Turbo LoRA + SageAttention. Use four steps for previews and six to eight for finals. EasyCache is better suited to the native 20-step workflow and should not be stacked with four-step Turbo.',
      speedFootnote: 'The H3 LoRA ecosystem currently concentrates on acceleration; character and style training remain early.',
      principlesLabel: 'LIBRARY RULES / VIDEO FIRST',
      principles: ['Real video first', 'Original source linked', 'Published prompts only'],
    },
    faq: {
      index: '03 / FAQ',
      title: 'Clear boundaries first.',
      description: 'Case sources, prompt boundaries, and human review policy.',
      items: [
        ['What does this library include?', 'Publicly shared MiniMax H3 video examples. Every case prioritizes the actual video and links to its original source.'],
        ['Why do some cases have no prompt?', 'A prompt appears only when the source explicitly publishes it. Otherwise, the page shows the video and public details only.'],
        ['Are published prompts modified?', 'No. Prompts preserve the language, content, and formatting used by the source. We never complete, rewrite, or infer them from a video.'],
        ['Are cases found on X published automatically?', 'No. A human verifies the model, creator, original post, prompt source, and rights risk before a case becomes public.'],
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
  void language
  return item.prompt
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
  'creator-verbatim': '创作者原文',
  'not-published': '来源未公开',
}

const provenanceEn: Record<VideoCase['promptProvenance'], string> = {
  'official-verbatim': 'Official verbatim',
  'creator-verbatim': 'Creator verbatim',
  'not-published': 'Not published by source',
}

export function provenanceLabel(value: VideoCase['promptProvenance'], language: Language) {
  return language === 'zh' ? provenanceZh[value] : provenanceEn[value]
}
