import { useEffect, useState, type ReactNode } from 'react'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import { loadTutorialOriginal } from './data-client'
import type { Language } from './i18n'
import type { OriginalBlock, OriginalImage, OriginalInline, TutorialGuide, TutorialOriginal } from './types'
import './tutorial-original.css'

type ListItem = { depth: number; inlines: OriginalInline[] }
type ListNode = { inlines: OriginalInline[]; children: ListNode[] }

const KIND_LABELS: Record<Language, Record<TutorialOriginal['kind'], string>> = {
  zh: { 'x-article': 'X 长文', 'x-thread': 'X 帖子', markdown: '文档原文' },
  en: { 'x-article': 'X Article', 'x-thread': 'X post', markdown: 'Source document' },
}
const LANGUAGE_LABELS: Record<Language, Record<TutorialOriginal['language'], string>> = {
  zh: { zh: '中文原文', en: '英文原文', ja: '日文原文', other: '原文' },
  en: { zh: 'Chinese original', en: 'English original', ja: 'Japanese original', other: 'Original language' },
}

function Inlines({ runs, linked = true }: { runs: OriginalInline[]; linked?: boolean }) {
  return <>{runs.map((run, index) => {
    let node: ReactNode = run.t
    if (run.c) node = <code>{node}</code>
    if (run.i) node = <em>{node}</em>
    if (run.b) node = <strong>{node}</strong>
    if (run.href && linked) node = <a href={run.href} target="_blank" rel="noreferrer nofollow">{node}</a>
    return <span key={index}>{node}</span>
  })}</>
}

function nestList(items: ListItem[]): ListNode[] {
  const root: ListNode[] = []
  const stack: Array<{ depth: number; children: ListNode[] }> = [{ depth: -1, children: root }]
  for (const item of items) {
    while (stack.length > 1 && stack[stack.length - 1].depth >= item.depth) stack.pop()
    const node = { inlines: item.inlines, children: [] }
    stack[stack.length - 1].children.push(node)
    stack.push({ depth: item.depth, children: node.children })
  }
  return root
}

function List({ nodes, ordered }: { nodes: ListNode[]; ordered: boolean }) {
  const items = nodes.map((node, index) => <li key={index}><Inlines runs={node.inlines} />{node.children.length > 0 && <List nodes={node.children} ordered={false} />}</li>)
  return ordered ? <ol>{items}</ol> : <ul>{items}</ul>
}

function CodeBlock({ text, language, labels }: { text: string; language?: string; labels: { copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])
  const copy = () => { navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => undefined) }
  return <div className="original-code">
    <div><small>{language || 'text'}</small><button type="button" onClick={copy} aria-label={labels.copy}>{copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied ? labels.copied : labels.copy}</button></div>
    <pre><code>{text}</code></pre>
  </div>
}

function Figure({ image }: { image: OriginalImage }) {
  return <figure className="original-figure">
    <a href={image.src} target="_blank" rel="noreferrer"><img src={image.src} width={image.width} height={image.height} alt={image.alt ?? ''} loading="lazy" decoding="async" /></a>
    {image.alt && <figcaption>{image.alt}</figcaption>}
  </figure>
}

function Block({ block, language }: { block: OriginalBlock; language: Language }) {
  const labels = language === 'zh' ? { copy: '复制', copied: '已复制', quote: '引用' } : { copy: 'Copy', copied: 'Copied', quote: 'Quoting' }
  switch (block.type) {
    case 'heading':
      return block.level === 4 ? <h4><Inlines runs={block.inlines} /></h4> : <h3><Inlines runs={block.inlines} /></h3>
    case 'paragraph':
      return <p><Inlines runs={block.inlines} /></p>
    case 'quote':
      return <blockquote><Inlines runs={block.inlines} /></blockquote>
    case 'list':
      return <List nodes={nestList(block.items)} ordered={block.ordered} />
    case 'code':
      return <CodeBlock text={block.text} language={block.language} labels={labels} />
    case 'image':
      return <Figure image={block} />
    case 'video':
      return <div className="original-video" style={block.width && block.height ? { aspectRatio: `${block.width} / ${block.height}` } : undefined}>
        <video src={block.src} poster={block.poster} controls playsInline preload="none" />
      </div>
    case 'youtube':
      return <div className="original-youtube"><iframe src={`https://www.youtube-nocookie.com/embed/${block.videoId}`} title="YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
    case 'divider':
      return <hr />
    case 'table':
      return <div className="original-table"><table>
        {block.header.length > 0 && <thead><tr>{block.header.map((cell, index) => <th key={index}><Inlines runs={cell} /></th>)}</tr></thead>}
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}><Inlines runs={cell} /></td>)}</tr>)}</tbody>
      </table></div>
    case 'post-quote':
      return <a className="original-quote-card" href={block.url} target="_blank" rel="noreferrer nofollow">
        <small>{labels.quote} {block.author} {block.handle}</small>
        {block.inlines.length > 0 && <p><Inlines runs={block.inlines} linked={false} /></p>}
        {block.image && <img src={block.image.src} width={block.image.width} height={block.image.height} alt="" loading="lazy" decoding="async" />}
      </a>
    default:
      return null
  }
}

function Blocks({ blocks, language }: { blocks: OriginalBlock[]; language: Language }) {
  return <>{blocks.map((block, index) => <Block key={index} block={block} language={language} />)}</>
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}

export default function TutorialOriginalView({ tutorial, language }: { tutorial: TutorialGuide; language: Language }) {
  const [original, setOriginal] = useState<TutorialOriginal | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    loadTutorialOriginal(tutorial.id)
      .then((value) => { if (active) setOriginal(value) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [tutorial.id])
  const zh = language === 'zh'
  const sourceLabel = tutorial.source.platform === 'x' ? (zh ? '在 X 查看原帖' : 'View on X') : (zh ? '查看原始页面' : 'View source page')
  if (failed) return <OriginalUnavailable language={language} sourceUrl={tutorial.source.url} sourceLabel={sourceLabel} />
  if (!original) return <OriginalSkeleton />
  const revisionUrl = original.source.revision && tutorial.source.platform === 'github' ? `${tutorial.source.url.replace(/\/$/, '')}/tree/${original.source.revision}` : null
  return <OriginalDocument original={original} language={language} sourceLabel={sourceLabel} revisionUrl={revisionUrl} />
}

export function OriginalUnavailable({ language, sourceUrl, sourceLabel }: { language: Language; sourceUrl: string; sourceLabel: string }) {
  return <section className="original original-state" role="status"><p>{language === 'zh' ? '原文暂时无法加载。' : 'The original could not be loaded.'}</p><a href={sourceUrl} target="_blank" rel="noreferrer">{sourceLabel} <ArrowUpRight size={14} /></a></section>
}

// Renders any captured original: a single document, an X thread, or a multi-file package.
export function OriginalDocument({ original, language, sourceLabel, revisionUrl, kindLabel }: { original: TutorialOriginal; language: Language; sourceLabel: string; revisionUrl?: string | null; kindLabel?: string }) {
  const zh = language === 'zh'
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event('tutorial-original-ready')))
    return () => window.cancelAnimationFrame(frame)
  }, [original])
  const multiple = original.sections.length > 1
  const sectionLink = original.kind === 'markdown' ? (zh ? '文件' : 'File') : (zh ? '原帖' : 'Post')
  return <section className={`original is-${original.kind}`} aria-labelledby="original-heading" lang={original.language === 'other' ? undefined : original.language === 'zh' ? 'zh-CN' : original.language}>
    <header className="original-head">
      <p className="original-kicker">
        <span>{kindLabel ?? KIND_LABELS[language][original.kind]}</span>
        <span>{LANGUAGE_LABELS[language][original.language]}</span>
        <span>{zh ? '收录于' : 'Captured'} <time dateTime={original.capturedAt}>{formatDate(original.capturedAt, language)}</time></span>
      </p>
      <h2 id="original-heading">{original.title ?? (zh ? `${original.source.author} 的原帖` : `Original post by ${original.source.author}`)}</h2>
      <p className="original-byline">
        <strong>{original.source.author}</strong>{original.source.handle && <span>{original.source.handle}</span>}
        {original.source.license && <span>{zh ? '许可证' : 'License'} {original.source.license}</span>}
        {revisionUrl && <a href={revisionUrl} target="_blank" rel="noreferrer">{zh ? '版本' : 'Revision'} {original.source.revision?.slice(0, 7)}</a>}
        <a href={original.source.url} target="_blank" rel="noreferrer">{sourceLabel} <ArrowUpRight size={13} /></a>
      </p>
    </header>
    {original.cover && <Figure image={original.cover} />}
    {multiple
      ? <ol className="original-thread">{original.sections.map((section, index) => <li key={section.url ?? index} id={section.anchor}>
          <header><span>{index + 1} / {original.sections.length}</span>{section.title && <strong>{section.title}</strong>}{section.publishedAt && <time dateTime={section.publishedAt}>{section.publishedAt}</time>}{section.url && <a href={section.url} target="_blank" rel="noreferrer">{sectionLink} <ArrowUpRight size={12} /></a>}</header>
          <div className="original-body"><Blocks blocks={section.blocks} language={language} /></div>
        </li>)}</ol>
      : <div className="original-body"><Blocks blocks={original.sections[0].blocks} language={language} /></div>}
    <footer className="original-foot">
      <p>{zh ? '版权归原作者所有。本页完整收录原文并保留出处链接，内容以原作者的最新版本为准。' : 'Copyright belongs to the original author. This page reproduces the original with attribution; the author’s latest version takes precedence.'}</p>
      <a href="https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/new?template=takedown.yml" target="_blank" rel="noreferrer">{zh ? '作者申请更正或下架' : 'Authors: request a correction or removal'} <ArrowUpRight size={12} /></a>
    </footer>
  </section>
}

export function OriginalSkeleton() {
  return <section className="original original-state" aria-busy="true"><span className="original-skeleton" /><span className="original-skeleton short" /><span className="original-skeleton" /></section>
}
