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
  TriangleAlert,
  X,
} from 'lucide-react'
import rawCases from '../data/cases.json'
import rawTutorials from '../data/tutorials.json'
import {
  casePath,
  casePrompt,
  caseSummary,
  caseTitle,
  copy,
  durationLabel,
  metadataValue,
  modelLabel,
  pathFor,
  provenanceLabel,
  resolveRoute,
  sourceLabel,
  taxonomyLabel,
  type AppPage,
  type Language,
} from './i18n'
import type { VideoCase } from './types'
import { XPostEmbed } from './XPostEmbed'

const cases = rawCases as VideoCase[]
type TutorialCategory = 'mac' | 'official' | 'workflow' | 'acceleration' | 'long-video' | 'audio' | 'training' | 'resources'
type LocalizedText = Record<Language, string>
type TutorialResource = {
  id: string
  code: string
  category: TutorialCategory
  featured: boolean
  title: string
  url: string
  kind: LocalizedText
  description: LocalizedText
  audience: LocalizedText
  steps: Record<Language, string[]>
  facts: string[]
  tags: string[]
  action: LocalizedText
  verifiedAt: string
}

const tutorials = rawTutorials as TutorialResource[]
const tutorialCategories: Array<'all' | TutorialCategory> = [
  'all',
  'official',
  'mac',
  'workflow',
  'acceleration',
  'long-video',
  'audio',
  'training',
  'resources',
]
const durationRanges = ['ALL', 'UP_TO_5', 'SIX_TO_10', 'ELEVEN_TO_15', 'OVER_15'] as const
type DurationRange = (typeof durationRanges)[number]
const allCategories = [...new Set(cases.map((item) => item.category))]
const allStyles = [...new Set(cases.flatMap((item) => item.styles))]
const allScenes = [...new Set(cases.flatMap((item) => item.scenes))]

function XMark({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

function HostedVideo({ item, language, title }: { item: VideoCase; language: Language; title: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const loading = language === 'zh' ? '正在加载站内视频…' : 'Loading hosted video…'
  const failed = language === 'zh' ? '视频暂时无法加载' : 'Video is temporarily unavailable'
  const openX = language === 'zh' ? '在 X 打开原帖' : 'Open original post on X'

  return (
    <div className="hosted-video" data-state={state}>
      <video
        src={item.mediaUrl || undefined}
        poster={item.posterUrl}
        controls
        autoPlay
        playsInline
        preload="metadata"
        onLoadStart={() => setState('loading')}
        onCanPlay={() => setState('ready')}
        onError={() => setState('error')}
      />
      {state === 'loading' && (
        <div className="hosted-video-status" role="status" aria-live="polite">
          <span className="hosted-video-spinner" aria-hidden="true" />
          <strong>{loading}</strong>
        </div>
      )}
      {state === 'error' && (
        <div className="hosted-video-status hosted-video-error" role="alert">
          <TriangleAlert size={28} aria-hidden="true" />
          <strong>{failed}</strong>
          {item.sourceType === 'x' && <a href={item.sourceUrl} target="_blank" rel="noreferrer"><XMark /> {openX}</a>}
        </div>
      )}
      {item.sourceType === 'x' && (
        <a
          className="x-source-icon"
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${openX}: ${title}`}
          title={openX}
        >
          <XMark size={17} />
        </a>
      )}
    </div>
  )
}

function App() {
  const route = resolveRoute(window.location.pathname)
  const language = route.language
  const t = copy[language]
  const pageDescription = route.page === 'tutorials'
    ? t.tutorials.description
    : route.page === 'faq'
      ? t.faq.description
      : t.siteDescription
  const pageTitle = route.page === 'home'
    ? t.siteTitle
    : route.page === 'tutorials'
      ? language === 'zh'
        ? 'MiniMax H3 教程与工具：部署、工作流、加速、训练 — H3 Field Notes'
        : 'MiniMax H3 Tutorials and Tools: Setup, Workflows, Speed, Training — H3 Field Notes'
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
      {route.page === 'tutorials' && <TutorialsPage language={language} />}
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
          <a href={pathFor(language, 'tutorials')} aria-current={page === 'tutorials' ? 'page' : undefined}>{t.nav.tutorials}</a>
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
    const dismissImmediately = () => {
      document.body.classList.remove('intro-open')
      setPhase('gone')
    }
    const passiveOptions: AddEventListenerOptions = { passive: true }

    window.addEventListener('pointerdown', dismissImmediately)
    window.addEventListener('wheel', dismissImmediately, passiveOptions)
    window.addEventListener('touchmove', dismissImmediately, passiveOptions)
    window.addEventListener('scroll', dismissImmediately, passiveOptions)
    window.addEventListener('keydown', dismissImmediately)

    return () => {
      window.clearTimeout(leaveTimer)
      window.removeEventListener('pointerdown', dismissImmediately)
      window.removeEventListener('wheel', dismissImmediately)
      window.removeEventListener('touchmove', dismissImmediately)
      window.removeEventListener('scroll', dismissImmediately)
      window.removeEventListener('keydown', dismissImmediately)
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
    document.body.classList.remove('intro-open')
    setPhase('gone')
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
  const [activeDuration, setActiveDuration] = useState<DurationRange>('ALL')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [activeStyle, setActiveStyle] = useState('ALL')
  const [activeScene, setActiveScene] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VideoCase | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return cases.filter((item) => {
      const matchesDuration = activeDuration === 'ALL'
        || (activeDuration === 'UP_TO_5' && item.duration <= 5)
        || (activeDuration === 'SIX_TO_10' && item.duration > 5 && item.duration <= 10)
        || (activeDuration === 'ELEVEN_TO_15' && item.duration > 10 && item.duration <= 15)
        || (activeDuration === 'OVER_15' && item.duration > 15)
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory
      const matchesStyle = activeStyle === 'ALL' || item.styles.includes(activeStyle)
      const matchesScene = activeScene === 'ALL' || item.scenes.includes(activeScene)
      const prompt = casePrompt(item, language)
      const haystack = language === 'zh'
        ? [item.title, item.summary, prompt, item.author, item.sourceLabel, ...item.tags, item.category, ...item.styles, ...item.scenes]
        : [item.titleEn, item.summaryEn, prompt, item.author, item.category, ...item.styles, ...item.scenes]
      return matchesDuration && matchesCategory && matchesStyle && matchesScene
        && (!needle || haystack.filter(Boolean).join(' ').toLowerCase().includes(needle))
    })
  }, [activeCategory, activeDuration, activeScene, activeStyle, language, query])

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
          <div className="filter-label"><Clock3 size={15} aria-hidden="true" /> {t.catalog.duration}</div>
          <div className="duration-filter">
            {durationRanges.map((range, index) => (
              <button
                type="button"
                key={range}
                className={range === activeDuration ? 'active' : ''}
                onClick={() => setActiveDuration(range)}
              >
                <span>{String(index).padStart(2, '0')}</span>{durationLabel(range, language)}
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
    item.styles[0] && {
      key: `style:${item.styles[0]}`,
      label: taxonomyLabel(item.styles[0], language, 'style'),
    },
    item.scenes[0] && {
      key: `scene:${item.scenes[0]}`,
      label: taxonomyLabel(item.scenes[0], language, 'scene'),
    },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))

  return (
    <article className="case-card" style={{ '--order': index } as React.CSSProperties}>
      <button className="media" type="button" onClick={onOpen} aria-label={t.open(title)}>
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
          {chips.map((chip) => <span key={chip.key}>#{chip.label}</span>)}
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

function TutorialsPage({ language }: { language: Language }) {
  const t = copy[language].tutorials
  const [activeCategory, setActiveCategory] = useState<(typeof tutorialCategories)[number]>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tutorials.filter((item) => {
      const categoryMatches = activeCategory === 'all' || item.category === activeCategory
      const searchable = [
        item.title,
        item.kind[language],
        item.description[language],
        item.audience[language],
        ...item.steps[language],
        ...item.facts,
        ...item.tags,
      ].join(' ').toLowerCase()
      return categoryMatches && (!needle || searchable.includes(needle))
    })
  }, [activeCategory, language, query])

  const featured = filtered.find((item) => item.featured)
  const remaining = filtered.filter((item) => !item.featured)

  return (
    <div className="standalone-page tutorials-page">
      <PageHero index={t.index} title={t.title} description={t.description} />
      <section className="tutorial-hub shell" aria-label={copy[language].nav.tutorials}>
        <div className="tutorial-controls">
          <label className="tutorial-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{t.searchLabel}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label={t.clearSearch}><X size={14} /></button>}
          </label>
          <div className="tutorial-filters" role="group" aria-label={t.filterLabel}>
            {tutorialCategories.map((category) => (
              <button
                type="button"
                key={category}
                className={activeCategory === category ? 'active' : ''}
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {t.categories[category]}
              </button>
            ))}
          </div>
        </div>

        {featured && (
          <article className="tutorial-feature">
            <div className="tutorial-feature-copy">
              <div className="resource-topline"><span>{featured.code} / {t.featuredLabel}</span><span>{featured.kind[language]}</span></div>
              <h2>{featured.title}</h2>
              <p className="tutorial-summary">{featured.description[language]}</p>
              <p className="tutorial-audience"><strong>{t.bestFor}</strong>{featured.audience[language]}</p>
              <div className="resource-tags">{featured.facts.map((fact) => <span key={fact}>{fact}</span>)}</div>
              <a className="tutorial-link" href={featured.url} target="_blank" rel="noreferrer">
                {featured.action[language]} <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="tutorial-feature-steps">
              <div className="tutorial-step-heading"><span>{t.startLabel}</span><small>{t.verified} {featured.verifiedAt}</small></div>
              <ol>
                {featured.steps[language].map((step, index) => (
                  <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>
                ))}
              </ol>
              <div className="tutorial-command" aria-label={t.commandLabel}>
                <code>make -j8</code>
                <code>./h3 --info -d ./MiniMax-H3</code>
              </div>
            </div>
          </article>
        )}

        {remaining.length > 0 && (
          <div className="tutorial-grid">
            {remaining.map((item) => (
              <article className="tutorial-card" key={item.id}>
                <div className="resource-topline"><span>{item.code}</span><span>{item.kind[language]}</span></div>
                <h2>{item.title}</h2>
                <p className="tutorial-summary">{item.description[language]}</p>
                <p className="tutorial-audience"><strong>{t.bestFor}</strong>{item.audience[language]}</p>
                <ol className="tutorial-card-steps">
                  {item.steps[language].map((step, index) => (
                    <li key={step}><span>{index + 1}</span><p>{step}</p></li>
                  ))}
                </ol>
                <div className="resource-tags">{item.facts.map((fact) => <span key={fact}>{fact}</span>)}</div>
                <div className="tutorial-card-footer">
                  <small>{t.verified} {item.verifiedAt}</small>
                  <a href={item.url} target="_blank" rel="noreferrer" aria-label={`${item.title}: ${item.action[language]}`}>
                    {item.action[language]} <ArrowUpRight size={15} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        {!featured && remaining.length === 0 && (
          <div className="tutorial-empty"><span>00</span><p>{t.noResults}</p></div>
        )}

        <aside className="tutorial-field-note">
          <div><span>{t.fieldNoteLabel}</span><h2>{t.fieldNoteTitle}</h2></div>
          <p>{t.fieldNoteBody}</p>
          <small>{t.sourceNote}</small>
        </aside>
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
            <HostedVideo item={item} language={language} title={title} />
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
