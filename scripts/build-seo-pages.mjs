import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const baseUrl = (process.env.PUBLIC_SITE_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const tutorials = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))

const locales = ['zh-CN', 'en']
const latestPublishedDate = cases
  .map((item) => item.approvedAt ?? item.publishedAt)
  .filter(Boolean)
  .sort()
  .at(-1)
  ?.slice(0, 10)

const faqItems = {
  'zh-CN': [
    ['这个项目收录什么？', '收录带原始来源、可在站内观看的 MiniMax H3 视频案例。'],
    ['为什么有些案例没有 Prompt？', '只有原帖逐字公开完整 Prompt 时才展示；未公开时不会反推、补写或改写。'],
    ['视频如何播放？', '案例视频通过项目存储在站内播放，并始终保留 X 原帖入口。'],
    ['候选案例会自动发布吗？', '来源、模型、媒体、存储和站内播放校验全部通过的明确案例可以直接发布；模糊项继续留在审核队列。'],
    ['如何请求纠错或移除？', '请在 GitHub 提交 Issue，并附上原帖或权利证明。'],
  ],
  en: [
    ['What does this project collect?', 'Source-attributed MiniMax H3 video examples that can be watched inside the library.'],
    ['Why do some examples have no prompt?', 'A prompt appears only when the original post publishes the complete text. Missing prompts are never inferred, completed, or rewritten.'],
    ['How are videos played?', 'Case videos play in-site through project storage and always retain a link to the original X post.'],
    ['Are discovered examples published automatically?', 'Clear examples can be published after source, model, media, storage, and in-site playback checks pass; ambiguous items stay in the review queue.'],
    ['How can a creator request a correction or removal?', 'Open a GitHub Issue and include the original post or proof of ownership.'],
  ],
}

const pageDefinitions = [
  {
    id: 'catalog',
    paths: { 'zh-CN': '/', en: '/en/' },
    schemaType: 'CollectionPage',
    copy: {
      'zh-CN': {
        title: 'MiniMax H3 视频案例与公开 Prompt — H3 Field Notes',
        description: `MiniMax H3 视频案例库：收录 ${cases.length} 个可筛选、可追溯、可站内观看的真实案例，覆盖 Hailuo H3、文字生视频、图生视频与视频生视频；Prompt 仅按来源公开原文呈现。`,
        keywords: 'MiniMax H3,MiniMax H3 视频案例,MiniMax H3 Prompt,Hailuo H3,Hailuo 3.0,海螺 H3,海螺 3.0,海螺 AI,AI 视频生成,text-to-video,image-to-video,video-to-video,H3 ComfyUI,T2VA,FL2VA,Ref2VA',
      },
      en: {
        title: 'MiniMax H3 Video Examples & Public Prompts — H3 Field Notes',
        description: `Browse ${cases.length} source-attributed MiniMax H3 video examples with in-site playback across text-to-video, image-to-video, and video-to-video. Prompts appear only when sources publish the complete text.`,
        keywords: 'MiniMax H3,MiniMax H3 video examples,MiniMax H3 prompts,Hailuo H3,Hailuo 3.0,AI video generation,text-to-video,image-to-video,video-to-video,MiniMax H3 ComfyUI,T2VA,FL2VA,Ref2VA',
      },
    },
  },
  {
    id: 'tutorials',
    paths: { 'zh-CN': '/tutorials/', en: '/en/tutorials/' },
    schemaType: 'CollectionPage',
    copy: {
      'zh-CN': {
        title: 'MiniMax H3 教程与工具：部署、工作流、加速、训练 — H3 Field Notes',
        description: 'MiniMax H3 生态教程入口：官方部署、Apple Silicon 原生推理、ComfyUI 导演工作流、Turbo 加速、长视频、音频、微调训练与资源导航。',
        keywords: 'MiniMax H3 教程,MiniMax H3 Mac,h3.c,MiniMax H3 部署,ComfyUI H3,H3 Director,MiniMax H3 Turbo,H3 Motion Context,H3 Audio,MiniMax H3 微调',
      },
      en: {
        title: 'MiniMax H3 Tutorials and Tools: Setup, Workflows, Speed, Training — H3 Field Notes',
        description: 'A practical MiniMax H3 ecosystem guide for official setup, native Apple Silicon inference, ComfyUI director workflows, Turbo acceleration, long video, audio, fine-tuning, and resource maps.',
        keywords: 'MiniMax H3 tutorials,MiniMax H3 Mac,h3.c,MiniMax H3 deployment,ComfyUI H3,H3 Director,MiniMax H3 Turbo,H3 Motion Context,H3 Audio,MiniMax H3 fine-tuning',
      },
    },
  },
  {
    id: 'faq',
    paths: { 'zh-CN': '/faq/', en: '/en/faq/' },
    schemaType: 'FAQPage',
    copy: {
      'zh-CN': {
        title: 'MiniMax H3 视频案例库常见问题 — H3 Field Notes',
        description: '关于 MiniMax H3 视频案例来源、公开 Prompt 边界与人工审核流程的常见问题。',
        keywords: 'MiniMax H3 常见问题,Hailuo 3.0,海螺 3.0,T2VA,FL2VA,Ref2VA,AI 视频案例',
      },
      en: {
        title: 'MiniMax H3 Video Library FAQ — H3 Field Notes',
        description: 'Frequently asked questions about MiniMax H3 video sources, published-prompt boundaries, and human review.',
        keywords: 'MiniMax H3 FAQ,Hailuo 3.0,T2VA,FL2VA,Ref2VA,AI video examples',
      },
    },
  },
]

const ui = {
  'zh-CN': {
    back: '返回 H3 Field Notes 案例库',
    language: 'EN',
    playerLabel: 'X 原帖播放器',
    playerProvider: '媒体由 X 提供',
    coverAlt: '视频封面',
    embedLink: '载入 X 原帖视频',
    connectingLabel: '连接中',
    connectingTitle: '正在连接 X 播放器',
    connectingDetail: '视频封面已就绪，播放器通常会在 2–8 秒内出现。',
    slowLabel: '响应较慢',
    slowTitle: 'X 响应较慢，仍在加载',
    slowDetail: '网络或隐私设置可能延迟播放器；你可以继续等待。',
    failedLabel: '载入失败',
    failedTitle: '播放器加载失败',
    failedDetail: '请重新加载，或直接在 X 打开原帖。',
    retry: '重新加载',
    fallback: '播放器受限时在 X 打开原帖',
    mode: '生成模式',
    model: '模型',
    output: '输出',
    tags: '标签',
    provenance: '提示词来源',
    promptHeading: '原始 Prompt',
    promptNotice: '以下为来源公开的原文 Prompt，未翻译、改写或补全。',
    promptUnavailableTitle: '来源未公开 Prompt',
    promptUnavailableDetail: '本页仅展示视频和可核对的公开信息；不根据视频反推或补写 Prompt。',
    source: '查看原始来源',
    siteDescription: 'MiniMax H3 视频案例库',
  },
  en: {
    back: 'Back to the H3 Field Notes case library',
    language: 'ZH',
    playerLabel: 'Original X post player',
    playerProvider: 'Media provided by X',
    coverAlt: 'video cover',
    embedLink: 'Load the original X post video',
    connectingLabel: 'CONNECTING',
    connectingTitle: 'Connecting to the X player',
    connectingDetail: 'The video cover is ready. The player usually appears within 2–8 seconds.',
    slowLabel: 'SLOW RESPONSE',
    slowTitle: 'X is responding slowly',
    slowDetail: 'Network or privacy settings may delay the player. You can keep waiting.',
    failedLabel: 'LOAD FAILED',
    failedTitle: 'The player failed to load',
    failedDetail: 'Reload the page or open the original post on X.',
    retry: 'Reload',
    fallback: 'Open the original post on X if the player is unavailable',
    mode: 'Generation mode',
    model: 'Model',
    output: 'Output',
    tags: 'Tags',
    provenance: 'Prompt provenance',
    promptHeading: 'Original Prompt',
    promptNotice: 'Verbatim prompt as published by the source; not translated, rewritten, or completed.',
    promptUnavailableTitle: 'Prompt not published by the source',
    promptUnavailableDetail: 'This page only shows the video and verifiable public information. It does not infer or complete a prompt from the video.',
    source: 'View original source',
    siteDescription: 'MiniMax H3 video case library',
  },
}

const provenanceLabels = {
  'zh-CN': {
    'official-verbatim': '官方原文',
    'creator-verbatim': '创作者原文',
    'not-published': '来源未公开',
  },
  en: {
    'official-verbatim': 'Official, verbatim',
    'creator-verbatim': 'Creator, verbatim',
    'not-published': 'Not published by the source',
  },
}

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const jsonForHtml = (value) => JSON.stringify(value).replaceAll('<', '\\u003c')
const absolute = (url) => new URL(url, `${baseUrl}/`).href
const isoDuration = (seconds) => `PT${seconds}S`
const localeCode = (locale) => locale === 'en' ? 'en_US' : 'zh_CN'
const otherLocale = (locale) => locale === 'en' ? 'zh-CN' : 'en'
const casePath = (locale, id) => `${locale === 'en' ? '/en' : ''}/cases/${encodeURIComponent(id)}/`
const compactWhitespace = (value) => String(value).replace(/\s+/g, ' ').trim()
const truncateMeta = (value, maxLength = 155) => {
  const normalized = compactWhitespace(value)
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).replace(/\s+\S*$/, '') || normalized.slice(0, maxLength - 1)}…`
}

function assertLanguageIsolation(html, locale, path) {
  const interfaceOnly = html.replace(/<pre data-verbatim-prompt>[\s\S]*?<\/pre>/g, '')
  if (locale === 'en' && /[\u3400-\u9fff]/u.test(interfaceOnly)) {
    throw new Error(`English page ${path} contains CJK text; refusing to generate a mixed-language route.`)
  }
}

function englishModel(model) {
  return model
    .replaceAll('（创作者标注）', ' (creator-labeled)')
    .replace(/^MiniMax H3 与 (.+) 对比$/, 'MiniMax H3 vs $1')
    .replaceAll(' 与 ', ' vs ')
}

function englishSourceLabel(item) {
  if (item.sourceType === 'official') return 'MiniMax official reproduction script'
  const handle = item.sourceUrl.match(/x\.com\/([^/]+)\/status/i)?.[1]
  if (handle) return `Original X post · @${handle}`
  return 'Original community source'
}

function englishAuthor(item) {
  if (!/[\u3400-\u9fff]/u.test(item.author)) return item.author
  const handle = item.sourceUrl.match(/x\.com\/([^/]+)\/status/i)?.[1]
  return handle ? `@${handle}` : 'Community creator'
}

function englishOutputValue(value) {
  if (value === '原帖') return 'As shown in the original post'
  if (value === '原帖未标注') return 'Not specified in the original post'
  return value
}

function localizedCase(item, locale) {
  if (locale === 'zh-CN') {
    return {
      title: item.title,
      summary: item.summary,
      prompt: item.prompt,
      author: item.author,
      model: item.model,
      sourceLabel: item.sourceLabel,
      resolution: item.resolution,
      aspectRatio: item.aspectRatio,
      tags: item.tags,
    }
  }

  if (!item.summaryEn) {
    throw new Error(`Case ${item.id} is missing summaryEn; refusing to generate a mixed-language English page.`)
  }

  return {
    title: item.titleEn,
    summary: item.summaryEn,
    prompt: item.prompt,
    author: englishAuthor(item),
    model: englishModel(item.model),
    sourceLabel: englishSourceLabel(item),
    resolution: englishOutputValue(item.resolution),
    aspectRatio: englishOutputValue(item.aspectRatio),
    tags: [...new Set([item.category, ...item.styles, ...item.scenes])],
  }
}

function alternateHeadLinks(paths) {
  return `  <link rel="alternate" hreflang="zh-CN" href="${absolute(paths['zh-CN'])}" />
  <link rel="alternate" hreflang="en" href="${absolute(paths.en)}" />
  <link rel="alternate" hreflang="x-default" href="${absolute(paths['zh-CN'])}" />`
}

function alternateSitemapLinks(paths) {
  return `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${escapeHtml(absolute(paths['zh-CN']))}" />
    <xhtml:link rel="alternate" hreflang="en" href="${escapeHtml(absolute(paths.en))}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(absolute(paths['zh-CN']))}" />`
}

function appStructuredData(page, locale) {
  const canonical = absolute(page.paths[locale])
  const copy = page.copy[locale]
  const websiteId = `${baseUrl}/#website`
  const pageNode = {
    '@type': page.schemaType,
    '@id': `${canonical}#page`,
    name: copy.title,
    description: copy.description,
    url: canonical,
    inLanguage: locale,
    isPartOf: { '@id': websiteId },
    about: ['MiniMax H3', 'Hailuo H3', 'Hailuo 3.0', 'AI video generation'],
  }

  if (page.id === 'catalog') {
    pageNode.numberOfItems = cases.length
    pageNode.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: cases.length,
      itemListElement: cases.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: localizedCase(item, locale).title,
        url: absolute(casePath(locale, item.id)),
      })),
    }
  }

  if (page.id === 'tutorials') {
    pageNode.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: tutorials.length,
      itemListElement: tutorials.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        description: locale === 'en' ? item.description.en : item.description.zh,
        url: item.url,
      })),
    }
  }

  if (page.id === 'faq') {
    pageNode.mainEntity = faqItems[locale].map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    }))
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: 'H3 Field Notes',
        alternateName: 'Awesome MiniMax H3',
        url: `${baseUrl}/`,
        inLanguage: ['zh-CN', 'en'],
      },
      pageNode,
    ],
  }
}

function fallbackMarkup(page, locale) {
  const copy = page.copy[locale]
  const languageLink = page.paths[otherLocale(locale)]
  const languageLabel = locale === 'en' ? 'ZH' : 'English'
  let content

  if (page.id === 'catalog') {
    const links = cases.map((item) => {
      const localized = localizedCase(item, locale)
      return `<li><a href="${casePath(locale, item.id)}">${escapeHtml(localized.title)}</a><small>${escapeHtml(item.mode)} · ${escapeHtml(localized.author)}</small></li>`
    }).join('')
    content = `<p><strong>${cases.length}</strong> ${escapeHtml(locale === 'en' ? 'published video examples' : '个已发布视频案例')}</p><ol>${links}</ol>`
  } else if (page.id === 'tutorials') {
    content = `<ol>${tutorials.map((item) => {
      const description = locale === 'en' ? item.description.en : item.description.zh
      const steps = locale === 'en' ? item.steps.en : item.steps.zh
      return `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a><p>${escapeHtml(description)}</p><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></li>`
    }).join('')}</ol>`
  } else {
    content = faqItems[locale].map(([question, answer]) => `<article><h2>${escapeHtml(question)}</h2><p>${escapeHtml(answer)}</p></article>`).join('')
  }

  return `<main class="seo-fallback"><nav><a href="${escapeHtml(languageLink)}" hreflang="${otherLocale(locale)}">${escapeHtml(languageLabel)}</a></nav><h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.description)}</p>${content}</main>`
}

function renderAppShell(page, locale, assetTags) {
  const copy = page.copy[locale]
  const description = truncateMeta(copy.description)
  const canonical = absolute(page.paths[locale])
  const alternateOgLocale = localeCode(otherLocale(locale))
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0b09" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(copy.keywords)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1" />
    <link rel="canonical" href="${canonical}" />
${alternateHeadLinks(page.paths)}
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="H3 Field Notes" />
    <meta property="og:locale" content="${localeCode(locale)}" />
    <meta property="og:locale:alternate" content="${alternateOgLocale}" />
    <meta property="og:title" content="${escapeHtml(copy.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${baseUrl}/og-image.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(copy.title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(copy.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${baseUrl}/og-image.jpg" />
    <meta name="twitter:image:alt" content="${escapeHtml(copy.title)}" />
    <script type="application/ld+json">${jsonForHtml(appStructuredData(page, locale))}</script>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%230a0b09'/%3E%3Cpath d='M14 16h8v12h20V16h8v32h-8V36H22v12h-8z' fill='%23d8ff3e'/%3E%3C/svg%3E" />
    <title>${escapeHtml(copy.title)}</title>
    <style>.seo-fallback{max-width:1080px;margin:auto;padding:40px 20px 80px;font:16px/1.6 system-ui,sans-serif}.seo-fallback nav{text-align:right}.seo-fallback h1{max-width:900px;font-size:clamp(2.2rem,7vw,5rem);line-height:1}.seo-fallback ol{columns:2;gap:32px;padding-left:1.5rem}.seo-fallback li{break-inside:avoid;margin:.65rem 0}.seo-fallback li small{display:block;color:#666}@media(max-width:720px){.seo-fallback ol{columns:1}}</style>
${assetTags.map((tag) => `    ${tag}`).join('\n')}
  </head>
  <body>
    <div id="root">${fallbackMarkup(page, locale)}</div>
    <noscript>${escapeHtml(locale === 'en' ? 'JavaScript is required to browse this video library.' : '浏览此视频案例库需要启用 JavaScript。')}</noscript>
  </body>
</html>
`
}

const casePageStyle = `body{margin:0;background:#0a0b09;color:#f5f5ed;font:16px/1.65 Inter,system-ui,sans-serif}main{max-width:980px;margin:auto;padding:36px 20px 80px}a{color:#d8ff3e}.case-nav{display:flex;justify-content:space-between;gap:20px;margin-bottom:1rem}.eyebrow{color:#d8ff3e;letter-spacing:.12em;text-transform:uppercase}h1{font-size:clamp(2rem,7vw,5rem);line-height:1;margin:.25em 0}.summary{font-size:1.2rem;color:#c7c9bd}.prompt-notice{color:#929689;font-size:.88rem}video{display:block;width:100%;max-height:70vh;background:#000;border:1px solid #34362e}.x-embed{min-height:560px;margin:28px 0;padding:22px;display:flex;gap:12px;flex-direction:column;align-items:center;justify-content:center;background-color:#050605;background-image:linear-gradient(rgba(216,255,62,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(216,255,62,.035) 1px,transparent 1px);background-size:32px 32px;border:1px solid #34362e}.embed-label{width:100%;max-width:550px;display:flex;justify-content:space-between;color:#d8ff3e;font:11px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.embed-label small{color:#929689}.embed-stage{position:relative;width:100%;max-width:550px;min-height:460px;display:grid;place-items:center;overflow:hidden;background:#0a0c09;border:1px solid #30342c}.embed-stage:after{content:'';position:absolute;z-index:2;top:0;left:0;right:0;height:1px;background:#d8ff3e;box-shadow:0 0 18px rgba(216,255,62,.85);animation:scan 2.4s ease-in-out infinite}.embed-poster,.embed-scrim{position:absolute;inset:0;width:100%;height:100%;transition:opacity .3s,visibility .3s}.embed-poster{object-fit:cover;filter:saturate(.82) contrast(1.08)}.embed-scrim{z-index:1;background:linear-gradient(180deg,rgba(5,6,5,.18),rgba(5,6,5,.8)),repeating-linear-gradient(0deg,transparent 0 3px,rgba(216,255,62,.045) 3px 4px)}.embed-target{position:relative;z-index:3;width:100%;min-height:460px;display:grid;place-items:center;opacity:0}.twitter-tweet{width:100%;min-height:460px;display:grid;place-items:center;margin:0 auto!important}.embed-status{position:absolute;z-index:4;inset:0;padding:38px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;gap:18px;text-shadow:0 2px 18px #000}.embed-loader{width:48px;height:48px;border:1px solid rgba(216,255,62,.4);background:rgba(7,8,6,.55)}.embed-loader:after{content:'';display:block;width:20px;height:20px;margin:13px;border:3px solid #d8ff3e;border-right-color:transparent;border-radius:50%;animation:spin 1.1s linear infinite}.embed-copy{max-width:430px;display:flex;flex-direction:column;gap:5px}.embed-copy small{color:#d8ff3e;font:9px ui-monospace,monospace;letter-spacing:.16em}.embed-copy strong{font-size:25px;line-height:1.2}.embed-copy em{color:#d0d2c8;font:normal 10px/1.65 ui-monospace,monospace}.embed-retry{display:none;padding:9px 12px;color:#090a08;background:#d8ff3e;border:0;font:10px ui-monospace,monospace;cursor:pointer}.x-embed[data-state=slow] .embed-stage:after{background:#ffd166;box-shadow:0 0 18px rgba(255,209,102,.78);animation-duration:3.4s}.x-embed[data-state=slow] .embed-copy small{color:#ffd166}.x-embed[data-state=error] .embed-stage:after,.x-embed[data-state=error] .embed-loader{display:none}.x-embed[data-state=error] .embed-copy small{color:#ff806f}.x-embed[data-state=error] .embed-retry{display:block}.x-embed[data-state=ready] .embed-poster,.x-embed[data-state=ready] .embed-scrim,.x-embed[data-state=ready] .embed-status,.x-embed[data-state=ready] .embed-stage:after{opacity:0;visibility:hidden}.x-embed[data-state=ready] .embed-target{opacity:1}.embed-fallback{margin:0;font:11px ui-monospace,monospace}dl{display:grid;grid-template-columns:max-content 1fr;gap:.5rem 1.25rem;margin:2rem 0}dt{color:#929689}dd{margin:0}pre{white-space:pre-wrap;background:#151712;border:1px solid #34362e;padding:20px;overflow:auto}@keyframes spin{to{transform:rotate(360deg)}}@keyframes scan{0%,100%{transform:translateY(0)}50%{transform:translateY(459px)}}@media(max-width:620px){.x-embed{padding:12px}.embed-stage,.embed-target,.twitter-tweet{min-height:410px}.embed-status{padding:24px}dl{grid-template-columns:1fr;gap:.1rem}dd{margin-bottom:.75rem}}@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;animation-iteration-count:1!important}}`

const hostedCaseVideoStyle = `.video-frame{position:relative;margin:28px 0}.video-source{position:absolute;z-index:2;top:14px;right:14px;width:42px;height:42px;display:grid;place-items:center;color:#f5f5ed;background:rgba(7,8,6,.78);border:1px solid rgba(245,245,237,.3);border-radius:50%;backdrop-filter:blur(12px);transition:transform .18s,background .18s,color .18s}.video-source:hover{color:#090a08;background:#d8ff3e;transform:translateY(-2px)}.video-source svg{width:17px;height:17px;fill:currentColor}`

function renderXEmbed(item, copy, labels, poster) {
  const stateText = {
    slow: [labels.slowLabel, labels.slowTitle, labels.slowDetail],
    error: [labels.failedLabel, labels.failedTitle, labels.failedDetail],
  }
  const markup = `<section class="x-embed" data-state="loading" aria-busy="true" aria-label="${escapeHtml(`${copy.title} · ${labels.playerLabel}`)}"><div class="embed-label"><span>${escapeHtml(labels.playerLabel)}</span><small>${escapeHtml(labels.playerProvider)}</small></div><div class="embed-stage"><img class="embed-poster" src="${escapeHtml(poster)}" alt="${escapeHtml(`${copy.title} · ${labels.coverAlt}`)}"><span class="embed-scrim" aria-hidden="true"></span><div class="embed-target"><blockquote class="twitter-tweet" data-theme="dark" data-dnt="true" data-conversation="none"><a href="${escapeHtml(item.sourceUrl)}">${escapeHtml(labels.embedLink)}</a></blockquote></div><div class="embed-status" role="status" aria-live="polite"><span class="embed-loader" aria-hidden="true"></span><span class="embed-copy"><small>${escapeHtml(labels.connectingLabel)}</small><strong>${escapeHtml(labels.connectingTitle)}</strong><em>${escapeHtml(labels.connectingDetail)}</em></span><button class="embed-retry" type="button">${escapeHtml(labels.retry)}</button></div></div><p class="embed-fallback"><a href="${escapeHtml(item.sourceUrl)}" rel="nofollow noopener">${escapeHtml(labels.fallback)} ↗</a></p></section>`
  const script = `<script>(()=>{const root=document.querySelector('.x-embed');const copy=root.querySelector('.embed-copy');const status=root.querySelector('.embed-status');const retry=root.querySelector('.embed-retry');const states=${jsonForHtml(stateText)};let done=false;const setState=(state)=>{if(done)return;const [label,title,detail]=states[state];root.dataset.state=state;root.setAttribute('aria-busy',String(state!=='error'));status.setAttribute('role',state==='error'?'alert':'status');status.setAttribute('aria-live',state==='error'?'assertive':'polite');copy.querySelector('small').textContent=label;copy.querySelector('strong').textContent=title;copy.querySelector('em').textContent=detail};const ready=()=>{if(!root.querySelector('iframe'))return false;done=true;clearTimeout(slowTimer);clearTimeout(failTimer);root.dataset.state='ready';root.setAttribute('aria-busy','false');observer.disconnect();return true};const observer=new MutationObserver(ready);observer.observe(root,{childList:true,subtree:true});const slowTimer=setTimeout(()=>setState('slow'),6000);const failTimer=setTimeout(()=>setState('error'),20000);retry.addEventListener('click',()=>location.reload());ready()})()</script>`
  return { markup, script }
}

function renderCasePage(item, locale) {
  const copy = localizedCase(item, locale)
  const labels = ui[locale]
  const canonical = absolute(casePath(locale, item.id))
  const paths = {
    'zh-CN': casePath('zh-CN', item.id),
    en: casePath('en', item.id),
  }
  const alternate = absolute(paths[otherLocale(locale)])
  const poster = absolute(item.posterUrl)
  const hasHostedVideo = Boolean(item.mediaUrl)
  const description = truncateMeta(copy.summary)
  const keywords = [
    'MiniMax H3', 'Hailuo 3.0', 'AI video generation',
    item.mode, item.category, ...copy.tags,
    item.promptProvenance === 'not-published' ? 'source-attributed video example' : 'public MiniMax H3 prompt',
  ].join(', ')
  const videoObject = {
    '@type': 'VideoObject',
    '@id': `${canonical}#video`,
    name: copy.title,
    description: copy.summary,
    thumbnailUrl: [poster],
    uploadDate: item.publishedAt,
    duration: isoDuration(item.duration),
    embedUrl: canonical,
    creator: { '@type': item.sourceType === 'official' ? 'Organization' : 'Person', name: copy.author },
    inLanguage: locale,
    isFamilyFriendly: true,
    keywords,
    isBasedOn: item.sourceUrl,
    sameAs: item.sourceUrl,
    ...(hasHostedVideo ? { contentUrl: absolute(item.mediaUrl) } : {}),
  }
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      videoObject,
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: labels.siteDescription, item: absolute(locale === 'en' ? '/en/' : '/') },
          { '@type': 'ListItem', position: 2, name: copy.title, item: canonical },
        ],
      },
    ],
  }
  const videoMeta = hasHostedVideo
    ? `  <meta property="og:video" content="${escapeHtml(absolute(item.mediaUrl))}" />
  <meta property="og:video:type" content="video/mp4" />`
    : ''
  const embedded = hasHostedVideo ? null : renderXEmbed(item, copy, labels, poster)
  const xSourceIcon = item.sourceType === 'x'
    ? `<a class="video-source" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="nofollow noopener noreferrer" aria-label="${escapeHtml(locale === 'en' ? 'Open original post on X' : '在 X 打开原帖')}" title="${escapeHtml(locale === 'en' ? 'Open original post on X' : '在 X 打开原帖')}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg></a>`
    : ''
  const mediaMarkup = hasHostedVideo
    ? `<div class="video-frame"><video controls playsinline preload="metadata" poster="${escapeHtml(poster)}" src="${escapeHtml(item.mediaUrl)}"></video>${xSourceIcon}</div>`
    : embedded.markup
  const provenance = provenanceLabels[locale][item.promptProvenance] ?? item.promptProvenance
  const hasPrompt = typeof copy.prompt === 'string' && copy.prompt.trim().length > 0
  const promptMarkup = hasPrompt
    ? `<h2>${escapeHtml(labels.promptHeading)}</h2>
  <p class="prompt-notice">${escapeHtml(labels.promptNotice)}</p>
  <pre data-verbatim-prompt>${escapeHtml(copy.prompt)}</pre>`
    : `<p class="prompt-notice prompt-unavailable"><strong>${escapeHtml(labels.promptUnavailableTitle)}</strong><br>${escapeHtml(labels.promptUnavailableDetail)}</p>`
  const localeTitleSuffix = locale === 'en'
    ? 'MiniMax H3 video example'
    : 'MiniMax H3 视频案例'
  const documentTitle = truncateMeta(`${copy.title} — ${localeTitleSuffix}`, 62)

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1" />
  <link rel="canonical" href="${canonical}" />
${alternateHeadLinks(paths)}
  <meta property="og:type" content="video.other" />
  <meta property="og:site_name" content="H3 Field Notes" />
  <meta property="og:locale" content="${localeCode(locale)}" />
  <meta property="og:locale:alternate" content="${localeCode(otherLocale(locale))}" />
  <meta property="og:title" content="${escapeHtml(`${copy.title} — MiniMax H3`)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${escapeHtml(poster)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="${escapeHtml(`${copy.title} — ${labels.coverAlt}`)}" />
${videoMeta}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(`${copy.title} — MiniMax H3`)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(poster)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(`${copy.title} — ${labels.coverAlt}`)}" />
  <script type="application/ld+json">${jsonForHtml(structuredData)}</script>
  <style>${casePageStyle}${hostedCaseVideoStyle}</style>
  ${hasHostedVideo ? '' : '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>'}
</head>
<body><main>
  <nav class="case-nav" aria-label="${escapeHtml(locale === 'en' ? 'Case navigation' : '案例导航')}"><a href="${absolute(locale === 'en' ? '/en/' : '/')}">← ${escapeHtml(labels.back)}</a><a href="${alternate}" hreflang="${otherLocale(locale)}">${escapeHtml(labels.language)}</a></nav>
  <p class="eyebrow">MiniMax H3 / Hailuo 3.0 · ${escapeHtml(item.mode)}</p>
  <h1>${escapeHtml(copy.title)}</h1>
  <p class="summary">${escapeHtml(copy.summary)}</p>
  ${mediaMarkup}
  <dl><dt>${escapeHtml(labels.mode)}</dt><dd>${escapeHtml(item.mode)}</dd><dt>${escapeHtml(labels.model)}</dt><dd>${escapeHtml(copy.model)}</dd><dt>${escapeHtml(labels.output)}</dt><dd>${item.duration}s · ${escapeHtml(copy.resolution)} · ${escapeHtml(copy.aspectRatio)}</dd><dt>${escapeHtml(labels.tags)}</dt><dd>${escapeHtml(copy.tags.join(' · '))}</dd><dt>${escapeHtml(labels.provenance)}</dt><dd>${escapeHtml(provenance)}</dd></dl>
  ${promptMarkup}
  <p><a href="${escapeHtml(item.sourceUrl)}" rel="nofollow noopener">${escapeHtml(labels.source)} · ${escapeHtml(copy.sourceLabel)}</a></p>
</main>${embedded?.script ?? ''}</body></html>`
}

function extractAssetTags(builtIndex) {
  const links = builtIndex.match(/<link\b[^>]*\bhref="\/assets\/[^"]+"[^>]*>/g) ?? []
  const scripts = builtIndex.match(/<script\b[^>]*\bsrc="\/assets\/[^"]+"[^>]*><\/script>/g) ?? []
  if (scripts.length === 0) {
    throw new Error('Could not find the Vite application entry in dist/index.html. Run vite build before the SEO generator.')
  }
  return [...new Set([...links, ...scripts])]
}

const builtIndex = await readFile(resolve(dist, 'index.html'), 'utf8')
const assetTags = extractAssetTags(builtIndex)

for (const page of pageDefinitions) {
  for (const locale of locales) {
    const relativePath = page.paths[locale].replace(/^\//, '')
    const pageDir = resolve(dist, relativePath)
    const html = renderAppShell(page, locale, assetTags)
    assertLanguageIsolation(html, locale, page.paths[locale])
    await mkdir(pageDir, { recursive: true })
    await writeFile(resolve(pageDir, 'index.html'), html)
  }
}

const legacyTutorialRoutes = [
  { locale: 'zh-CN', from: '/toolkit/', to: '/tutorials/', label: '教程页面已迁移，正在跳转。' },
  { locale: 'en', from: '/en/toolkit/', to: '/en/tutorials/', label: 'The tutorials page has moved. Redirecting.' },
]

for (const route of legacyTutorialRoutes) {
  const target = absolute(route.to)
  const relativePath = route.from.replace(/^\//, '')
  const pageDir = resolve(dist, relativePath)
  const html = `<!doctype html><html lang="${route.locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${escapeHtml(target)}"><title>${escapeHtml(route.label)}</title><script>location.replace(${jsonForHtml(target)})</script></head><body><p>${escapeHtml(route.label)} <a href="${escapeHtml(target)}">${escapeHtml(target)}</a></p></body></html>`
  assertLanguageIsolation(html, route.locale, route.from)
  await mkdir(pageDir, { recursive: true })
  await writeFile(resolve(pageDir, 'index.html'), html)
}

for (const item of cases) {
  for (const locale of locales) {
    const relativePath = casePath(locale, item.id).replace(/^\//, '')
    const pageDir = resolve(dist, relativePath)
    const html = renderCasePage(item, locale)
    assertLanguageIsolation(html, locale, casePath(locale, item.id))
    await mkdir(pageDir, { recursive: true })
    await writeFile(resolve(pageDir, 'index.html'), html)
  }
}

function sitemapPageEntry(page, locale) {
  return `  <url>
    <loc>${escapeHtml(absolute(page.paths[locale]))}</loc>
    <lastmod>${escapeHtml(latestPublishedDate)}</lastmod>
${alternateSitemapLinks(page.paths)}
  </url>`
}

function sitemapCaseEntry(item, locale) {
  const copy = localizedCase(item, locale)
  const paths = {
    'zh-CN': casePath('zh-CN', item.id),
    en: casePath('en', item.id),
  }
  const videoLocation = item.mediaUrl
    ? `<video:content_loc>${escapeHtml(item.mediaUrl)}</video:content_loc>`
    : `<video:player_loc allow_embed="yes">${escapeHtml(absolute(paths[locale]))}</video:player_loc>`
  const video = `
    <video:video>
      <video:thumbnail_loc>${escapeHtml(absolute(item.posterUrl))}</video:thumbnail_loc>
      <video:title>${escapeHtml(`${copy.title} — MiniMax H3`)}</video:title>
      <video:description>${escapeHtml(copy.summary)}</video:description>
      ${videoLocation}
      <video:duration>${item.duration}</video:duration>
      <video:publication_date>${escapeHtml(item.publishedAt)}</video:publication_date>
      <video:uploader info="${escapeHtml(item.sourceUrl)}">${escapeHtml(copy.author)}</video:uploader>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>`
  return `  <url>
    <loc>${escapeHtml(absolute(paths[locale]))}</loc>
    <lastmod>${escapeHtml((item.approvedAt ?? item.publishedAt).slice(0, 10))}</lastmod>
${alternateSitemapLinks(paths)}${video}
  </url>`
}

const sitemapEntries = [
  ...pageDefinitions.flatMap((page) => locales.map((locale) => sitemapPageEntry(page, locale))),
  ...cases.flatMap((item) => locales.map((locale) => sitemapCaseEntry(item, locale))),
].join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries}
</urlset>\n`
await writeFile(resolve(dist, 'sitemap.xml'), sitemap)
await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`)

const notFoundCopy = {
  'zh-CN': ['页面不存在', '这个地址没有对应页面。', '返回案例库'],
  en: ['Page not found', 'There is no page at this address.', 'Back to the case library'],
}
const notFoundHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>404 — H3 Field Notes</title><style>body{margin:0;background:#0a0b09;color:#f5f5ed;font:16px/1.6 system-ui,sans-serif}main{max-width:760px;margin:15vh auto;padding:24px}h1{font-size:clamp(3rem,12vw,8rem);margin:0;color:#d8ff3e}a{color:#d8ff3e}</style></head><body><main><p>404</p><h1>${notFoundCopy['zh-CN'][0]}</h1><p>${notFoundCopy['zh-CN'][1]}</p><p><a href="/">${notFoundCopy['zh-CN'][2]}</a> · <a href="/en/">${notFoundCopy.en[2]}</a></p></main></body></html>`
await writeFile(resolve(dist, '404.html'), notFoundHtml)

console.log(`Generated ${pageDefinitions.length * locales.length} app routes, ${cases.length * locales.length} localized case pages, ${cases.length * locales.length} video sitemap entries, and a strict 404 page for ${baseUrl}.`)
