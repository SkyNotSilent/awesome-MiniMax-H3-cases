import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const baseUrl = (process.env.PUBLIC_SITE_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const absolute = (url) => new URL(url, `${baseUrl}/`).href
const isoDuration = (seconds) => `PT${seconds}S`

for (const item of cases) {
  const canonical = `${baseUrl}/cases/${encodeURIComponent(item.id)}/`
  const poster = absolute(item.posterUrl)
  const hasHostedVideo = Boolean(item.mediaUrl)
  const keywords = [
    'MiniMax H3', 'Hailuo 3.0', 'AI video generation', 'video prompts',
    item.mode, item.category, ...item.tags, ...item.styles, ...item.scenes,
  ].join(', ')
  const structuredData = hasHostedVideo
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: `${item.title} — ${item.titleEn}`,
        description: item.summary,
        thumbnailUrl: [poster],
        uploadDate: item.publishedAt,
        duration: isoDuration(item.duration),
        contentUrl: item.mediaUrl,
        embedUrl: canonical,
        creator: { '@type': 'Organization', name: item.author },
        isFamilyFriendly: true,
        keywords,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${item.title} — MiniMax H3 社区案例`,
        description: item.summary,
        image: [poster],
        datePublished: item.publishedAt,
        author: { '@type': 'Person', name: item.author },
        mainEntityOfPage: canonical,
        citation: item.sourceUrl,
        keywords,
      }
  const videoMeta = hasHostedVideo
    ? `  <meta property="og:video" content="${escapeHtml(item.mediaUrl)}" />
  <meta property="og:video:type" content="video/mp4" />`
    : ''
  const mediaMarkup = hasHostedVideo
    ? `<video controls playsinline preload="metadata" poster="${poster}" src="${escapeHtml(item.mediaUrl)}"></video>`
    : `<section class="x-embed" aria-label="${escapeHtml(item.title)} X 原帖播放器"><div class="embed-label"><span>X 原帖播放器</span><small>媒体由 X 提供</small></div><blockquote class="twitter-tweet" data-theme="dark" data-dnt="true" data-conversation="none"><a href="${escapeHtml(item.sourceUrl)}">载入 ${escapeHtml(item.title)} 的 X 原帖视频</a></blockquote><p class="embed-fallback"><a href="${escapeHtml(item.sourceUrl)}" rel="nofollow noopener">播放器受限时在 X 打开原帖 ↗</a></p></section>`
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(item.title)} — MiniMax H3 / Hailuo 3.0 视频提示词</title>
  <meta name="description" content="${escapeHtml(item.summary)} MiniMax H3 ${escapeHtml(item.mode)} AI 视频案例、提示词记录与原始来源。" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="${hasHostedVideo ? 'video.other' : 'article'}" />
  <meta property="og:site_name" content="H3 Field Notes" />
  <meta property="og:title" content="${escapeHtml(item.title)} — MiniMax H3 视频案例" />
  <meta property="og:description" content="${escapeHtml(item.summary)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${poster}" />
${videoMeta}
  <meta name="twitter:card" content="${hasHostedVideo ? 'player' : 'summary_large_image'}" />
  <meta name="twitter:title" content="${escapeHtml(item.title)} — MiniMax H3" />
  <meta name="twitter:description" content="${escapeHtml(item.summary)}" />
  <meta name="twitter:image" content="${poster}" />
  <script type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>
  <style>body{margin:0;background:#0a0b09;color:#f5f5ed;font:16px/1.65 Inter,system-ui,sans-serif}main{max-width:980px;margin:auto;padding:36px 20px 80px}a{color:#d8ff3e}.eyebrow{color:#d8ff3e;letter-spacing:.12em;text-transform:uppercase}h1{font-size:clamp(2rem,7vw,5rem);line-height:1;margin:.25em 0}.summary{font-size:1.2rem;color:#c7c9bd}video{display:block;width:100%;max-height:70vh;background:#000;border:1px solid #34362e}.x-embed{min-height:560px;margin:28px 0;padding:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;background-color:#050605;background-image:linear-gradient(rgba(216,255,62,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(216,255,62,.035) 1px,transparent 1px);background-size:32px 32px;border:1px solid #34362e}.embed-label{width:100%;max-width:550px;display:flex;justify-content:space-between;color:#d8ff3e;font:11px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.embed-label small{color:#929689}.twitter-tweet{width:100%;min-height:460px;display:grid;place-items:center;margin:14px auto!important}.embed-fallback{margin:0;font:11px ui-monospace,monospace}dl{display:grid;grid-template-columns:max-content 1fr;gap:.5rem 1.25rem;margin:2rem 0}dt{color:#929689}dd{margin:0}pre{white-space:pre-wrap;background:#151712;border:1px solid #34362e;padding:20px;overflow:auto}.back{display:inline-block;margin-bottom:1rem}</style>
  ${hasHostedVideo ? '' : '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>'}
</head>
<body><main>
  <a class="back" href="${baseUrl}/">← H3 Field Notes 案例库</a>
  <p class="eyebrow">MiniMax H3 / Hailuo 3.0 · ${escapeHtml(item.mode)}</p>
  <h1>${escapeHtml(item.title)}</h1>
  <p>${escapeHtml(item.titleEn)}</p>
  <p class="summary">${escapeHtml(item.summary)}</p>
  ${mediaMarkup}
  <dl><dt>生成模式</dt><dd>${escapeHtml(item.mode)}</dd><dt>模型</dt><dd>${escapeHtml(item.model)}</dd><dt>输出</dt><dd>${item.duration}s · ${escapeHtml(item.resolution)} · ${escapeHtml(item.aspectRatio)}</dd><dt>标签</dt><dd>${escapeHtml(item.tags.join(' · '))}</dd><dt>提示词来源</dt><dd>${escapeHtml(item.promptProvenance)}</dd></dl>
  <h2>MiniMax H3 提示词记录</h2>
  <pre>${escapeHtml(item.prompt)}</pre>
  <p><a href="${escapeHtml(item.sourceUrl)}" rel="nofollow noopener">查看原始来源 · ${escapeHtml(item.sourceLabel)}</a></p>
</main></body></html>`
  const pageDir = resolve(dist, 'cases', item.id)
  await mkdir(pageDir, { recursive: true })
  await writeFile(resolve(pageDir, 'index.html'), html)
}

const sitemapEntries = cases.map((item) => item.mediaUrl
  ? `  <url>
    <loc>${baseUrl}/cases/${encodeURIComponent(item.id)}/</loc>
    <video:video>
      <video:thumbnail_loc>${absolute(item.posterUrl)}</video:thumbnail_loc>
      <video:title>${escapeHtml(item.title)} — MiniMax H3</video:title>
      <video:description>${escapeHtml(item.summary)}</video:description>
      <video:content_loc>${escapeHtml(item.mediaUrl)}</video:content_loc>
      <video:duration>${item.duration}</video:duration>
      <video:publication_date>${item.publishedAt}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`
  : `  <url><loc>${baseUrl}/cases/${encodeURIComponent(item.id)}/</loc></url>`).join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url><loc>${baseUrl}/</loc></url>
${sitemapEntries}
</urlset>\n`
await writeFile(resolve(dist, 'sitemap.xml'), sitemap)
await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`)
console.log(`Generated ${cases.length} case pages and a video sitemap for ${baseUrl}.`)
