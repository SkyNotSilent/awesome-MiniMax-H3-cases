import type { CaseMode, VideoCase } from './types'

export type Language = 'zh' | 'en'
export type AppPage = 'home' | 'tutorials' | 'faq'

export interface AppRoute {
  language: Language
  page: AppPage
}

export function resolveRoute(pathname: string): AppRoute {
  const segments = pathname.split('/').filter(Boolean)
  const language: Language = segments[0] === 'en' ? 'en' : 'zh'
  const pageSegment = segments[language === 'en' ? 1 : 0]
  const page: AppPage = pageSegment === 'tutorials' || pageSegment === 'toolkit'
    ? 'tutorials'
    : pageSegment === 'faq'
      ? 'faq'
      : 'home'
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
    siteTitle: 'Awesome MiniMax H3 — 视频案例与教程',
    siteDescription: '713 个可筛选、可追溯、可站内观看的 MiniMax H3 / Hailuo 3.0 视频案例，以及公开 Prompt 与来源核验教程。',
    nav: { cases: '案例', tutorials: '教程', faq: '常见问题', source: '源码', language: 'EN' },
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
      duration: '视频时长',
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
    tutorials: {
      index: '02 / H3 教程',
      title: '从案例，走到真正跑起来。',
      description: '一张持续更新的 MiniMax H3 生态地图：从官方部署、Mac 原生与 ComfyUI 工作流，到加速、长视频、音频、训练和资源导航。每条路线都说明它解决什么问题、适合谁以及如何开始。',
      searchLabel: '搜索教程',
      searchPlaceholder: '搜索平台、能力或项目…',
      clearSearch: '清除教程搜索',
      filterLabel: '教程分类',
      categories: {
        all: '全部路线',
        official: '官方入门',
        mac: 'Mac 原生',
        workflow: '导演工作流',
        acceleration: '采样加速',
        'long-video': '长视频',
        audio: '音频工作流',
        training: '训练微调',
        resources: '资源导航',
      },
      featuredLabel: '本周重点',
      bestFor: '适合：',
      startLabel: '三步起跑',
      verified: '资料核验',
      commandLabel: 'h3.c 起步命令',
      noResults: '没有匹配的教程，换一个关键词或分类试试。',
      fieldNoteLabel: '实战提示 / SPEED STACK',
      fieldNoteTitle: '加速不是把开关全部打开。',
      fieldNoteBody: 'ComfyUI 路线可先从 Turbo LoRA 的 v4 EMA、simple 调度器与 6–8 步开始。4 步更适合预览；Motion Context 明确建议关闭 Spectrum。不同加速器是否能叠加，应以各自当前 README 和固定素材 A/B 为准。',
      sourceNote: '教程摘要只整理项目公开文档，不从案例视频反推隐藏流程。外部项目持续更新，执行前请再次查看原始 README。',
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
    siteTitle: 'Awesome MiniMax H3 — Video Examples & Tutorials',
    siteDescription: '713 filterable, source-attributed MiniMax H3 / Hailuo 3.0 video examples with in-site playback, public prompts, and source-checked tutorials.',
    nav: { cases: 'Cases', tutorials: 'Tutorials', faq: 'FAQ', source: 'Source', language: 'ZH' },
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
      duration: 'Duration',
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
    tutorials: {
      index: '02 / H3 TUTORIALS',
      title: 'From watching examples to running H3.',
      description: 'A living map of the MiniMax H3 ecosystem: official setup, native Mac inference, ComfyUI workflows, acceleration, long video, audio, training, and resource indexes. Every route explains what it solves, who it is for, and how to start.',
      searchLabel: 'Search tutorials',
      searchPlaceholder: 'Search platforms, capabilities, or projects…',
      clearSearch: 'Clear tutorial search',
      filterLabel: 'Tutorial categories',
      categories: {
        all: 'All routes',
        official: 'Official setup',
        mac: 'Native Mac',
        workflow: 'Director workflows',
        acceleration: 'Acceleration',
        'long-video': 'Long video',
        audio: 'Audio workflows',
        training: 'Fine-tuning',
        resources: 'Resource maps',
      },
      featuredLabel: 'FEATURED NOW',
      bestFor: 'Best for: ',
      startLabel: 'START IN THREE STEPS',
      verified: 'Source checked',
      commandLabel: 'h3.c starter commands',
      noResults: 'No tutorial matches this search. Try another term or category.',
      fieldNoteLabel: 'FIELD NOTE / SPEED STACK',
      fieldNoteTitle: 'Acceleration is not every switch at once.',
      fieldNoteBody: 'For the ComfyUI route, start with Turbo LoRA v4 EMA, the simple scheduler, and six to eight steps. Four steps suit previews; Motion Context explicitly recommends keeping Spectrum off. Test other combinations against current READMEs and fixed-input A/B renders.',
      sourceNote: 'Tutorial summaries are grounded in public project documentation, never inferred from case videos. External projects evolve, so recheck the original README before running a guide.',
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

export type DurationRange = 'ALL' | 'UP_TO_5' | 'SIX_TO_10' | 'ELEVEN_TO_15' | 'OVER_15'

const durationZh: Record<DurationRange, string> = {
  ALL: '全部时长',
  UP_TO_5: '5 秒及以下',
  SIX_TO_10: '6–10 秒',
  ELEVEN_TO_15: '11–15 秒',
  OVER_15: '超过 15 秒',
}

const durationEn: Record<DurationRange, string> = {
  ALL: 'All durations',
  UP_TO_5: 'Up to 5s',
  SIX_TO_10: '6–10s',
  ELEVEN_TO_15: '11–15s',
  OVER_15: 'Over 15s',
}

export function durationLabel(range: DurationRange, language: Language) {
  return language === 'zh' ? durationZh[range] : durationEn[range]
}

const categoryZh: Record<string, string> = {
  'AI Film & Multimodal Reference': 'AI 电影与多模态参考',
  'Advertising & Comparison': '广告与模型对比',
  'Character & Dialogue': '角色与对白',
  'Character Consistency & Benchmark': '角色一致性与性能测试',
  'Cinematic & Survival': '电影叙事与生存',
  'Cinematic & Upscaling Workflow': '电影镜头与超分工作流',
  'Cinematic & VFX': '电影镜头与视觉特效',
  'Community Showcase': '社区案例',
  'Editing & Transformation': '视频编辑与变换',
  'Education & Storytelling': '教育与故事表达',
  'Food & Lifestyle': '美食与生活方式',
  'Food & Local Generation': '美食与本地生成',
  'Image-to-Video & Local Generation': '图片生视频与本地生成',
  'Image-to-Video Benchmark': '图片生视频性能测试',
  'Image-to-Video Workflow': '图片生视频工作流',
  'Interactive UI & Model Comparison': '交互界面与模型对比',
  'Local Generation': '本地生成',
  'Local Generation & Dance': '本地生成与舞蹈',
  'Local Generation & Audio': '本地音视频生成',
  'Local Generation Benchmark': '本地生成性能测试',
  'Model Comparison': '模型对比',
  'Music Video': '音乐视频',
  'Music Video & Multi-scene Workflow': '音乐视频与多场景工作流',
  'Narrative Film & Local Workflow': '叙事电影与本地工作流',
  'UGC & Advertising': 'UGC 与广告',
}

const styleZh: Record<string, string> = {
  '2D Cartoon': '二维卡通', 'Character Art': '角色艺术', Dance: '舞蹈', Handheld: '手持镜头', 'Pulp Anime': '复古通俗动漫',
  'Spaghetti Western': '意大利式西部片', 'Street Portrait': '街头肖像', Surreal: '超现实', Television: '电视节目',
  'Television Comedy': '电视喜剧', 'Transformation Sequence': '变身序列', 'Vintage Film': '复古电影', 'Warm Lighting': '暖光',
  Advertising: '广告', Animation: '动画', Artistic: '艺术化', Benchmark: '性能测试', 'Character Reference': '角色参考',
  'Character Showcase': '角色展示', Chibi: 'Q 版', Compilation: '合集', Compositing: '合成', Cute: '可爱',
  'Dynamic Camera': '动态运镜', 'Game UI': '游戏界面', 'Game-Inspired': '游戏风格', Lifestyle: '生活方式', Mecha: '机甲',
  'Multi-Clip': '多片段', 'Multi-Scene': '多场景', Noir: '黑色电影', POV: '主观视角', Photoreal: '照片写实',
  Romance: '爱情', Romantic: '浪漫', 'Science Fiction': '科幻', Vertical: '竖屏', 'Workflow Demo': '工作流演示',
  Abstract: '抽象', Action: '动作', Anime: '动漫', Architectural: '建筑视觉', 'Character Video': '角色视频', Clean: '简洁',
  Coastal: '海岸', Colorful: '色彩鲜明', Comparative: '对比展示', Cyberpunk: '赛博朋克', Dialogue: '对白', Dynamic: '动感',
  Energetic: '活力', Experimental: '实验性', Fantasy: '奇幻', Futuristic: '未来感', Gothic: '哥特', Graphic: '图形化',
  'High Resolution': '高分辨率', Horror: '恐怖', Humorous: '幽默', 'Ink Wash': '水墨', 'Japanese Summer': '日式夏日', Korean: '韩式',
  'Motion Graphics': '动态图形', 'Music Performance': '音乐表演', Neon: '霓虹', Playful: '俏皮', Portrait: '肖像', 'Portrait Format': '竖屏',
  'Poster Art': '海报艺术', Retro: '复古', 'Retro Pop': '复古流行', Sitcom: '情景喜剧', 'Social Video': '社交短视频', 'TV Drama': '电视剧',
  Technical: '技术展示', Techspressionism: '科技表现主义', Vibrant: '鲜艳',
  '1950s': '1950 年代', 'Character Edit': '角色编辑', Cinematic: '电影感', Commercial: '商业广告',
  'Fantasy UI': '奇幻界面', 'Film Trailer': '电影预告', 'Golden Hour': '黄金时刻', 'Hand-painted': '手绘',
  Illustrative: '插画', 'Layered Composition': '分层构图', 'Lyric Video': '歌词视频', 'Music Video': '音乐视频',
  Narrative: '叙事', 'Narrative Film': '叙事电影', Photorealistic: '照片级写实', Polished: '精致成片',
  Realistic: '写实', 'Sci-Fi': '科幻', 'Shallow Focus': '浅景深', 'Social UGC': '社交平台 UGC',
  'Stop-motion': '停格动画', Stylized: '风格化', Underwater: '水下', Unspecified: '未标注',
}

const sceneZh: Record<string, string> = {
  'Bar exterior': '酒吧外景', 'Beat-synced title cards': '节拍同步标题卡', 'Black-hole window view': '舷窗外的黑洞',
  'Character animation': '角色动画', 'Character close-up': '角色特写', 'Character dance': '角色舞蹈', Cliffside: '悬崖边',
  'Cloud-head transformation': '云朵头部变形', 'Colorful studio': '彩色影棚', 'Continuous tracking shot': '连续跟拍镜头',
  'Dance-video cameo insertion': '舞蹈视频客串插入', 'Desert silhouettes': '沙漠剪影', 'Desktop bobblehead': '桌面摇头公仔',
  'Fantasy forest': '奇幻森林', 'Fantasy landscape': '奇幻景观', 'Five beat-synced environments': '五个节拍同步场景',
  'Futuristic cabin': '未来舱室', Interior: '室内', 'Japanese street': '日本街道', 'Living-room dialogue': '客厅对白',
  'Long-form character sequence': '长篇角色片段', 'Magical girl transformation': '魔法少女变身', 'Modern interior': '现代室内',
  'On-screen title': '画面内标题', 'One-eyed crowd': '独眼人群', 'Portrait performance': '肖像表演', 'Rainy street': '雨中街道',
  'Singer close-up': '歌手特写', 'Single-character dialogue': '单角色对白', 'Sitcom living room': '情景喜剧客厅',
  'Sitcom-style street scene': '情景喜剧式街景', 'Slice of life': '日常生活', 'Space-cruise cabin': '太空邮轮舱室',
  'Stage performance': '舞台表演', 'Subway carriage': '地铁车厢', 'Surreal landscape': '超现实景观',
  'Thirty-shot character montage': '30 镜头角色蒙太奇', 'Timed two-character entrance': '双角色定时登场',
  'Two-character dialogue': '双角色对白', 'Two-character performance': '双角色表演', 'White studio background': '白色影棚背景',
  'Window view': '窗外景色',
  'Altar awakening': '祭坛苏醒', 'Arena face-off': '竞技场对峙',
  'Background and two-character reference test': '背景与双角色参考测试', 'Character beauty test': '角色美感测试',
  'Character introduction': '角色介绍', 'Close-quarters combat': '近身战斗', 'Combat sequence': '战斗段落',
  'Cute character vignette': '可爱角色小品', 'Daily stretching routine': '日常拉伸', "Father's Day greeting": '父亲节祝福',
  'Female android sequence': '女性仿生人片段', 'Five-second local speed test': '五秒本地速度测试',
  'Girl eye-contact moment': '少女对视瞬间', 'Henri and Colette story': '亨利与科莱特的故事',
  'Live-action composite test': '真人合成测试', 'Local H3 generation test': 'H3 本地生成测试', 'Local render test': '本地渲染测试',
  'Long-form H3 showcase': 'H3 长视频展示', 'Mecha-style sequence': '机甲风格片段',
  'MiniMax H3 character test': 'MiniMax H3 角色测试', 'MiniMax H3 test clip': 'MiniMax H3 测试片段',
  'Multi-shot short film': '多镜头短片', 'NIKKE character clip': 'NIKKE 角色片段', 'Pufferfish art vignette': '河豚艺术小品',
  'Reference-video connection test': '参考视频衔接测试', "Rino's territory": 'Rino 的领地', 'Short-film preview': '短片预览',
  'Sunday-night song vignette': '周日晚间歌曲小品', 'Theme-park-style ride sequence': '主题乐园乘骑片段',
  'Thirty-second multi-reference animation': '30 秒多参考动画', 'Three-clip chained generation': '三片段链式生成',
  'Touhou-style game sequence': '东方风格游戏片段', 'Two fighter entrances': '两名格斗者登场',
  'Two-character encounter': '双角色相遇', 'Weekend-story promotion': '周末故事宣传片',
  'Workflow comparison clip': '工作流对比片段', 'Wrestler and agent walk': '摔角手与经纪人行走',
  '1950s Advertisement': '1950 年代广告', '3D Interface': '三维界面', '3D Workflow': '三维工作流', 'A/B Test': 'A/B 测试',
  'Action Camera': '运动相机', 'Action Test': '动作测试', 'Animal Character': '动物角色', Arcade: '街机',
  'Automated Workflow': '自动化工作流', 'Band Performance': '乐队表演', Beach: '海滩', Benchmark: '性能测试',
  'Camera Test': '运镜测试', 'Character Crossover': '角色联动', 'Character Scene': '角色场景', 'Cinematic Demo': '电影感演示',
  Combat: '战斗', 'Consistency Test': '一致性测试', 'Continuity Test': '连续性测试', 'Continuous Generation': '连续生成',
  Demonstration: '演示', 'Dialogue Scene': '对白场景', 'Digital Art': '数字艺术', Dracula: '德古拉', Driving: '驾驶',
  'Face Close-Up': '面部特写', Festival: '节庆', Fog: '雾景', 'Frame Interpolation': '帧插值', 'Full-Body Shot': '全身镜头',
  'Futuristic City': '未来都市', 'Hotel Room': '酒店房间', 'Image Animation': '图片动画', Inpainting: '局部重绘',
  Jungle: '丛林', 'Landscape Art': '风景画', 'Long Generation': '长时生成', 'Long Take': '长镜头', 'Long Video': '长视频',
  'Meme Video': '梗视频', 'Memory Test': '内存测试', Montage: '蒙太奇', 'Moonlit Night': '月夜', 'Motion Capture': '动作捕捉',
  Motorcycle: '摩托车', 'Mountain Pass': '山路', 'Multi-Character Test': '多角色测试', 'Music Performance': '音乐表演',
  'Music Sequence': '音乐段落', 'Neon City': '霓虹都市', 'Panic Scene': '惊慌场景', Performance: '表演',
  'Performance Test': '性能测试', 'Portrait Character': '肖像角色', 'Presentation Board': '展示板', 'Prompt Reproduction': '提示词复现',
  'Prompt Test': '提示词测试', 'Propaganda Poster': '宣传海报', 'Quantization Test': '量化测试', 'Reference Swap': '参考替换',
  'Scripted Scene': '剧本场景', 'Segmented Processing': '分段处理', 'Setup Test': '环境搭建测试', 'Shaved Ice': '刨冰',
  'Short Film': '短片', 'Short-Form Ad': '短视频广告', 'Single-Character Test': '单角色测试', 'Space Battle': '太空战',
  'Speed Benchmark': '速度测试', 'Street Dance': '街舞', Supermarket: '超市', 'Talking Character': '说话角色',
  'Title Sequence': '片头标题', Transformation: '变身', Tunnel: '隧道', 'Two-Character Dialogue': '双角色对白',
  'Two-Character Scene': '双角色场景', Upscaling: '超分辨率', 'Vehicle Chase': '车辆追逐', 'Video Editing': '视频编辑',
  'Video Extension': '视频续接', 'Workflow Learning': '工作流学习', 'Workflow Test': '工作流测试',
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
