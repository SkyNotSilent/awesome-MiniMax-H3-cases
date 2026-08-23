import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock3,
  Languages,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react'
import rawCases from '../data/cases.json'
import rawProjectStats from '../data/project-stats.json'
import rawTutorialGuides from '../data/tutorial-guides.json'
import rawTutorials from '../data/tutorials.json'
import {
  casePath,
  casePrompt,
  caseSummary,
  caseTitle,
  copy,
  detectVisitorLanguage,
  durationLabel,
  languagePreferenceKey,
  metadataValue,
  modelLabel,
  pathFor,
  provenanceLabel,
  resolveRoute,
  sourceLabel,
  taxonomyLabel,
  tutorialEcosystemPath,
  tutorialPath,
  type AppPage,
  type Language,
} from './i18n'
import type { TutorialCategory, TutorialGuide, TutorialHardwareProfile, TutorialResource, VideoCase } from './types'
import { XPostEmbed } from './XPostEmbed'

const cases = rawCases as VideoCase[]
const tutorialResources = rawTutorials as TutorialResource[]
const tutorialGuides = rawTutorialGuides as TutorialGuide[]
const projectStats = rawProjectStats
const completePromptCount = projectStats.completePrompts
const unpublishedPromptCount = projectStats.cases - completePromptCount
const bootStartedAt = (window as Window & { __H3_BOOT_AT?: number }).__H3_BOOT_AT
const initialIntroOffset = bootStartedAt
  ? Math.max(0, Math.min(1_600, performance.now() - bootStartedAt))
  : 0
const tutorialCategories: Array<'all' | TutorialCategory> = [
  'all',
  'getting-started',
  'comfyui',
  'prompt',
  'acceleration',
  'long-video',
  'audio',
  'training',
]
const durationRanges = ['ALL', 'UP_TO_5', 'SIX_TO_10', 'ELEVEN_TO_15', 'OVER_15'] as const
type DurationRange = (typeof durationRanges)[number]
const allCategories = [...new Set(cases.map((item) => item.category))]
const allStyles = [...new Set(cases.flatMap((item) => item.styles))]
const allScenes = [...new Set(cases.flatMap((item) => item.scenes))]
const favoriteStorageKey = 'minimax-h3-favorite-cases'
const collectionKeys = ['all', 'featured', 'latest', 'prompt', 'official', 'long', 'favorites'] as const
type CaseCollection = (typeof collectionKeys)[number]
const featuredCaseIds = new Set(cases
  .filter((item) => item.verified && Boolean(item.mediaUrl) && item.promptProvenance !== 'not-published')
  .slice(0, 24)
  .map((item) => item.id))
const latestCaseIds = new Set([...cases]
  .sort((a, b) => Date.parse(b.approvedAt ?? b.publishedAt) - Date.parse(a.approvedAt ?? a.publishedAt))
  .slice(0, 48)
  .map((item) => item.id))
const hardwareProfiles: TutorialHardwareProfile[] = [
  'apple-silicon',
  'vram-8',
  'vram-12',
  'vram-16',
  'vram-24-plus',
  'cloud-gpu',
]

function initialRoute() {
  const route = resolveRoute(window.location.pathname)
  const isAutoLanguageEntry = window.location.pathname === '/' || window.location.pathname === ''
  if (!isAutoLanguageEntry) return route

  let storedLanguage: Language | null = null
  try {
    const stored = window.localStorage.getItem(languagePreferenceKey)
    if (stored === 'zh' || stored === 'en') storedLanguage = stored
  } catch {
    // Language detection still works when storage is disabled.
  }

  let timeZone = ''
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // Some privacy-focused browsers do not expose a time zone.
  }

  const detectedLanguage = storedLanguage ?? detectVisitorLanguage(
    navigator.languages?.length ? navigator.languages : [navigator.language],
    timeZone,
  )

  if (detectedLanguage === 'en') {
    window.history.replaceState(window.history.state, '', `/en/${window.location.search}${window.location.hash}`)
    return { language: 'en' as const, page: 'home' as const }
  }

  return route
}

function XMark({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}

function GitHubMark({ size = 21 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M12 .297a12 12 0 0 0-3.79 23.4c.6.112.82-.26.82-.577v-2.234c-3.338.726-4.04-1.61-4.04-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.419-1.305.762-1.604-2.665-.305-5.466-1.334-5.466-5.93 0-1.312.468-2.382 1.235-3.222-.123-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.5 11.5 0 0 1 12 6.32a11.5 11.5 0 0 1 3.004.404c2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.119 3.177.768.84 1.233 1.91 1.233 3.221 0 4.61-2.806 5.624-5.479 5.921.43.37.814 1.102.814 2.222v3.293c0 .32.216.694.825.576A12 12 0 0 0 12 .297Z" />
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
  const [route, setRoute] = useState(initialRoute)
  const language = route.language
  const t = copy[language]
  const activeTutorial = route.page === 'tutorial-detail'
    ? tutorialGuides.find((item) => item.id === route.tutorialSlug)
    : undefined
  const pageDescription = activeTutorial
    ? activeTutorial.outcome[language]
    : route.page === 'tutorials' || route.page === 'tutorial-ecosystem'
    ? t.tutorials.description
    : route.page === 'faq'
      ? t.faq.description
      : t.siteDescription
  const pageTitle = activeTutorial
    ? `${activeTutorial.title[language]} — MiniMax H3 Cases & Guides`
    : route.page === 'home'
    ? t.siteTitle
    : route.page === 'tutorials'
      ? language === 'zh'
        ? 'MiniMax H3 教程与工具：部署、工作流、加速、训练 — MiniMax H3 Cases & Guides'
        : 'MiniMax H3 Tutorials and Tools: Setup, Workflows, Speed, Training — MiniMax H3 Cases & Guides'
      : route.page === 'tutorial-ecosystem'
        ? language === 'zh'
          ? 'MiniMax H3 教程与工具生态 — MiniMax H3 Cases & Guides'
          : 'MiniMax H3 Tutorial and Tool Ecosystem — MiniMax H3 Cases & Guides'
      : language === 'zh'
        ? 'MiniMax H3 视频案例库常见问题 — MiniMax H3 Cases & Guides'
        : 'MiniMax H3 Video Library FAQ — MiniMax H3 Cases & Guides'

  useEffect(() => {
    document.documentElement.lang = t.htmlLang
    document.title = pageTitle
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', pageDescription)
  }, [pageDescription, pageTitle, t.htmlLang])

  useEffect(() => {
    const handlePopState = () => setRoute(resolveRoute(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const switchLanguage = (nextLanguage: Language) => {
    if (nextLanguage === language) return
    try {
      window.localStorage.setItem(languagePreferenceKey, nextLanguage)
    } catch {
      // Keep the current-session switch working when storage is disabled.
    }
    const nextBasePath = route.page === 'tutorial-detail' && route.tutorialSlug
      ? tutorialPath(nextLanguage, route.tutorialSlug)
      : route.page === 'tutorial-ecosystem'
        ? tutorialEcosystemPath(nextLanguage)
        : pathFor(nextLanguage, route.page as Exclude<AppPage, 'tutorial-detail' | 'tutorial-ecosystem'>)
    const nextPath = `${nextBasePath}${window.location.search}${window.location.hash}`
    window.history.pushState(window.history.state, '', nextPath)
    setRoute({ ...route, language: nextLanguage })
  }

  return (
    <main id="top">
      <div className="grain" aria-hidden="true" />
      <Header language={language} page={route.page} onLanguageChange={switchLanguage} />
      {route.page === 'home' && <HomePage language={language} />}
      {route.page === 'tutorials' && <TutorialsPage language={language} />}
      {route.page === 'tutorial-ecosystem' && <TutorialEcosystemPage language={language} />}
      {route.page === 'tutorial-detail' && activeTutorial && <TutorialDetailPage language={language} tutorial={activeTutorial} />}
      {route.page === 'tutorial-detail' && !activeTutorial && <TutorialNotFound language={language} />}
      {route.page === 'faq' && <FaqPage language={language} />}
      <Footer language={language} />
    </main>
  )
}

function Header({
  language,
  page,
  onLanguageChange,
}: {
  language: Language
  page: AppPage
  onLanguageChange: (language: Language) => void
}) {
  const t = copy[language]
  const otherLanguage: Language = language === 'zh' ? 'en' : 'zh'
  const githubLabel = language === 'zh' ? '在 GitHub 查看源码' : 'View source on GitHub'
  const languageHref = page === 'tutorial-detail'
    ? tutorialPath(otherLanguage, resolveRoute(window.location.pathname).tutorialSlug || '')
    : page === 'tutorial-ecosystem'
      ? tutorialEcosystemPath(otherLanguage)
      : pathFor(otherLanguage, page)

  return (
    <header className="site-header-wrap">
      <div className="shell site-header">
        <a className="brand" href={pathFor(language, 'home')} aria-label="MiniMax H3 Cases & Guides">
          <img className="brand-icon" src="/icon.svg" alt="" width="32" height="32" />
          <span className="brand-name">MiniMax H3<strong> Cases &amp; Guides</strong></span>
        </a>
        <nav aria-label={language === 'zh' ? '主导航' : 'Primary navigation'}>
          <a href={pathFor(language, 'home')} aria-current={page === 'home' ? 'page' : undefined}>{t.nav.cases}</a>
          <a href={pathFor(language, 'tutorials')} aria-current={page === 'tutorials' || page === 'tutorial-detail' || page === 'tutorial-ecosystem' ? 'page' : undefined}>{t.nav.tutorials}</a>
          <a href={pathFor(language, 'faq')} aria-current={page === 'faq' ? 'page' : undefined}>{t.nav.faq}</a>
        </nav>
        <div className="header-actions">
          <a
            className="language-button"
            href={`${languageHref}${window.location.search}${window.location.hash}`}
            aria-label={language === 'zh' ? '切换到英文' : 'Switch to Chinese'}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onLanguageChange(otherLanguage)
            }}
          >
            <Languages size={14} aria-hidden="true" /> {t.nav.language}
          </a>
          <a
            className="source-button"
            href="https://github.com/SkyNotSilent/awesome-minimax-h3-cases"
            target="_blank"
            rel="noreferrer"
            aria-label={githubLabel}
            title={githubLabel}
          >
            <GitHubMark />
          </a>
        </div>
      </div>
    </header>
  )
}

function IntroSplash({ language }: { language: Language }) {
  const [phase, setPhase] = useState<'visible' | 'leaving' | 'gone'>('visible')
  const t = copy[language].intro
  const introStyle = { '--intro-offset': `-${initialIntroOffset}ms` } as CSSProperties

  useEffect(() => {
    document.body.classList.add('intro-open')
    const leaveTimer = window.setTimeout(() => setPhase('leaving'), Math.max(0, 1_600 - initialIntroOffset))
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
    <aside
      className={`intro-splash ${phase === 'leaving' ? 'is-leaving' : ''}`}
      aria-label={t.description}
      style={introStyle}
    >
      <div className="intro-grid" aria-hidden="true" />
      <div className="intro-topline">
        <span><i /> {t.kicker}</span>
        <button type="button" onClick={skip}>{t.skip} <ArrowUpRight size={13} /></button>
      </div>
      <div className="intro-proof-card intro-proof-cases">
        <small>{t.caseEyebrow}</small>
        <strong>{projectStats.cases}</strong>
        <p>{t.caseLabel}</p>
        <em>
          <span>{completePromptCount} {t.promptAvailableLabel}</span>
          <span>{unpublishedPromptCount} {t.promptUnavailableLabel}</span>
        </em>
      </div>
      <div className="intro-proof-card intro-proof-update">
        <small>{t.updateEyebrow}</small>
        <strong>{t.updateValue}</strong>
        <p>{t.updateLabel}</p>
        <em>{t.updateFootnote}</em>
      </div>
      <svg className="intro-proof-connection" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="intro-flow-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d9ff43" stopOpacity="0.08" />
            <stop offset="0.48" stopColor="#d9ff43" stopOpacity="0.6" />
            <stop offset="1" stopColor="#76e8bd" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <path className="intro-flow-glow" pathLength="1" d="M 150 135 C 235 190, 205 500, 850 465" />
        <path className="intro-flow-line" pathLength="1" d="M 150 135 C 235 190, 205 500, 850 465" />
        <circle cx="150" cy="135" r="3.5" />
        <circle cx="850" cy="465" r="3.5" />
      </svg>
      <div className="intro-wordmark" aria-hidden="true">
        <span>{t.lineOne}</span>
        <strong>{t.lineTwo}</strong>
      </div>
      <div className="intro-proof-verdict" aria-hidden="true">
        <i />
        <span><b>{projectStats.cases}</b> {t.proofLine}</span>
        <i />
      </div>
      <div className="intro-bottomline">
        <p>{t.summary}</p>
        <div className="intro-ready"><span /> {t.ready} · {projectStats.cases}</div>
      </div>
      <div className="intro-progress" aria-hidden="true"><span /></div>
    </aside>
  )
}

function HomePage({ language }: { language: Language }) {
  const t = copy[language]
  const [activeDuration, setActiveDuration] = useState<DurationRange>('ALL')
  const [promptOnly, setPromptOnly] = useState(() => new URLSearchParams(window.location.search).get('prompt') === '1')
  const [activeCollection, setActiveCollection] = useState<CaseCollection>(() => {
    const requested = new URLSearchParams(window.location.search).get('collection')
    return collectionKeys.includes(requested as CaseCollection) ? requested as CaseCollection : 'all'
  })
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(favoriteStorageKey) || '[]')
      return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [])
    } catch {
      return new Set()
    }
  })
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [activeStyle, setActiveStyle] = useState('ALL')
  const [activeScene, setActiveScene] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VideoCase | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (promptOnly) url.searchParams.set('prompt', '1')
    else url.searchParams.delete('prompt')
    if (activeCollection !== 'all') url.searchParams.set('collection', activeCollection)
    else url.searchParams.delete('collection')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [activeCollection, promptOnly])

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        window.localStorage.setItem(favoriteStorageKey, JSON.stringify([...next]))
      } catch {
        // Favorites remain available for the current session when storage is blocked.
      }
      return next
    })
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = cases.filter((item) => {
      const matchesDuration = activeDuration === 'ALL'
        || (activeDuration === 'UP_TO_5' && item.duration <= 5)
        || (activeDuration === 'SIX_TO_10' && item.duration > 5 && item.duration <= 10)
        || (activeDuration === 'ELEVEN_TO_15' && item.duration > 10 && item.duration <= 15)
        || (activeDuration === 'OVER_15' && item.duration > 15)
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory
      const matchesStyle = activeStyle === 'ALL' || item.styles.includes(activeStyle)
      const matchesScene = activeScene === 'ALL' || item.scenes.includes(activeScene)
      const prompt = casePrompt(item, language)
      const matchesPrompt = !promptOnly || (typeof prompt === 'string' && prompt.trim().length > 0)
      const matchesCollection = activeCollection === 'all'
        || (activeCollection === 'featured' && featuredCaseIds.has(item.id))
        || (activeCollection === 'latest' && latestCaseIds.has(item.id))
        || (activeCollection === 'prompt' && item.promptProvenance !== 'not-published' && Boolean(item.prompt?.trim()))
        || (activeCollection === 'official' && item.sourceType === 'official')
        || (activeCollection === 'long' && item.duration > 15)
        || (activeCollection === 'favorites' && favorites.has(item.id))
      const haystack = language === 'zh'
        ? [item.title, item.summary, prompt, item.author, item.sourceLabel, ...item.tags, item.category, ...item.styles, ...item.scenes]
        : [item.titleEn, item.summaryEn, prompt, item.author, item.category, ...item.styles, ...item.scenes]
      return matchesDuration && matchesCategory && matchesStyle && matchesScene && matchesPrompt && matchesCollection
        && (!needle || haystack.filter(Boolean).join(' ').toLowerCase().includes(needle))
    })
    return activeCollection === 'latest'
      ? matching.sort((a, b) => Date.parse(b.approvedAt ?? b.publishedAt) - Date.parse(a.approvedAt ?? a.publishedAt))
      : matching
  }, [activeCategory, activeCollection, activeDuration, activeScene, activeStyle, favorites, language, promptOnly, query])

  const advancedCount = [activeCategory, activeStyle, activeScene].filter((value) => value !== 'ALL').length

  return (
    <>
      <IntroSplash language={language} />
      <section className="catalog shell" id="catalog">
        <div className="catalog-bar">
          <div className="catalog-heading">
            <p className="section-index">{t.catalog.index}</p>
            <h1>{t.catalog.title}</h1>
          </div>
          <div className="catalog-support">
            <p>{t.catalog.description}</p>
            <label className="search-box">
              <Search size={19} aria-hidden="true" />
              <span className="sr-only">{t.catalog.searchLabel}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.catalog.searchPlaceholder}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label={t.catalog.clearSearch}>
                  <X size={17} />
                </button>
              )}
            </label>
          </div>
        </div>

        <div className="primary-filter" aria-label={t.catalog.filterLabel}>
          <div className="filter-label"><Clock3 size={15} aria-hidden="true" /> {t.catalog.duration}</div>
          <div className="primary-filter-controls">
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
            <button
              type="button"
              className={`prompt-only-toggle${promptOnly ? ' active' : ''}`}
              role="switch"
              aria-checked={promptOnly}
              onClick={() => setPromptOnly((current) => !current)}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>{t.catalog.promptOnly}</span>
              <i aria-hidden="true"><b /></i>
            </button>
          </div>
        </div>

        <div className="case-collections" role="group" aria-label={t.catalog.collectionsLabel}>
          <span><Star size={13} aria-hidden="true" /> {t.catalog.collectionsLabel}</span>
          <div>
            {collectionKeys.map((collection) => (
              <button
                type="button"
                key={collection}
                className={activeCollection === collection ? 'active' : ''}
                aria-pressed={activeCollection === collection}
                onClick={() => setActiveCollection(collection)}
              >
                {t.catalog.collections[collection]}
                {collection === 'favorites' && favorites.size > 0 ? <small>{favorites.size}</small> : null}
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
            <CaseCard
              key={item.id}
              item={item}
              index={index}
              language={language}
              onOpen={() => setSelected(item)}
              isFavorite={favorites.has(item.id)}
              onFavorite={() => toggleFavorite(item.id)}
            />
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
  isFavorite,
  onFavorite,
}: {
  item: VideoCase
  index: number
  language: Language
  onOpen: () => void
  isFavorite: boolean
  onFavorite: () => void
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
      <button
        className={`case-favorite${isFavorite ? ' active' : ''}`}
        type="button"
        aria-label={isFavorite ? copy[language].catalog.favoriteRemove : copy[language].catalog.favoriteAdd}
        aria-pressed={isFavorite}
        title={isFavorite ? copy[language].catalog.favoriteRemove : copy[language].catalog.favoriteAdd}
        onClick={onFavorite}
      >
        <Bookmark size={16} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
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

function formatMetric(value: number | undefined, language: Language) {
  if (value === undefined) return null
  return new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function buildTutorialAiTask(tutorial: TutorialGuide, language: Language) {
  const t = copy[language].tutorials
  const section = (label: string, lines: string[]) => lines.length
    ? `${label}:\n${lines.map((line) => `- ${line}`).join('\n')}`
    : ''
  const commands = tutorial.commands.length
    ? `${t.commands}:\n${tutorial.commands.map((command) => `- ${command}`).join('\n')}`
    : ''
  const checks = tutorial.checks ? section(t.checks, tutorial.checks[language]) : ''
  const expectedResult = tutorial.expectedResult ? `${t.expectedResult}: ${tutorial.expectedResult[language]}` : ''
  const troubleshooting = tutorial.troubleshooting?.length
    ? `${t.troubleshooting}:\n${tutorial.troubleshooting.map((item) => `- ${item.problem[language]} → ${item.solution[language]}`).join('\n')}`
    : ''
  const versions = tutorial.testedVersions?.length ? `${t.testedVersions}: ${tutorial.testedVersions.join(' · ')}` : ''
  const guardrail = language === 'zh'
    ? '执行约束：先核验来源项目的最新 README 与版本；不得猜测缺失步骤、命令、参数或素材；涉及付费云资源时先估算费用；任何不确定项先停下说明。'
    : 'Execution guardrail: verify the latest source README and versions first; never guess missing steps, commands, parameters, or media; estimate cost before using paid cloud resources; stop and explain any uncertainty.'

  return [
    `MiniMax H3 — ${tutorial.title[language]}`,
    `${t.goal}: ${tutorial.outcome[language]}`,
    `${t.audience}: ${tutorial.audience[language]}`,
    `${t.hardware}: ${tutorial.hardware[language]}`,
    section(t.prerequisites, tutorial.prerequisites[language]),
    section(t.steps, tutorial.steps[language]),
    commands,
    checks,
    expectedResult,
    troubleshooting,
    versions,
    section(t.caveats, tutorial.caveats[language]),
    `${t.source}: ${tutorial.source.url}`,
    guardrail,
  ].filter(Boolean).join('\n\n')
}

function CopyCommandButton({ command, language }: { command: string; language: Language }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const label = language === 'zh' ? '复制命令' : 'Copy command'
  const copyCommand = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(command)
      setState('copied')
    } catch {
      setState('failed')
    }
    window.setTimeout(() => setState('idle'), 1_800)
  }
  return (
    <button type="button" onClick={copyCommand} aria-label={`${label}: ${command}`}>
      {state === 'copied' ? <Check size={13} /> : <Clipboard size={13} />}
      {state === 'copied'
        ? (language === 'zh' ? '已复制' : 'Copied')
        : state === 'failed'
          ? (language === 'zh' ? '复制失败，请手动选择' : 'Copy failed; select manually')
          : label}
    </button>
  )
}

function CopyTutorialButton({ tutorial, language, compact = false }: { tutorial: TutorialGuide; language: Language; compact?: boolean }) {
  const t = copy[language].tutorials
  const [state, setState] = useState<'idle' | 'copied' | 'fallback'>('idle')
  const task = useMemo(() => buildTutorialAiTask(tutorial, language), [language, tutorial])

  const copyTask = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(task)
      setState('copied')
      window.setTimeout(() => setState('idle'), 1_800)
    } catch {
      setState('fallback')
    }
  }

  return (
    <div className={`tutorial-copy-wrap ${compact ? 'is-compact' : ''}`}>
      <button type="button" className="tutorial-copy-button" onClick={copyTask} aria-live="polite">
        {state === 'copied' ? <Check size={15} /> : <Clipboard size={15} />}
        {state === 'copied' ? t.copied : t.copyAi}
      </button>
      {state === 'fallback' && (
        <div className="tutorial-copy-fallback" role="status">
          <label>{t.copyFailed}<textarea readOnly value={task} aria-label={t.manualCopy} /></label>
          <button type="button" onClick={() => setState('idle')} aria-label={language === 'zh' ? '关闭手动复制' : 'Close manual copy'}><X size={14} /></button>
        </div>
      )}
    </div>
  )
}

function TutorialCardActions({ tutorial, language }: { tutorial: TutorialGuide; language: Language }) {
  const t = copy[language].tutorials
  return (
    <div className="tutorial-card-actions">
      <a href={tutorialPath(language, tutorial.id)}>{t.openGuide} <ArrowUpRight size={13} /></a>
      <CopyTutorialButton tutorial={tutorial} language={language} compact />
    </div>
  )
}

function TutorialsPage({ language }: { language: Language }) {
  const t = copy[language].tutorials
  const [activeCategory, setActiveCategory] = useState<(typeof tutorialCategories)[number]>('all')
  const [activeHardware, setActiveHardware] = useState<'all' | TutorialHardwareProfile>('all')
  const [query, setQuery] = useState('')
  const foundations = tutorialGuides.filter((item) => item.contentType === 'foundation')

  const community = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tutorialGuides.filter((item) => {
      if (item.contentType !== 'community') return false
      const categoryMatches = activeCategory === 'all' || item.category === activeCategory
      const hardwareMatches = activeHardware === 'all' || item.hardwareProfiles?.includes(activeHardware)
      const searchable = [
        item.title[language],
        item.outcome[language],
        item.audience[language],
        item.hardware[language],
        ...item.prerequisites[language],
        ...item.steps[language],
        ...item.tags,
        item.source.author,
        item.source.handle || '',
      ].join(' ').toLowerCase()
      return categoryMatches && hardwareMatches && (!needle || searchable.includes(needle))
    })
  }, [activeCategory, activeHardware, language, query])

  const hardwareLabels: Record<'all' | TutorialHardwareProfile, string> = language === 'zh' ? {
    all: '全部硬件',
    'apple-silicon': 'Apple Silicon',
    'vram-8': '8GB 显存',
    'vram-12': '12GB 显存',
    'vram-16': '16GB 显存',
    'vram-24-plus': '24GB+ 显存',
    'cloud-gpu': '云 GPU',
  } : {
    all: 'All hardware',
    'apple-silicon': 'Apple Silicon',
    'vram-8': '8GB VRAM',
    'vram-12': '12GB VRAM',
    'vram-16': '16GB VRAM',
    'vram-24-plus': '24GB+ VRAM',
    'cloud-gpu': 'Cloud GPU',
  }

  return (
    <div className="standalone-page tutorials-page">
      <section className="tutorial-hub shell" aria-label={copy[language].nav.tutorials}>
        <header className="tutorial-index-header">
          <p>{t.index} / {foundations.length + tutorialGuides.filter((item) => item.contentType === 'community').length}</p>
          <h1>{t.title}</h1>
        </header>
        <header className="tutorial-list-heading">
          <h2>{t.foundationTitle}</h2>
          <span>{String(foundations.length).padStart(2, '0')}</span>
        </header>
        <div className="foundation-route-grid">
          {foundations.map((tutorial, index) => (
            <article className="foundation-route-card" key={tutorial.id}>
              <a className="foundation-route-poster" href={tutorialPath(language, tutorial.id)}>
                <img src={tutorial.posterUrl} alt={tutorial.title[language]} />
                <span>{String(index + 1).padStart(2, '0')}</span>
              </a>
              <div className="foundation-route-copy">
                <small>{t.routeLabel} / {tutorial.tags[0]}</small>
                <h3><a href={tutorialPath(language, tutorial.id)}>{tutorial.title[language]}</a></h3>
                <TutorialCardActions tutorial={tutorial} language={language} />
              </div>
            </article>
          ))}
        </div>

        <header className="tutorial-list-heading is-community">
          <h2>{t.communityTitle}</h2>
          <span>{String(tutorialGuides.filter((item) => item.contentType === 'community').length).padStart(2, '0')}</span>
        </header>
        <div className="tutorial-pathways">
          <div>
            <small>{t.learnByGoal}</small>
            <nav aria-label={t.learnByGoal}>
              {tutorialCategories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={activeCategory === category ? 'active' : ''}
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                >{t.categories[category]}</button>
              ))}
            </nav>
          </div>
          <div>
            <small>{t.learnByHardware}</small>
            <nav aria-label={t.learnByHardware}>
              {(['all', ...hardwareProfiles] as const).map((profile) => (
                <button
                  type="button"
                  key={profile}
                  className={activeHardware === profile ? 'active' : ''}
                  aria-pressed={activeHardware === profile}
                  onClick={() => setActiveHardware(profile)}
                >{hardwareLabels[profile]}</button>
              ))}
            </nav>
          </div>
          <a href={tutorialEcosystemPath(language)}><BookOpen size={17} /> <span><strong>{t.ecosystemTitle}</strong><small>{t.ecosystemCta}</small></span><ChevronRight size={18} /></a>
        </div>
        <div className="tutorial-controls">
          <label className="tutorial-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{t.searchLabel}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label={t.clearSearch}><X size={14} /></button>}
          </label>
          <p className="tutorial-active-filter" aria-live="polite">{t.categories[activeCategory]} · {hardwareLabels[activeHardware]}</p>
        </div>

        {community.length > 0 ? (
          <div className="community-tutorial-grid">
            {community.map((tutorial) => (
              <article className="community-tutorial-card" key={tutorial.id}>
                <a className="community-tutorial-poster" href={tutorialPath(language, tutorial.id)}>
                  <img src={tutorial.posterUrl} alt={tutorial.title[language]} loading="lazy" />
                  <span>{t.communityLabel}</span>
                  {tutorial.engagement && (
                    <em>{formatMetric(tutorial.engagement.likes, language)} {t.likes} · {formatMetric(tutorial.engagement.views, language)} {t.views}</em>
                  )}
                </a>
                <div className="community-tutorial-copy">
                  <small>{t.categories[tutorial.category]} / {tutorial.source.handle || tutorial.source.author}</small>
                  <h3><a href={tutorialPath(language, tutorial.id)}>{tutorial.title[language]}</a></h3>
                  <p>{tutorial.outcome[language]}</p>
                  <TutorialCardActions tutorial={tutorial} language={language} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tutorial-empty"><span>00</span><p>{t.noResults}</p></div>
        )}
      </section>
    </div>
  )
}

function TutorialDetailPage({ language, tutorial }: { language: Language; tutorial: TutorialGuide }) {
  const t = copy[language].tutorials
  const resources = tutorial.relatedResourceIds
    .map((id) => tutorialResources.find((resource) => resource.id === id))
    .filter((resource): resource is TutorialResource => Boolean(resource))
  const related = tutorialGuides
    .filter((item) => item.id !== tutorial.id && item.category === tutorial.category)
    .slice(0, 3)
  const engagementItems: Array<[string, number]> = tutorial.engagement ? [
    [t.replies, tutorial.engagement.replies] as const,
    [t.reposts, tutorial.engagement.reposts] as const,
    [t.likes, tutorial.engagement.likes] as const,
    [t.views, tutorial.engagement.views] as const,
  ].flatMap(([label, value]) => value === undefined ? [] : [[label, value]]) : []

  return (
    <div className="standalone-page tutorial-detail-page">
      <article className="tutorial-detail shell">
        <a className="tutorial-back" href={pathFor(language, 'tutorials')}><ChevronRight size={14} /> {t.back}</a>
        <header className="tutorial-detail-hero">
          <div className="tutorial-detail-poster"><img src={tutorial.posterUrl} alt={tutorial.title[language]} /></div>
          <div className="tutorial-detail-heading">
            <p>{tutorial.contentType === 'foundation' ? t.routeLabel : t.communityLabel} / {t.categories[tutorial.category]}</p>
            <h1>{tutorial.title[language]}</h1>
            <strong>{tutorial.outcome[language]}</strong>
            <div className="resource-tags">{tutorial.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="tutorial-detail-actions">
              {tutorial.contentType === 'community' && <a href={tutorial.source.url} target="_blank" rel="noreferrer">{t.openSource} <ArrowUpRight size={15} /></a>}
              <CopyTutorialButton tutorial={tutorial} language={language} />
            </div>
          </div>
        </header>

        <div className="tutorial-detail-layout">
          <main className="tutorial-detail-content">
            {(tutorial.difficulty || tutorial.estimatedMinutes || tutorial.testedVersions?.length) && (
              <section className="tutorial-run-profile">
                <h2>{language === 'zh' ? '执行概览' : 'Run profile'}</h2>
                <dl>
                  {tutorial.difficulty && <div><dt>{t.difficulty}</dt><dd>{tutorial.difficulty}</dd></div>}
                  {tutorial.estimatedMinutes && <div><dt>{t.estimatedTime}</dt><dd>{tutorial.estimatedMinutes} {t.minutes}</dd></div>}
                  {tutorial.testedVersions?.length && <div><dt>{t.testedVersions}</dt><dd>{tutorial.testedVersions.join(' · ')}</dd></div>}
                </dl>
              </section>
            )}
            <section><h2>{t.audience}</h2><p>{tutorial.audience[language]}</p></section>
            <section><h2>{t.hardware}</h2><p>{tutorial.hardware[language]}</p></section>
            <section><h2>{t.prerequisites}</h2><ul>{tutorial.prerequisites[language].map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section className="tutorial-detail-steps"><h2>{t.steps}</h2><ol>{tutorial.steps[language].map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></li>)}</ol></section>
            {tutorial.commands.length > 0 && <section><h2>{t.commands}</h2><div className="tutorial-detail-commands">{tutorial.commands.map((command) => <div key={command}><code>{command}</code><CopyCommandButton command={command} language={language} /></div>)}</div></section>}
            {tutorial.checks && <section className="tutorial-detail-checks"><h2>{t.checks}</h2><ul>{tutorial.checks[language].map((item) => <li key={item}><Check size={15} aria-hidden="true" /> <span>{item}</span></li>)}</ul></section>}
            {tutorial.expectedResult && <section className="tutorial-expected-result"><h2>{t.expectedResult}</h2><p>{tutorial.expectedResult[language]}</p></section>}
            {tutorial.troubleshooting?.length && <section className="tutorial-troubleshooting"><h2>{t.troubleshooting}</h2><dl>{tutorial.troubleshooting.map((item) => <div key={item.problem[language]}><dt>{item.problem[language]}</dt><dd>{item.solution[language]}</dd></div>)}</dl></section>}
            {tutorial.uninstall && <section><h2>{t.uninstall}</h2><ul>{tutorial.uninstall[language].map((item) => <li key={item}>{item}</li>)}</ul></section>}
            <section><h2>{t.caveats}</h2><ul>{tutorial.caveats[language].map((item) => <li key={item}>{item}</li>)}</ul><small className="tutorial-source-note">{t.sourceNote}</small></section>
          </main>
          <aside className="tutorial-detail-meta">
            <h2>{t.source}</h2>
            <dl>
              <div><dt>{language === 'zh' ? '作者' : 'Author'}</dt><dd>{tutorial.source.author} {tutorial.source.handle || ''}</dd></div>
              {tutorial.source.publishedAt && <div><dt>{language === 'zh' ? '发布' : 'Published'}</dt><dd>{tutorial.source.publishedAt}</dd></div>}
              <div><dt>{t.verified}</dt><dd>{tutorial.verifiedAt}</dd></div>
            </dl>
            {engagementItems.length > 0 && <div className="tutorial-engagement"><small>{t.snapshot} / {tutorial.engagement?.snapshotAt}</small>{engagementItems.map(([label, value]) => <span key={label}><strong>{formatMetric(value, language)}</strong>{label}</span>)}</div>}
            <a className="tutorial-meta-source" href={tutorial.source.url} target="_blank" rel="noreferrer">{tutorial.contentType === 'foundation' ? t.openReference : t.openSource} <ArrowUpRight size={14} /></a>
            {tutorial.sourceRefs?.map((reference) => <a className="tutorial-meta-source secondary" key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.title} <ArrowUpRight size={14} /></a>)}
          </aside>
        </div>

        {resources.length > 0 && (
          <section className="tutorial-related-resources">
            <h2>{t.related}</h2>
            <div>{resources.map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer"><small>{resource.kind[language]}</small><strong>{resource.title}</strong><p>{resource.description[language]}</p><span>{resource.action[language]} <ArrowUpRight size={13} /></span></a>)}</div>
          </section>
        )}
        {related.length > 0 && (
          <section className="tutorial-related-guides">
            <h2>{t.relatedGuides}</h2>
            <div>{related.map((item) => <a key={item.id} href={tutorialPath(language, item.id)}><img src={item.posterUrl} alt="" /><span><small>{t.categories[item.category]}</small><strong>{item.title[language]}</strong></span><ChevronRight size={18} /></a>)}</div>
          </section>
        )}
      </article>
    </div>
  )
}

function TutorialEcosystemPage({ language }: { language: Language }) {
  const t = copy[language].tutorials
  const guidesByResource = new Map<string, TutorialGuide>()
  tutorialGuides
    .slice()
    .sort((a, b) => Number(Boolean(b.flagship)) - Number(Boolean(a.flagship)))
    .forEach((guide) => guide.relatedResourceIds.forEach((resourceId) => {
      if (!guidesByResource.has(resourceId)) guidesByResource.set(resourceId, guide)
    }))
  const limitationByCategory: Record<TutorialResource['category'], string> = language === 'zh' ? {
    mac: '仅适用于 Apple Silicon；完整权重会占用较多内存与磁盘。',
    official: '官方基线优先保证可复现，不代表当前硬件上的最快配置。',
    workflow: '必须先跑通对应基础模型与依赖，再导入工作流。',
    acceleration: '加速结论依赖显卡、分辨率与步数，必须在自己的机器上复测。',
    'long-video': '跨片段连续性仍属实验能力，连接点需要逐段检查。',
    audio: '实验节点较多，应从稳定链路开始并单独核验声音。',
    training: '训练成本高，先用小数据集和固定验证样例做短跑。',
    resources: '资源目录用于发现，命令与版本必须回到原仓库核验。',
  } : {
    mac: 'Apple Silicon only; full weights require substantial memory and disk space.',
    official: 'The official baseline prioritizes reproducibility, not the fastest configuration for every machine.',
    workflow: 'Get the base model and dependencies working before importing any workflow.',
    acceleration: 'Speed claims vary by GPU, resolution, and step count; benchmark on your own machine.',
    'long-video': 'Cross-clip continuity is experimental and every join needs inspection.',
    audio: 'Several nodes are experimental; start from the stable path and verify audio separately.',
    training: 'Training is expensive; begin with a small dataset and a fixed validation sample.',
    resources: 'Directories are for discovery; verify commands and versions in the source repository.',
  }

  return (
    <div className="standalone-page ecosystem-page">
      <section className="ecosystem shell">
        <a className="tutorial-back" href={pathFor(language, 'tutorials')}><ChevronRight size={14} /> {t.back}</a>
        <header className="ecosystem-hero">
          <p>03 / OPEN SOURCE MAP</p>
          <h1>{t.ecosystemTitle}</h1>
          <span>{t.ecosystemDescription}</span>
        </header>
        <div className="ecosystem-grid">
          {tutorialResources
            .slice()
            .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
            .map((resource) => {
              const relatedGuide = guidesByResource.get(resource.id)
              return <article key={resource.id} className="ecosystem-card">
                <header>
                  <small>{resource.code} / {resource.kind[language]}</small>
                  {resource.stars !== undefined && <span><Star size={12} fill="currentColor" /> {formatMetric(resource.stars, language)}</span>}
                </header>
                <h2>{resource.title}</h2>
                <p>{resource.description[language]}</p>
                <dl>
                  <div><dt>{t.requirements}</dt><dd>{resource.requirements?.[language] ?? resource.audience[language]}</dd></div>
                  <div><dt>{t.strengths}</dt><dd>{resource.strengths?.[language]?.join(' · ') ?? resource.facts.join(' · ')}</dd></div>
                  <div><dt>{t.limitations}</dt><dd>{resource.limitations?.[language]?.join(' ') ?? limitationByCategory[resource.category]}</dd></div>
                </dl>
                <footer>
                  <small>{t.starsSnapshot}: {resource.snapshotAt ?? resource.verifiedAt}</small>
                  <div>
                    {relatedGuide && <a className="ecosystem-site-guide" href={tutorialPath(language, relatedGuide.id)}>{t.openSiteGuide} <ChevronRight size={14} /></a>}
                    <a href={resource.url} target="_blank" rel="noreferrer">{resource.action[language]} <ArrowUpRight size={14} /></a>
                  </div>
                </footer>
              </article>
            })}
        </div>
      </section>
    </div>
  )
}

function TutorialNotFound({ language }: { language: Language }) {
  return (
    <div className="standalone-page tutorial-not-found shell">
      <span>404</span>
      <h1>{language === 'zh' ? '这篇教程不存在。' : 'This tutorial does not exist.'}</h1>
      <a href={pathFor(language, 'tutorials')}>{copy[language].tutorials.back}</a>
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
              <p className="prompt-notice">
                {t.promptPublished} · {t.promptNotice}
                {item.promptSourceUrl ? (
                  <a href={item.promptSourceUrl} target="_blank" rel="noreferrer">
                    {t.promptSource} <ArrowUpRight size={11} />
                  </a>
                ) : null}
                {item.archiveSourceUrl ? (
                  <a href={item.archiveSourceUrl} target="_blank" rel="noreferrer">
                    {t.archiveSource} <ArrowUpRight size={11} />
                  </a>
                ) : null}
              </p>
              <pre>{prompt}</pre>
            </div>
          ) : (
            <p className="prompt-unavailable">{t.promptUnavailable}</p>
          )}
          <a className="original-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
            {t.source} · {sourceLabel(item, language)} <ArrowUpRight size={15} />
          </a>
          {!hasPublishedPrompt && item.archiveSourceUrl ? (
            <a className="original-link" href={item.archiveSourceUrl} target="_blank" rel="noreferrer">
              {t.archiveSource} <ArrowUpRight size={15} />
            </a>
          ) : null}
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
      <span>MINIMAX H3 CASES &amp; GUIDES — 2026</span>
    </footer>
  )
}

export default App
