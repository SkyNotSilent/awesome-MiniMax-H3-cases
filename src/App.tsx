import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock3,
  Code2,
  Languages,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import rawCases from '../data/cases.json'
import {
  casePath,
  casePrompt,
  caseSummary,
  caseTitle,
  copy,
  metadataValue,
  modeLabel,
  modelLabel,
  pathFor,
  provenanceLabel,
  resolveRoute,
  sourceLabel,
  taxonomyLabel,
  type AppPage,
  type Language,
} from './i18n'
import type { CaseMode, VideoCase } from './types'
import { XPostEmbed } from './XPostEmbed'

const cases = rawCases as VideoCase[]
const modes: Array<'ALL' | CaseMode> = ['ALL', 'T2VA', 'FL2VA', 'Ref2VA', 'Unknown']
const allCategories = [...new Set(cases.map((item) => item.category))]
const allStyles = [...new Set(cases.flatMap((item) => item.styles))]
const allScenes = [...new Set(cases.flatMap((item) => item.scenes))]

const toolkitResources = [
  {
    code: 'R01',
    kind: { zh: '官方 / AGENT SKILLS', en: 'OFFICIAL / AGENT SKILLS' },
    title: 'MiniMax-AI / MiniMax-H3',
    description: {
      zh: '官方仓库与本地部署入口。内置 9 个 Agent Skill；先装 h3-prompt-writing，让 Claude / Codex 按镜头、对白与环境声组织 H3 提示词。',
      en: 'The official repository and local deployment entry point. Its nine Agent Skills include h3-prompt-writing for structuring shots, dialogue, and environmental audio with Claude or Codex.',
    },
    tags: ['9 Skills', 'Prompt Writing', 'Local Deploy'],
    url: 'https://github.com/MiniMax-AI/MiniMax-H3',
    action: { zh: '打开官方仓库', en: 'Open official repository' },
  },
  {
    code: 'R02',
    kind: { zh: '加速 / LORA', en: 'ACCELERATION / LORA' },
    title: 'MiniMax-H3 Turbo LoRA',
    description: {
      zh: '将常规约 20 步采样压缩到 4–8 步并保留同步立体声音频。4 步用于快速预览，v4 版本在 6–8 步通常更稳。',
      en: 'Compresses the usual 20-step sampling path to four to eight steps while retaining synchronized stereo audio. Four steps suit previews; v4 is generally steadier at six to eight.',
    },
    tags: ['4–8 Steps', 'Audio + Video', 'ComfyUI'],
    url: 'https://huggingface.co/larryvrh/MiniMax-H3-Turbo-Lora',
    action: { zh: '打开 Hugging Face', en: 'Open on Hugging Face' },
  },
  {
    code: 'R03',
    kind: { zh: '长视频 / 上下文', en: 'LONG VIDEO / CONTEXT' },
    title: 'ComfyUI H3 Motion Context',
    description: {
      zh: '用于多段 H3 视频续接，把上一段的画面与音频上下文带入下一段，减少连接处的动作、节奏和声音断裂。',
      en: 'Carries visual and audio context from one H3 clip into the next, reducing breaks in motion, rhythm, and sound across longer sequences.',
    },
    tags: ['Clip Chaining', 'Motion Context', 'Audio Continuity'],
    url: 'https://github.com/NikoDemon80/ComfyUI-H3-Motion-Context',
    action: { zh: '打开续接节点', en: 'Open continuation nodes' },
  },
  {
    code: 'R04',
    kind: { zh: '音频 / 工作流', en: 'AUDIO / WORKFLOWS' },
    title: 'MiniMax H3 Audio T8',
    description: {
      zh: '面向 ComfyUI 原生 H3 的 14 节点扩展，覆盖音频条件、双时钟采样、混音、裁切、预检和 Ref2VA 参考，并附 API 与前端工作流。',
      en: 'A 14-node extension for native H3 in ComfyUI, covering audio conditioning, dual-clock sampling, mixing, trimming, preflight checks, Ref2VA references, API use, and frontend workflows.',
    },
    tags: ['14 Nodes', 'Dual Clock', 'Audio Control'],
    url: 'https://github.com/T8mars/comfyui-minimax-h3-audio-T8',
    action: { zh: '打开音频工作流', en: 'Open audio workflows' },
  },
]

function App() {
  const route = resolveRoute(window.location.pathname)
  const language = route.language
  const t = copy[language]
  const pageDescription = route.page === 'toolkit'
    ? t.toolkit.description
    : route.page === 'faq'
      ? t.faq.description
      : t.siteDescription
  const pageTitle = route.page === 'home'
    ? t.siteTitle
    : route.page === 'toolkit'
      ? language === 'zh'
        ? 'MiniMax H3 工具链与部署资源 — H3 Field Notes'
        : 'MiniMax H3 Toolkit and Deployment Resources — H3 Field Notes'
      : language === 'zh'
        ? 'MiniMax H3 视频案例库常见问题 — H3 Field Notes'
        : 'MiniMax H3 Video Library FAQ — H3 Field Notes'

  useEffect(() => {
    document.documentElement.lang = t.htmlLang
    document.title = pageTitle
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', pageDescription)
  }, [pageDescription, pageTitle, t.htmlLang])

  return (
    <main id="top">
      <div className="grain" aria-hidden="true" />
      <Header language={language} page={route.page} />
      {route.page === 'home' && <HomePage language={language} />}
      {route.page === 'toolkit' && <ToolkitPage language={language} />}
      {route.page === 'faq' && <FaqPage language={language} />}
      <Footer language={language} />
    </main>
  )
}

function Header({ language, page }: { language: Language; page: AppPage }) {
  const t = copy[language]
  const otherLanguage: Language = language === 'zh' ? 'en' : 'zh'

  return (
    <header className="site-header-wrap">
      <div className="shell site-header">
        <a className="brand" href={pathFor(language, 'home')} aria-label="H3 Field Notes">
          H3<span>/FN</span>
        </a>
        <nav aria-label={language === 'zh' ? '主导航' : 'Primary navigation'}>
          <a href={pathFor(language, 'home')} aria-current={page === 'home' ? 'page' : undefined}>{t.nav.cases}</a>
          <a href={pathFor(language, 'toolkit')} aria-current={page === 'toolkit' ? 'page' : undefined}>{t.nav.toolkit}</a>
          <a href={pathFor(language, 'faq')} aria-current={page === 'faq' ? 'page' : undefined}>{t.nav.faq}</a>
        </nav>
        <div className="header-actions">
          <a
            className="language-button"
            href={pathFor(otherLanguage, page)}
            aria-label={language === 'zh' ? '切换到英文' : 'Switch to Chinese'}
          >
            <Languages size={14} aria-hidden="true" /> {t.nav.language}
          </a>
          <a
            className="source-button"
            href="https://github.com/SkyNotSilent/awesome-minimax-h3"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={15} aria-hidden="true" /> <span>{t.nav.source}</span>
          </a>
        </div>
      </div>
    </header>
  )
}

function IntroSplash({ language }: { language: Language }) {
  const [phase, setPhase] = useState<'visible' | 'leaving' | 'gone'>('visible')
  const t = copy[language].intro

  useEffect(() => {
    document.body.classList.add('intro-open')
    const leaveTimer = window.setTimeout(() => setPhase('leaving'), 1_600)
    return () => {
      window.clearTimeout(leaveTimer)
      document.body.classList.remove('intro-open')
    }
  }, [])

  useEffect(() => {
    if (phase === 'gone') {
      document.body.classList.remove('intro-open')
      return
    }
    if (phase !== 'leaving') return
    const removeTimer = window.setTimeout(() => setPhase('gone'), 500)
    return () => window.clearTimeout(removeTimer)
  }, [phase])

  const skip = () => {
    setPhase('leaving')
  }

  if (phase === 'gone') return null

  return (
    <aside className={`intro-splash ${phase === 'leaving' ? 'is-leaving' : ''}`} aria-label={t.description}>
      <div className="intro-grid" aria-hidden="true" />
      <div className="intro-topline">
        <span><i /> {t.kicker}</span>
        <button type="button" onClick={skip}>{t.skip} <ArrowUpRight size={13} /></button>
      </div>
      <div className="intro-wordmark" aria-hidden="true">
        <span>{t.lineOne}</span>
        <strong>{t.lineTwo}</strong>
      </div>
      <div className="intro-bottomline">
        <p>{t.description}</p>
        <div className="intro-ready"><span /> {t.ready} · {cases.length}</div>
      </div>
      <div className="intro-progress" aria-hidden="true"><span /></div>
    </aside>
  )
}

function HomePage({ language }: { language: Language }) {
  const t = copy[language]
  const [activeMode, setActiveMode] = useState<(typeof modes)[number]>('ALL')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [activeStyle, setActiveStyle] = useState('ALL')
  const [activeScene, setActiveScene] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VideoCase | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return cases.filter((item) => {
      const matchesMode = activeMode === 'ALL' || item.mode === activeMode
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory
      const matchesStyle = activeStyle === 'ALL' || item.styles.includes(activeStyle)
      const matchesScene = activeScene === 'ALL' || item.scenes.includes(activeScene)
      const prompt = casePrompt(item, language)
      const haystack = language === 'zh'
        ? [item.title, item.summary, prompt, item.author, item.sourceLabel, ...item.tags, item.category, ...item.styles, ...item.scenes]
        : [item.titleEn, item.summaryEn, prompt, item.author, item.category, ...item.styles, ...item.scenes]
      return matchesMode && matchesCategory && matchesStyle && matchesScene
        && (!needle || haystack.filter(Boolean).join(' ').toLowerCase().includes(needle))
    })
  }, [activeCategory, activeMode, activeScene, activeStyle, language, query])

  const advancedCount = [activeCategory, activeStyle, activeScene].filter((value) => value !== 'ALL').length

  return (
    <>
      <IntroSplash language={language} />
      <section className="catalog shell" id="catalog">
        <div className="catalog-bar">
          <div className="catalog-heading">
            <p className="section-index">{t.catalog.index}</p>
            <h1>{t.catalog.title}</h1>
            <p>{t.catalog.description}</p>
          </div>
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">{t.catalog.searchLabel}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.catalog.searchPlaceholder}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t.catalog.clearSearch}>
                <X size={15} />
              </button>
            )}
          </label>
        </div>

        <div className="primary-filter" aria-label={t.catalog.filterLabel}>
          <div className="filter-label"><SlidersHorizontal size={15} aria-hidden="true" /> {t.catalog.mode}</div>
          <div className="mode-filter">
            {modes.map((mode) => (
              <button
                type="button"
                key={mode}
                className={mode === activeMode ? 'active' : ''}
                onClick={() => setActiveMode(mode)}
              >
                <span>{mode === 'ALL' ? '00' : mode}</span>{modeLabel(mode, language)}
              </button>
            ))}
          </div>
        </div>

        <details className="advanced-filters">
          <summary>
            <span><SlidersHorizontal size={14} /> {advancedCount ? t.catalog.advancedActive : t.catalog.advanced}</span>
            <span>{advancedCount || '—'} <ChevronDown size={14} /></span>
          </summary>
          <div className="filter-panel">
            <FilterGroup language={language} kind="category" label={t.catalog.category} options={['ALL', ...allCategories]} value={activeCategory} onChange={setActiveCategory} />
            <FilterGroup language={language} kind="style" label={t.catalog.style} options={['ALL', ...allStyles]} value={activeStyle} onChange={setActiveStyle} />
            <FilterGroup language={language} kind="scene" label={t.catalog.scene} options={['ALL', ...allScenes]} value={activeScene} onChange={setActiveScene} />
          </div>
        </details>

        <div className="catalog-count" aria-live="polite">
          <span>{String(filtered.length).padStart(2, '0')}</span> {t.catalog.resultUnit}
        </div>

        <div className="case-grid">
          {filtered.map((item, index) => (
            <CaseCard key={item.id} item={item} index={index} language={language} onOpen={() => setSelected(item)} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <span>{t.catalog.noMatchesEyebrow}</span>
            <p>{t.catalog.noMatches}</p>
          </div>
        )}
      </section>
      {selected && <CaseDialog item={selected} language={language} onClose={() => setSelected(null)} />}
    </>
  )
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
  language,
  kind,
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  language: Language
  kind: 'category' | 'style' | 'scene'
}) {
  return (
    <div className="filter-group">
      <strong>{label}</strong>
      <div>
        {options.map((option) => (
          <button type="button" key={option} className={option === value ? 'active' : ''} onClick={() => onChange(option)}>
            {taxonomyLabel(option, language, kind)}
          </button>
        ))}
      </div>
    </div>
  )
}

function CaseCard({
  item,
  index,
  language,
  onOpen,
}: {
  item: VideoCase
  index: number
  language: Language
  onOpen: () => void
}) {
  const t = copy[language].card
  const title = caseTitle(item, language)
  const chips = [
    item.styles[0] && taxonomyLabel(item.styles[0], language, 'style'),
    item.scenes[0] && taxonomyLabel(item.scenes[0], language, 'scene'),
  ].filter(Boolean)

  return (
    <article className="case-card" style={{ '--order': index } as React.CSSProperties}>
      <button className="media" type="button" onClick={onOpen} aria-label={t.open(title)}>
        {item.mediaUrl ? (
          <video src={item.mediaUrl} poster={item.posterUrl} muted loop playsInline preload="metadata" />
        ) : (
          <img
            src={item.posterUrl}
            alt={t.cover(title)}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.onerror = null
              event.currentTarget.src = '/posters/x-community.svg'
            }}
          />
        )}
        <span className="media-scan" aria-hidden="true" />
        <span className="case-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="duration"><Clock3 size={12} /> {item.duration}s</span>
        <span className="play-mark">
          {item.mediaUrl || item.sourceType === 'x' ? t.play : t.view} <ChevronRight size={14} />
        </span>
      </button>
      <div className="case-meta">
        <div className="mode-line">
          <span>{item.mode} / {taxonomyLabel(item.category, language, 'category')}</span>
          {item.verified ? (
            <span className="verified"><Check size={11} /> {t.verified}</span>
          ) : item.sourceType === 'x' ? (
            <span className="verified community-source"><ArrowUpRight size={11} /> {t.community}</span>
          ) : null}
        </div>
        <a className="case-title" href={casePath(language, item.id)}>
          <h2>{title}</h2>
        </a>
        <div className="tags">
          {chips.map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
      </div>
    </article>
  )
}

function PageHero({ index, title, description }: { index: string; title: string; description: string }) {
  return (
    <section className="page-hero shell">
      <p className="section-index">{index}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="page-hero-rule" aria-hidden="true"><span /></div>
    </section>
  )
}

function ToolkitPage({ language }: { language: Language }) {
  const t = copy[language].toolkit

  return (
    <div className="standalone-page toolkit-page">
      <PageHero index={t.index} title={t.title} description={t.description} />
      <section className="toolkit shell" aria-label={copy[language].nav.toolkit}>
        <div className="toolkit-grid">
          {toolkitResources.map((item) => (
            <a className="resource-card" href={item.url} target="_blank" rel="noreferrer" key={item.code} aria-label={`${item.title}: ${item.action[language]}`}>
              <div className="resource-topline"><span>{item.code}</span><span>{item.kind[language]}</span></div>
              <h2>{item.title}</h2>
              <p>{item.description[language]}</p>
              <div className="resource-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="resource-action">{item.action[language]} <ArrowUpRight size={15} /></div>
            </a>
          ))}
        </div>

        <div className="toolkit-notes">
          <article className="speed-note">
            <div className="note-label">{t.speedLabel}</div>
            <h2>{t.speedTitle}</h2>
            <p>{t.speedBody}</p>
            <small>{t.speedFootnote}</small>
          </article>
          <article className="pipeline-note principles-note">
            <div className="note-label">{t.principlesLabel}</div>
            <div className="pipeline-flow principles-flow" aria-label={t.principlesLabel}>
              <div><span>01</span><strong>VIDEO</strong><small>{t.principles[0]}</small></div>
              <ChevronRight size={18} aria-hidden="true" />
              <div><span>02</span><strong>SOURCE</strong><small>{t.principles[1]}</small></div>
              <ChevronRight size={18} aria-hidden="true" />
              <div><span>03</span><strong>PROMPT</strong><small>{t.principles[2]}</small></div>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}

function FaqPage({ language }: { language: Language }) {
  const t = copy[language].faq

  return (
    <div className="standalone-page faq-page">
      <PageHero index={t.index} title={t.title} description={t.description} />
      <section className="faq shell" aria-label={copy[language].nav.faq}>
        <div className="faq-list">
          {t.items.map(([question, answer], index) => (
            <article key={question}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h2>{question}</h2><p>{answer}</p></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function CaseDialog({ item, language, onClose }: { item: VideoCase; language: Language; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const t = copy[language].dialog
  const title = caseTitle(item, language)
  const prompt = casePrompt(item, language)
  const hasPublishedPrompt = item.promptProvenance !== 'not-published' && Boolean(prompt)

  useEffect(() => {
    mountedRef.current = true
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.body.classList.add('modal-open')
    window.addEventListener('keydown', close)
    return () => {
      mountedRef.current = false
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', close)
    }
  }, [onClose])

  async function copyPrompt() {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    if (!mountedRef.current) return
    setCopied(true)
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1_800)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="case-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" type="button" onClick={onClose} aria-label={t.close}><X size={19} /></button>
        <div className="dialog-video">
          {item.mediaUrl ? (
            <video src={item.mediaUrl} poster={item.posterUrl} controls autoPlay playsInline />
          ) : (
            <XPostEmbed sourceUrl={item.sourceUrl} title={title} posterUrl={item.posterUrl} language={language} />
          )}
        </div>
        <div className="dialog-copy">
          <div className="dialog-eyebrow">
            <span>{item.mode}</span>
            <span>{metadataValue(item.resolution, language)}</span>
            <span>{metadataValue(item.aspectRatio, language)}</span>
            <span>{item.duration} {t.seconds}</span>
          </div>
          <h2 id="dialog-title">{title}</h2>
          <p className="summary">{caseSummary(item, language)}</p>
          <div className="case-model-line">{modelLabel(item, language)}</div>
          {hasPublishedPrompt ? (
            <div className="published-prompt">
              <div className="prompt-heading">
                <span>{t.prompt} · {provenanceLabel(item.promptProvenance, language)}</span>
                <button type="button" onClick={copyPrompt}>
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? t.copied : t.copy}
                </button>
              </div>
              <p className="prompt-notice">{t.promptPublished} · {t.promptNotice}</p>
              <pre>{prompt}</pre>
            </div>
          ) : (
            <p className="prompt-unavailable">{t.promptUnavailable}</p>
          )}
          <a className="original-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
            {t.source} · {sourceLabel(item, language)} <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
    </div>
  )
}

function Footer({ language }: { language: Language }) {
  const t = copy[language].footer
  return (
    <footer className="shell">
      <div className="footer-mark"><Sparkles size={16} /> {t.mark}</div>
      <p>{t.note}</p>
      <span>H3/FN — 2026</span>
    </footer>
  )
}

export default App
