import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpRight as TrendUp,
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
  Users,
  X,
} from 'lucide-react'
import rawCases from '../data/cases.json'
import rawCreators from '../data/creators.json'
import rawProjectStats from '../data/project-stats.json'
import rawTutorialGuides from '../data/tutorial-guides.json'
import rawTutorials from '../data/tutorials.json'
import {
  loadCaseDetail,
  loadCatalog,
  loadCreators,
  loadSearchIndex,
  loadTutorialGuides,
  loadTutorialResources,
} from './data-client'
import {
  casePath,
  caseTitle,
  copy,
  creatorPath,
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
import type { CaseDetail, CatalogCase, CatalogPayload, CreatorCatalog, CreatorProfile, CreatorRankKey, SearchRecord, TutorialCategory, TutorialGuide, TutorialHardwareProfile, TutorialResource, VideoCase } from './types'
import { XPostEmbed } from './XPostEmbed'
import {
  addedDatePresets,
  formatAddedDate,
  matchesAddedDate,
  maxAddedAt,
  parseAddedDatePreset,
  parseSince,
  updatesSeenThroughKey,
  type AddedDatePreset,
} from './updates'

const testCases = import.meta.env.MODE === 'test' ? rawCases as VideoCase[] : null
const testCreatorCatalog = import.meta.env.MODE === 'test' ? rawCreators as CreatorCatalog : null
const testTutorialResources = import.meta.env.MODE === 'test' ? rawTutorials as TutorialResource[] : null
const testTutorialGuides = import.meta.env.MODE === 'test' ? rawTutorialGuides as TutorialGuide[] : null
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
const favoriteStorageKey = 'minimax-h3-favorite-cases'
const favoriteCreatorStorageKey = 'minimax-h3-favorite-creators'
const collectionKeys = ['all', 'featured', 'latest', 'prompt', 'official', 'long', 'favorites'] as const
type CaseCollection = (typeof collectionKeys)[number]
const hardwareProfiles: TutorialHardwareProfile[] = [
  'apple-silicon',
  'vram-8',
  'vram-12',
  'vram-16',
  'vram-24-plus',
  'cloud-gpu',
]

interface UpdateSession {
  since: string | null
  through: string
  caseIds: Set<string>
  tutorialIds: Set<string>
  initialPreset: AddedDatePreset
  storageAvailable: boolean
}

function catalogCase(item: VideoCase): CatalogCase {
  return {
    id: item.id,
    title: item.title,
    titleEn: item.titleEn,
    mode: item.mode,
    posterUrl: item.posterUrl,
    duration: item.duration,
    category: item.category,
    styles: item.styles,
    scenes: item.scenes,
    tags: item.tags,
    author: item.author,
    addedAt: item.addedAt,
    mediaUrl: item.mediaUrl ?? null,
    sourceUrl: item.sourceUrl,
    sourceType: item.sourceType,
    verified: item.verified,
    hasPrompt: item.promptProvenance !== 'not-published' && Boolean(item.prompt?.trim()),
  }
}

function caseDetail(item: VideoCase): CaseDetail {
  return {
    id: item.id,
    summary: item.summary,
    summaryEn: item.summaryEn,
    prompt: item.prompt,
    ...(item.promptSourceUrl ? { promptSourceUrl: item.promptSourceUrl } : {}),
    model: item.model,
    sourceLabel: item.sourceLabel,
    publishedAt: item.publishedAt,
    aspectRatio: item.aspectRatio,
    resolution: item.resolution,
    promptProvenance: item.promptProvenance,
  }
}

const testCatalog: CatalogPayload | null = testCases && testTutorialGuides ? {
  version: 1,
  generatedAt: maxAddedAt([...testCases, ...testTutorialGuides]),
  cases: testCases.map(catalogCase),
  tutorials: testTutorialGuides.map(({ id, addedAt }) => ({ id, addedAt })),
} : null
const testDetails = new Map(testCases?.map((item) => [item.id, caseDetail(item)]) ?? [])
const emptyCatalogCases: CatalogCase[] = []

function createUpdateSession(cases: readonly CatalogCase[], tutorials: ReadonlyArray<{ id: string; addedAt: string }>): UpdateSession {
  const latestAddedAt = maxAddedAt([...cases, ...tutorials])
  const params = new URLSearchParams(window.location.search)
  const rawPreset = params.get('added')
  const requestedPreset = parseAddedDatePreset(rawPreset)
  const invalidPreset = rawPreset !== null && requestedPreset === 'all' && rawPreset !== 'all'
  const rawSince = params.get('since')
  const requestedSince = parseSince(rawSince)
  const invalidSince = requestedPreset === 'unseen' && rawSince !== null && requestedSince === null

  let storedSince: string | null = null
  let storageAvailable = true
  try {
    storedSince = parseSince(window.localStorage.getItem(updatesSeenThroughKey))
  } catch {
    storageAvailable = false
  }

  const since = requestedPreset === 'unseen' && requestedSince
    ? requestedSince
    : storedSince ?? latestAddedAt
  const caseIds = new Set(cases.filter((item) => matchesAddedDate(item.addedAt, 'unseen', since)).map((item) => item.id))
  const tutorialIds = new Set(tutorials.filter((item) => matchesAddedDate(item.addedAt, 'unseen', since)).map((item) => item.id))
  const hasExplicitFilter = ['collection', 'added', 'since', 'prompt'].some((key) => params.has(key))
  const shouldAutoOpen = storageAvailable && Boolean(storedSince) && !hasExplicitFilter && caseIds.size + tutorialIds.size > 0
  const initialPreset = invalidPreset || invalidSince
    ? 'all'
    : shouldAutoOpen
      ? 'unseen'
      : requestedPreset

  return { since, through: latestAddedAt, caseIds, tutorialIds, initialPreset, storageAvailable }
}

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

interface OpenedCase {
  item: CatalogCase
  video: HTMLVideoElement | null
}

function prepareHostedVideo(item: CatalogCase) {
  if (!item.mediaUrl) return null
  if (import.meta.env.MODE !== 'test') {
    void fetch(item.mediaUrl, {
      headers: { Range: 'bytes=0-65535' },
      mode: 'no-cors',
    }).catch(() => undefined)
  }
  const video = document.createElement('video')
  video.poster = item.posterUrl
  video.controls = true
  video.autoplay = true
  video.playsInline = true
  video.preload = 'metadata'
  video.style.cssText = 'position:fixed;left:-2px;bottom:-2px;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.append(video)
  video.src = item.mediaUrl
  if (import.meta.env.MODE !== 'test') {
    video.load()
    video.play()?.catch(() => undefined)
  }
  return video
}

function HostedVideo({ item, language, title, preparedVideo }: { item: CatalogCase; language: Language; title: string; preparedVideo: HTMLVideoElement | null }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [video] = useState(() => preparedVideo ?? prepareHostedVideo(item))
  const mountRef = useRef<HTMLDivElement | null>(null)
  const loading = language === 'zh' ? '正在加载站内视频…' : 'Loading hosted video…'
  const failed = language === 'zh' ? '视频暂时无法加载' : 'Video is temporarily unavailable'
  const openX = language === 'zh' ? '在 X 打开原帖' : 'Open original post on X'

  useLayoutEffect(() => {
    if (!video || !mountRef.current) return
    const loading = () => setState('loading')
    const ready = () => setState('ready')
    const failed = () => setState('error')
    video.addEventListener('loadstart', loading)
    video.addEventListener('canplay', ready)
    video.addEventListener('error', failed)
    video.removeAttribute('style')
    mountRef.current.prepend(video)
    if (video.error) failed()
    else if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) ready()
    if (import.meta.env.MODE !== 'test') video.play()?.catch(() => undefined)
    return () => {
      if (import.meta.env.MODE !== 'test') video.pause()
      video.removeEventListener('loadstart', loading)
      video.removeEventListener('canplay', ready)
      video.removeEventListener('error', failed)
      video.remove()
    }
  }, [video])

  return (
    <div className="hosted-video" data-state={state} ref={mountRef}>
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
  const [catalog, setCatalog] = useState<CatalogPayload | null>(testCatalog)
  const [catalogError, setCatalogError] = useState(false)
  const [tutorialGuides, setTutorialGuides] = useState<TutorialGuide[] | null>(testTutorialGuides)
  const [tutorialResources, setTutorialResources] = useState<TutorialResource[] | null>(testTutorialResources)
  const [creatorCatalog, setCreatorCatalog] = useState<CreatorCatalog | null>(testCreatorCatalog)
  const [routeDataError, setRouteDataError] = useState(false)
  const language = route.language
  const t = copy[language]
  const reloadCatalog = useCallback(() => {
    setCatalogError(false)
    loadCatalog(true).then(setCatalog).catch(() => setCatalogError(true))
  }, [])

  useEffect(() => {
    if (catalog) return
    loadCatalog().then(setCatalog).catch(() => setCatalogError(true))
  }, [catalog])

  const needsTutorials = route.page === 'tutorials'
    || route.page === 'tutorial-detail'
    || route.page === 'tutorial-ecosystem'
    || route.page === 'creators'
    || route.page === 'creator-detail'
  const needsCreators = route.page === 'creators' || route.page === 'creator-detail'

  const reloadRouteData = useCallback(() => {
    setRouteDataError(false)
    const requests: Promise<unknown>[] = []
    if (needsTutorials) {
      requests.push(loadTutorialGuides(true).then(setTutorialGuides))
      requests.push(loadTutorialResources(true).then(setTutorialResources))
    }
    if (needsCreators) requests.push(loadCreators(true).then(setCreatorCatalog))
    Promise.all(requests).catch(() => setRouteDataError(true))
  }, [needsCreators, needsTutorials])

  useEffect(() => {
    const requests: Promise<unknown>[] = []
    if (needsTutorials && !tutorialGuides) {
      requests.push(loadTutorialGuides().then(setTutorialGuides))
      requests.push(loadTutorialResources().then(setTutorialResources))
    }
    if (needsCreators && !creatorCatalog) requests.push(loadCreators().then(setCreatorCatalog))
    if (requests.length) Promise.all(requests).catch(() => setRouteDataError(true))
  }, [creatorCatalog, needsCreators, needsTutorials, tutorialGuides])

  const updateSession = useMemo(
    () => catalog ? createUpdateSession(catalog.cases, catalog.tutorials) : null,
    [catalog],
  )
  const creators = creatorCatalog?.creators ?? []
  const activeTutorial = route.page === 'tutorial-detail' && tutorialGuides
    ? tutorialGuides.find((item) => item.id === route.tutorialSlug)
    : undefined
  const activeCreator = route.page === 'creator-detail' && creatorCatalog
    ? creators.find((item) => item.slug === route.creatorSlug || item.aliases.includes(route.creatorSlug ?? ''))
    : undefined
  const pageDescription = activeTutorial
    ? activeTutorial.outcome[language]
    : activeCreator
      ? language === 'zh'
        ? `${activeCreator.displayName} 的 MiniMax H3 案例、完整公开 Prompt 与实战教程。`
        : `MiniMax H3 cases, complete public Prompts, and field guides by ${activeCreator.displayName}.`
    : route.page === 'tutorials' || route.page === 'tutorial-ecosystem'
    ? t.tutorials.description
    : route.page === 'creators'
      ? t.creators.description
    : route.page === 'faq'
      ? t.faq.description
      : t.siteDescription
  const pageTitle = activeTutorial
    ? `${activeTutorial.title[language]} — MiniMax H3 Cases & Guides`
    : route.page === 'home'
    ? t.siteTitle
    : activeCreator
      ? `${activeCreator.displayName} — MiniMax H3 ${language === 'zh' ? '创作者案例与教程' : 'Creator Cases & Guides'}`
    : route.page === 'tutorials'
      ? language === 'zh'
        ? 'MiniMax H3 教程与工具：部署、工作流、加速、训练 — MiniMax H3 Cases & Guides'
        : 'MiniMax H3 Tutorials and Tools: Setup, Workflows, Speed, Training — MiniMax H3 Cases & Guides'
      : route.page === 'tutorial-ecosystem'
        ? language === 'zh'
          ? 'MiniMax H3 教程与工具生态 — MiniMax H3 Cases & Guides'
          : 'MiniMax H3 Tutorial and Tool Ecosystem — MiniMax H3 Cases & Guides'
      : route.page === 'creators'
        ? language === 'zh'
          ? 'MiniMax H3 优质创作者动态榜单 — MiniMax H3 Cases & Guides'
          : 'MiniMax H3 Featured Creator Leaderboard — MiniMax H3 Cases & Guides'
      : language === 'zh'
        ? 'MiniMax H3 视频案例库常见问题 — MiniMax H3 Cases & Guides'
        : 'MiniMax H3 Video Library FAQ — MiniMax H3 Cases & Guides'

  useEffect(() => {
    document.documentElement.lang = t.htmlLang
    document.title = pageTitle
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', pageDescription)
  }, [pageDescription, pageTitle, t.htmlLang])

  useEffect(() => {
    if (route.page !== 'creator-detail' || !activeCreator || route.creatorSlug === activeCreator.slug) return
    const canonical = creatorPath(language, activeCreator.slug)
    window.history.replaceState(window.history.state, '', `${canonical}${window.location.search}${window.location.hash}`)
  }, [activeCreator, language, route.creatorSlug, route.page])

  useEffect(() => {
    const handlePopState = () => setRoute(resolveRoute(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!updateSession?.storageAvailable || !updateSession.through) return
    try {
      window.localStorage.setItem(updatesSeenThroughKey, updateSession.through)
    } catch {
      // Date filters remain usable when local update state cannot be persisted.
    }
  }, [updateSession])

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
        : route.page === 'creator-detail' && activeCreator
          ? creatorPath(nextLanguage, activeCreator.slug)
        : pathFor(nextLanguage, route.page as Exclude<AppPage, 'tutorial-detail' | 'tutorial-ecosystem' | 'creator-detail'>)
    const nextPath = `${nextBasePath}${window.location.search}${window.location.hash}`
    window.history.pushState(window.history.state, '', nextPath)
    setRoute({ ...route, language: nextLanguage })
  }

  return (
    <main id="top">
      <div className="grain" aria-hidden="true" />
      <Header language={language} page={route.page} onLanguageChange={switchLanguage} />
      {route.page === 'home' && <HomePage language={language} updateSession={updateSession} catalog={catalog} catalogError={catalogError} onRetryCatalog={reloadCatalog} />}
      {route.page === 'tutorials' && tutorialGuides && updateSession && <TutorialsPage language={language} updateSession={updateSession} tutorialGuides={tutorialGuides} />}
      {route.page === 'tutorial-ecosystem' && tutorialGuides && tutorialResources && <TutorialEcosystemPage language={language} tutorialGuides={tutorialGuides} tutorialResources={tutorialResources} />}
      {route.page === 'tutorial-detail' && activeTutorial && tutorialGuides && tutorialResources && <TutorialDetailPage language={language} tutorial={activeTutorial} tutorialGuides={tutorialGuides} tutorialResources={tutorialResources} />}
      {route.page === 'tutorial-detail' && tutorialGuides && !activeTutorial && <TutorialNotFound language={language} />}
      {route.page === 'creators' && creatorCatalog && catalog && tutorialGuides && <CreatorsPage language={language} creatorCatalog={creatorCatalog} cases={catalog.cases} tutorialGuides={tutorialGuides} />}
      {route.page === 'creator-detail' && activeCreator && catalog && tutorialGuides && <CreatorDetailPage language={language} creator={activeCreator} cases={catalog.cases} tutorialGuides={tutorialGuides} />}
      {route.page === 'creator-detail' && creatorCatalog && !activeCreator && <CreatorNotFound language={language} />}
      {route.page !== 'home' && route.page !== 'faq' && ((!catalog && catalogError) || routeDataError) && <ResourceState language={language} failed onRetry={() => { reloadCatalog(); reloadRouteData() }} />}
      {route.page !== 'home' && route.page !== 'faq' && !routeDataError && (!catalog || (needsTutorials && !tutorialGuides) || (needsCreators && !creatorCatalog)) && <ResourceState language={language} />}
      {route.page === 'faq' && <FaqPage language={language} />}
      <Footer language={language} />
    </main>
  )
}

function ResourceState({ language, failed = false, onRetry }: { language: Language; failed?: boolean; onRetry?: () => void }) {
  return (
    <section className="resource-state shell" role={failed ? 'alert' : 'status'} aria-live="polite">
      <span>{failed ? '!' : '…'}</span>
      <p>{failed
        ? (language === 'zh' ? '内容加载失败，请重试。' : 'Content failed to load. Please retry.')
        : (language === 'zh' ? '正在加载内容…' : 'Loading content…')}</p>
      {failed && onRetry ? <button type="button" onClick={onRetry}>{language === 'zh' ? '重试' : 'Retry'}</button> : null}
    </section>
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
    : page === 'creator-detail'
      ? creatorPath(otherLanguage, resolveRoute(window.location.pathname).creatorSlug || '')
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
          <a href={pathFor(language, 'creators')} aria-current={page === 'creators' || page === 'creator-detail' ? 'page' : undefined}>{t.nav.creators}</a>
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

function AddedDateFilter({
  language,
  value,
  onChange,
  unseenCount,
}: {
  language: Language
  value: AddedDatePreset
  onChange: (value: AddedDatePreset) => void
  unseenCount: number
}) {
  const t = copy[language].catalog
  return (
    <div className="added-date-filter" role="group" aria-label={t.addedDateFilterLabel}>
      <span><Clock3 size={13} aria-hidden="true" /> {t.addedDateFilterLabel}</span>
      <div>
        {addedDatePresets.map((preset) => (
          <button
            type="button"
            key={preset}
            className={value === preset ? 'active' : ''}
            aria-pressed={value === preset}
            onClick={() => onChange(preset)}
          >
            {t.addedDatePresets[preset]}
            {preset === 'unseen' && unseenCount > 0 ? <small>{unseenCount}</small> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function UpdateSummary({ language }: { language: Language }) {
  const t = copy[language].catalog
  const latestUpdate = projectStats.latestUpdate
  if (!latestUpdate || latestUpdate.casesAdded + latestUpdate.promptsAdded + latestUpdate.tutorialsAdded === 0) return null

  return (
    <section className="update-summary has-updates" aria-live="polite">
      <div className="update-summary-index">
        <span>{t.updateSummaryIndex}</span>
        <strong>{t.updateSummaryStatus}</strong>
      </div>
      <div className="update-summary-copy">
        <h2>{t.updateSummaryTitle(latestUpdate.casesAdded, latestUpdate.promptsAdded, latestUpdate.tutorialsAdded)}</h2>
        <p>{t.updateSummaryDescription}</p>
      </div>
      <div className="update-summary-meta">
        <span>{t.lastAddedLabel}</span>
        <time dateTime={latestUpdate.publishedAt}>{formatAddedDate(latestUpdate.publishedAt, language)}</time>
        {latestUpdate.creatorRankingUpdated ? <strong>{t.creatorRankingUpdated}</strong> : null}
      </div>
    </section>
  )
}

function HomePage({
  language,
  updateSession,
  catalog,
  catalogError,
  onRetryCatalog,
}: {
  language: Language
  updateSession: UpdateSession | null
  catalog: CatalogPayload | null
  catalogError: boolean
  onRetryCatalog: () => void
}) {
  const t = copy[language]
  const cases = catalog?.cases ?? emptyCatalogCases
  const [activeDuration, setActiveDuration] = useState<DurationRange>('ALL')
  const [promptOnly, setPromptOnly] = useState(() => new URLSearchParams(window.location.search).get('prompt') === '1')
  const [activeCollection, setActiveCollection] = useState<CaseCollection>(() => {
    const requested = new URLSearchParams(window.location.search).get('collection')
    return collectionKeys.includes(requested as CaseCollection) ? requested as CaseCollection : 'all'
  })
  const [activeAddedDate, setActiveAddedDate] = useState<AddedDatePreset>(updateSession?.initialPreset ?? 'all')
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
  const deferredQuery = useDeferredValue(query)
  const [selected, setSelected] = useState<OpenedCase | null>(null)
  const [visibleCount, setVisibleCount] = useState(36)
  const [, startTransition] = useTransition()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const updateInitializedRef = useRef(Boolean(updateSession))
  const testSearchMap = useMemo(() => {
    if (!testCases) return null
    return new Map(testCases.map((item) => [item.id, (language === 'zh'
      ? [item.title, item.summary, item.prompt, item.author, item.sourceLabel, ...item.tags, item.category, ...item.styles, ...item.scenes]
      : [item.titleEn, item.summaryEn, item.prompt, item.author, item.category, ...item.styles, ...item.scenes]
    ).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase()]))
  }, [language])
  const [searchResource, setSearchResource] = useState<{
    language: Language
    state: 'idle' | 'loading' | 'ready' | 'error'
    records: Map<string, string> | null
  }>(() => ({ language, state: testSearchMap ? 'ready' : 'idle', records: testSearchMap }))
  const searchRecords = testSearchMap ?? (searchResource.language === language ? searchResource.records : null)
  const searchState = testSearchMap ? 'ready' : searchResource.language === language ? searchResource.state : 'idle'

  useEffect(() => {
    if (!updateSession || updateInitializedRef.current) return
    updateInitializedRef.current = true
    startTransition(() => setActiveAddedDate(updateSession.initialPreset))
  }, [updateSession])

  const enableFullSearch = useCallback((force = false) => {
    if (!force && (searchState === 'loading' || searchState === 'ready')) return
    setSearchResource({ language, state: 'loading', records: null })
    loadSearchIndex(language, force).then((records: SearchRecord[]) => {
      startTransition(() => {
        setSearchResource({ language, state: 'ready', records: new Map(records.map((record) => [record.id, record.text])) })
      })
    }).catch(() => setSearchResource({ language, state: 'error', records: null }))
  }, [language, searchState])

  const allCategories = useMemo(() => [...new Set(cases.map((item) => item.category))], [cases])
  const allStyles = useMemo(() => [...new Set(cases.flatMap((item) => item.styles))], [cases])
  const allScenes = useMemo(() => [...new Set(cases.flatMap((item) => item.scenes))], [cases])
  const featuredCaseIds = useMemo(() => new Set(cases
    .filter((item) => item.verified && Boolean(item.mediaUrl) && item.hasPrompt)
    .slice(0, 24)
    .map((item) => item.id)), [cases])
  const latestCaseIds = useMemo(() => new Set([...cases]
    .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
    .slice(0, 48)
    .map((item) => item.id)), [cases])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (promptOnly) url.searchParams.set('prompt', '1')
    else url.searchParams.delete('prompt')
    if (activeCollection !== 'all') url.searchParams.set('collection', activeCollection)
    else url.searchParams.delete('collection')
    if (activeAddedDate !== 'all') url.searchParams.set('added', activeAddedDate)
    else url.searchParams.delete('added')
    if (activeAddedDate === 'unseen' && updateSession?.since) url.searchParams.set('since', updateSession.since)
    else url.searchParams.delete('since')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [activeAddedDate, activeCollection, promptOnly, updateSession?.since])

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
    const needle = deferredQuery.trim().toLocaleLowerCase()
    const matching = cases.filter((item) => {
      const matchesDuration = activeDuration === 'ALL'
        || (activeDuration === 'UP_TO_5' && item.duration <= 5)
        || (activeDuration === 'SIX_TO_10' && item.duration > 5 && item.duration <= 10)
        || (activeDuration === 'ELEVEN_TO_15' && item.duration > 10 && item.duration <= 15)
        || (activeDuration === 'OVER_15' && item.duration > 15)
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory
      const matchesStyle = activeStyle === 'ALL' || item.styles.includes(activeStyle)
      const matchesScene = activeScene === 'ALL' || item.scenes.includes(activeScene)
      const matchesPrompt = !promptOnly || item.hasPrompt
      const matchesAdded = matchesAddedDate(item.addedAt, activeAddedDate, updateSession?.since ?? null)
      const matchesCollection = activeCollection === 'all'
        || (activeCollection === 'featured' && featuredCaseIds.has(item.id))
        || (activeCollection === 'latest' && latestCaseIds.has(item.id))
        || (activeCollection === 'prompt' && item.hasPrompt)
        || (activeCollection === 'official' && item.sourceType === 'official')
        || (activeCollection === 'long' && item.duration > 15)
        || (activeCollection === 'favorites' && favorites.has(item.id))
      const basicHaystack = language === 'zh'
        ? [item.title, item.author, ...item.tags, item.category, ...item.styles, ...item.scenes]
        : [item.titleEn, item.author, item.category, ...item.styles, ...item.scenes]
      const haystack = searchRecords?.get(item.id) ?? basicHaystack.filter(Boolean).join(' ').toLocaleLowerCase()
      return matchesDuration && matchesCategory && matchesStyle && matchesScene && matchesPrompt && matchesCollection && matchesAdded
        && (!needle || haystack.includes(needle))
    })
    return matching.sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
  }, [activeAddedDate, activeCategory, activeCollection, activeDuration, activeScene, activeStyle, cases, deferredQuery, favorites, featuredCaseIds, language, latestCaseIds, promptOnly, searchRecords, updateSession?.since])

  const hasMore = visibleCount < filtered.length
  const loadMore = useCallback(() => setVisibleCount((current) => Math.min(current + 24, filtered.length)), [filtered.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    }, { rootMargin: '1200px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const visibleCases = filtered.slice(0, visibleCount)

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
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(36) }}
                onFocus={() => enableFullSearch()}
                placeholder={t.catalog.searchPlaceholder}
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); setVisibleCount(36) }} aria-label={t.catalog.clearSearch}>
                  <X size={17} />
                </button>
              )}
            </label>
            <div className="search-index-status" aria-live="polite">
              {searchState === 'loading' ? (language === 'zh' ? '正在启用完整 Prompt 搜索…' : 'Enabling full Prompt search…') : null}
              {searchState === 'error' ? (
                <span>{language === 'zh' ? '完整搜索加载失败，当前使用基础搜索。' : 'Full search failed; basic search remains available.'} <button type="button" onClick={() => enableFullSearch(true)}>{language === 'zh' ? '重试' : 'Retry'}</button></span>
              ) : null}
            </div>
          </div>
        </div>

        <UpdateSummary language={language} />

        <AddedDateFilter
          language={language}
          value={activeAddedDate}
          onChange={(value) => startTransition(() => { setActiveAddedDate(value); setVisibleCount(36) })}
          unseenCount={updateSession?.caseIds.size ?? 0}
        />

        <div className="primary-filter" aria-label={t.catalog.filterLabel}>
          <div className="filter-label"><Clock3 size={15} aria-hidden="true" /> {t.catalog.duration}</div>
          <div className="primary-filter-controls">
            <div className="duration-filter">
              {durationRanges.map((range, index) => (
                <button
                  type="button"
                  key={range}
                  className={range === activeDuration ? 'active' : ''}
                  onClick={() => startTransition(() => { setActiveDuration(range); setVisibleCount(36) })}
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
              onClick={() => startTransition(() => { setPromptOnly((current) => !current); setVisibleCount(36) })}
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
                onClick={() => startTransition(() => { setActiveCollection(collection); setVisibleCount(36) })}
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
            <FilterGroup language={language} kind="category" label={t.catalog.category} options={['ALL', ...allCategories]} value={activeCategory} onChange={(value) => startTransition(() => { setActiveCategory(value); setVisibleCount(36) })} />
            <FilterGroup language={language} kind="style" label={t.catalog.style} options={['ALL', ...allStyles]} value={activeStyle} onChange={(value) => startTransition(() => { setActiveStyle(value); setVisibleCount(36) })} />
            <FilterGroup language={language} kind="scene" label={t.catalog.scene} options={['ALL', ...allScenes]} value={activeScene} onChange={(value) => startTransition(() => { setActiveScene(value); setVisibleCount(36) })} />
          </div>
        </details>

        <div className="catalog-count" aria-live="polite">
          <span>{String(filtered.length).padStart(2, '0')}</span> {t.catalog.resultUnit}
        </div>

        <div className="case-grid">
          {visibleCases.map((item, index) => (
            <CaseCard
              key={item.id}
              item={item}
              index={index}
              language={language}
              onOpen={(video) => setSelected({ item, video })}
              isFavorite={favorites.has(item.id)}
              onFavorite={() => toggleFavorite(item.id)}
              isNew={updateSession?.caseIds.has(item.id) ?? false}
            />
          ))}
          {!catalog && !catalogError ? Array.from({ length: 12 }, (_, index) => <div className="case-card case-card-skeleton" key={index} aria-hidden="true"><span /></div>) : null}
        </div>

        {catalogError ? (
          <div className="catalog-load-error" role="alert"><p>{language === 'zh' ? '案例目录加载失败。' : 'The case catalog failed to load.'}</p><button type="button" onClick={onRetryCatalog}>{language === 'zh' ? '重试' : 'Retry'}</button></div>
        ) : null}

        {hasMore ? (
          <div className="catalog-pagination" ref={sentinelRef}>
            <button type="button" onClick={loadMore}>{language === 'zh' ? '加载更多案例' : 'Load more cases'} <span>+24</span></button>
          </div>
        ) : null}

        {catalog && filtered.length === 0 && (
          <div className="empty-state">
            <span>{t.catalog.noMatchesEyebrow}</span>
            <p>{t.catalog.noMatches}</p>
          </div>
        )}
      </section>
      {selected && <CaseDialog item={selected.item} preparedVideo={selected.video} language={language} onClose={() => setSelected(null)} />}
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
  isNew,
}: {
  item: CatalogCase
  index: number
  language: Language
  onOpen: (video: HTMLVideoElement | null) => void
  isFavorite: boolean
  onFavorite: () => void
  isNew: boolean
}) {
  const t = copy[language].card
  const title = caseTitle(item, language)
  const preparedVideoRef = useRef<HTMLVideoElement | null>(null)
  const prepareVideo = () => {
    if (!preparedVideoRef.current) preparedVideoRef.current = prepareHostedVideo(item)
  }
  const openCase = () => {
    const video = preparedVideoRef.current ?? prepareHostedVideo(item)
    preparedVideoRef.current = null
    onOpen(video)
  }
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
    <article className={`case-card${index < 9 ? ' case-card-enter' : ''}`} style={{ '--order': Math.min(index, 8) } as React.CSSProperties}>
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
      <button
        className="media"
        type="button"
        onPointerDown={prepareVideo}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') prepareVideo()
        }}
        onClick={openCase}
        aria-label={t.open(title)}
      >
        <PosterImage item={item} title={t.cover(title)} priority={index < 4} />
        <span className="media-scan" aria-hidden="true" />
        <span className="case-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="duration"><Clock3 size={12} /> {item.duration}s</span>
        <span className="play-mark">
          {item.mediaUrl || item.sourceType === 'x' ? t.play : t.view} <ChevronRight size={14} />
        </span>
      </button>
      <div className="case-meta">
        <div className="added-at-meta">
          {isNew ? <strong>{copy[language].catalog.newlyAdded}</strong> : null}
          <time dateTime={item.addedAt}>{copy[language].catalog.addedOn(formatAddedDate(item.addedAt, language))}</time>
        </div>
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

function PosterImage({ item, title, priority = false }: { item: CatalogCase; title: string; priority?: boolean }) {
  const optimizedBase = item.posterUrl.match(/^\/posters\/(.+)\.(?:jpe?g)$/i)?.[1]
  return (
    <picture>
      {optimizedBase ? (
        <source
          type="image/webp"
          srcSet={`/posters-optimized/${optimizedBase}-360.webp 360w, /posters-optimized/${optimizedBase}-720.webp 720w`}
          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
        />
      ) : null}
      <img
        src={item.posterUrl}
        alt={title}
        width="720"
        height="450"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={(event) => {
          event.currentTarget.onerror = null
          event.currentTarget.src = '/posters/x-community.svg'
        }}
      />
    </picture>
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

function TutorialsPage({ language, updateSession, tutorialGuides }: { language: Language; updateSession: UpdateSession; tutorialGuides: TutorialGuide[] }) {
  const t = copy[language].tutorials
  const [activeCategory, setActiveCategory] = useState<(typeof tutorialCategories)[number]>('all')
  const [activeHardware, setActiveHardware] = useState<'all' | TutorialHardwareProfile>('all')
  const [activeAddedDate, setActiveAddedDate] = useState<AddedDatePreset>(updateSession.initialPreset)
  const [query, setQuery] = useState('')
  const foundations = useMemo(() => tutorialGuides
    .filter((item) => item.contentType === 'foundation' && matchesAddedDate(item.addedAt, activeAddedDate, updateSession.since))
    .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt)),
  [activeAddedDate, tutorialGuides, updateSession.since])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (activeAddedDate !== 'all') url.searchParams.set('added', activeAddedDate)
    else url.searchParams.delete('added')
    if (activeAddedDate === 'unseen' && updateSession.since) url.searchParams.set('since', updateSession.since)
    else url.searchParams.delete('since')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [activeAddedDate, updateSession.since])

  const community = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tutorialGuides.filter((item) => {
      if (item.contentType !== 'community') return false
      const categoryMatches = activeCategory === 'all' || item.category === activeCategory
      const hardwareMatches = activeHardware === 'all' || item.hardwareProfiles?.includes(activeHardware)
      const addedMatches = matchesAddedDate(item.addedAt, activeAddedDate, updateSession.since)
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
      return categoryMatches && hardwareMatches && addedMatches && (!needle || searchable.includes(needle))
    })
      .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
  }, [activeAddedDate, activeCategory, activeHardware, language, query, tutorialGuides, updateSession.since])

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
          <p>{t.index} / {tutorialGuides.length}</p>
          <h1>{t.title}</h1>
        </header>
        {foundations.length > 0 ? (
          <>
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
                    <div className="added-at-meta">
                      {updateSession.tutorialIds.has(tutorial.id) ? <strong>{copy[language].catalog.newlyAdded}</strong> : null}
                      <time dateTime={tutorial.addedAt}>{copy[language].catalog.addedOn(formatAddedDate(tutorial.addedAt, language))}</time>
                    </div>
                    <small>{t.routeLabel} / {tutorial.tags[0]}</small>
                    <h3><a href={tutorialPath(language, tutorial.id)}>{tutorial.title[language]}</a></h3>
                    <TutorialCardActions tutorial={tutorial} language={language} />
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {community.length > 0 ? (
          <header className="tutorial-list-heading is-community">
            <h2>{t.communityTitle}</h2>
            <span>{String(community.length).padStart(2, '0')}</span>
          </header>
        ) : null}
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
        <AddedDateFilter
          language={language}
          value={activeAddedDate}
          onChange={setActiveAddedDate}
          unseenCount={updateSession.tutorialIds.size}
        />
        <div className="tutorial-controls">
          <label className="tutorial-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{t.searchLabel}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label={t.clearSearch}><X size={14} /></button>}
          </label>
          <p className="tutorial-active-filter" aria-live="polite">{t.categories[activeCategory]} · {hardwareLabels[activeHardware]} · {copy[language].catalog.addedDatePresets[activeAddedDate]}</p>
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
                  <div className="added-at-meta">
                    {updateSession.tutorialIds.has(tutorial.id) ? <strong>{copy[language].catalog.newlyAdded}</strong> : null}
                    <time dateTime={tutorial.addedAt}>{copy[language].catalog.addedOn(formatAddedDate(tutorial.addedAt, language))}</time>
                  </div>
                  <small>{t.categories[tutorial.category]} / {tutorial.source.handle || tutorial.source.author}</small>
                  <h3><a href={tutorialPath(language, tutorial.id)}>{tutorial.title[language]}</a></h3>
                  <p>{tutorial.outcome[language]}</p>
                  <TutorialCardActions tutorial={tutorial} language={language} />
                </div>
              </article>
            ))}
          </div>
        ) : foundations.length === 0 ? (
          <div className="tutorial-empty"><span>00</span><p>{t.noResults}</p></div>
        ) : null}
      </section>
    </div>
  )
}

function TutorialDetailPage({ language, tutorial, tutorialGuides, tutorialResources }: { language: Language; tutorial: TutorialGuide; tutorialGuides: TutorialGuide[]; tutorialResources: TutorialResource[] }) {
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

function TutorialEcosystemPage({ language, tutorialGuides, tutorialResources }: { language: Language; tutorialGuides: TutorialGuide[]; tutorialResources: TutorialResource[] }) {
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

function loadStoredSet(key: string) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || '[]')
    return new Set<string>(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function saveStoredSet(key: string, value: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...value]))
  } catch {
    // Keep the current-session state when browser storage is unavailable.
  }
}

function creatorPosters(creator: CreatorProfile, cases: CatalogCase[], tutorialGuides: TutorialGuide[]) {
  const casePosters = creator.representativeCaseIds
    .map((id) => cases.find((item) => item.id === id)?.posterUrl)
    .filter((poster): poster is string => Boolean(poster))
  const tutorialPosters = creator.tutorialIds
    .map((id) => tutorialGuides.find((item) => item.id === id)?.posterUrl)
    .filter((poster): poster is string => Boolean(poster))
  const posters = [...casePosters, ...tutorialPosters]
  return posters.length ? posters.slice(0, 3) : ['/posters/x-community.svg']
}

function rankTrend(creator: CreatorProfile, rankKey: CreatorRankKey, language: Language) {
  const delta = creator.rankDelta[rankKey]
  const t = copy[language].creators
  if (delta === null) return { label: t.rankNew, direction: 'new' }
  if (delta > 0) return { label: t.rankUp(delta), direction: 'up' }
  if (delta < 0) return { label: t.rankDown(Math.abs(delta)), direction: 'down' }
  return { label: t.rankSame, direction: 'same' }
}

function CreatorMosaic({ creator, cases, tutorialGuides }: { creator: CreatorProfile; cases: CatalogCase[]; tutorialGuides: TutorialGuide[] }) {
  const posters = creatorPosters(creator, cases, tutorialGuides)
  return (
    <div className={`creator-mosaic count-${posters.length}`} aria-hidden="true">
      {posters.map((poster, index) => (
        <img
          key={`${poster}:${index}`}
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = '/posters/x-community.svg'
          }}
        />
      ))}
      <span className="creator-mosaic-scan" />
    </div>
  )
}

function CreatorCard({
  creator,
  rankKey,
  language,
  saved,
  onToggleSave,
  cases,
  tutorialGuides,
  compact = false,
}: {
  creator: CreatorProfile
  rankKey: CreatorRankKey
  language: Language
  saved: boolean
  onToggleSave: () => void
  cases: CatalogCase[]
  tutorialGuides: TutorialGuide[]
  compact?: boolean
}) {
  const t = copy[language].creators
  const rank = creator.ranks[rankKey] ?? creator.ranks.overall ?? creator.ranks.tutorials
  const trend = rankTrend(creator, rankKey, language)
  return (
    <article className={`creator-card${compact ? ' is-podium' : ''}`}>
      <a className="creator-card-visual" href={creatorPath(language, creator.slug)} aria-label={`${t.openProfile}: ${creator.displayName}`}>
        <CreatorMosaic creator={creator} cases={cases} tutorialGuides={tutorialGuides} />
        <strong>{rank ? `#${String(rank).padStart(2, '0')}` : '—'}</strong>
        <span className={`creator-rank-trend is-${trend.direction}`}>
          {trend.direction === 'up' ? <TrendUp size={13} /> : trend.direction === 'down' ? <ArrowDownRight size={13} /> : null}
          {trend.label}
        </span>
      </a>
      <div className="creator-card-copy">
        <div className="creator-card-identity">
          <small>@{creator.handle}</small>
          <button
            type="button"
            className={saved ? 'active' : ''}
            aria-label={saved ? t.unsave : t.save}
            aria-pressed={saved}
            title={saved ? t.unsave : t.save}
            onClick={onToggleSave}
          >
            <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <h2><a href={creatorPath(language, creator.slug)}>{creator.displayName}</a></h2>
        <p>{t.reasons[creator.reasons[0] ?? 'recently-active']}</p>
        <dl>
          <div><dt>{t.cases}</dt><dd>{creator.caseCount}</dd></div>
          <div><dt>{t.prompts}</dt><dd>{creator.promptCount}</dd></div>
          <div><dt>{t.recent}</dt><dd>{creator.recentCaseCount}</dd></div>
        </dl>
        <div className="creator-card-actions">
          <a href={creatorPath(language, creator.slug)}>{t.openProfile} <ChevronRight size={14} /></a>
          <a href={creator.xUrl} target="_blank" rel="noreferrer"><XMark size={13} /> {t.followOnX}</a>
        </div>
      </div>
    </article>
  )
}

function CreatorsPage({ language, creatorCatalog, cases, tutorialGuides }: { language: Language; creatorCatalog: CreatorCatalog; cases: CatalogCase[]; tutorialGuides: TutorialGuide[] }) {
  const t = copy[language].creators
  const creators = creatorCatalog.creators
  const [view, setView] = useState<'video' | 'tutorial' | 'saved'>('video')
  const [rankKey, setRankKey] = useState<CreatorRankKey>('overall')
  const [savedCreators, setSavedCreators] = useState(() => loadStoredSet(favoriteCreatorStorageKey))
  const videoRankKeys: CreatorRankKey[] = ['overall', 'active', 'cases', 'prompts', 'rising']

  const toggleSaved = (id: string) => {
    setSavedCreators((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveStoredSet(favoriteCreatorStorageKey, next)
      return next
    })
  }

  const podium = creators
    .filter((creator) => creator.ranks.overall)
    .sort((a, b) => (a.ranks.overall ?? 999) - (b.ranks.overall ?? 999))
    .slice(0, 3)
  const ranked = useMemo(() => {
    if (view === 'saved') {
      return creators
        .filter((creator) => savedCreators.has(creator.id))
        .sort((a, b) => (a.ranks.overall ?? a.ranks.tutorials ?? 999) - (b.ranks.overall ?? b.ranks.tutorials ?? 999))
    }
    const key: CreatorRankKey = view === 'tutorial' ? 'tutorials' : rankKey
    return creators
      .filter((creator) => creator.ranks[key])
      .sort((a, b) => (a.ranks[key] ?? 999) - (b.ranks[key] ?? 999))
  }, [creators, rankKey, savedCreators, view])
  const activeRankKey: CreatorRankKey = view === 'tutorial' ? 'tutorials' : rankKey

  return (
    <div className="standalone-page creators-page">
      <section className="creators shell">
        <header className="creators-hero">
          <div>
            <p>{t.index}</p>
            <h1>{t.title}</h1>
            <span>{t.description}</span>
          </div>
          <dl>
            <div><dt>{t.videoCreators}</dt><dd>{creatorCatalog.stats.videoCreators}</dd></div>
            <div><dt>{t.tutorialCreators}</dt><dd>{creatorCatalog.stats.tutorialCreators}</dd></div>
            <div><dt>{language === 'zh' ? '来源作者' : 'Source authors'}</dt><dd>{creatorCatalog.stats.sourceCreators}</dd></div>
          </dl>
        </header>

        <section className="creator-podium" aria-labelledby="creator-podium-title">
          <header><span>01</span><h2 id="creator-podium-title">{t.podium}</h2><small>{t.methodology}</small></header>
          <div>{podium.map((creator) => <CreatorCard key={creator.id} creator={creator} rankKey="overall" language={language} saved={savedCreators.has(creator.id)} onToggleSave={() => toggleSaved(creator.id)} cases={cases} tutorialGuides={tutorialGuides} compact />)}</div>
        </section>

        <section className="creator-leaderboard" aria-labelledby="creator-leaderboard-title">
          <header className="creator-leaderboard-heading">
            <div><span>02</span><h2 id="creator-leaderboard-title">{t.leaderboard}</h2></div>
            <div className="creator-view-tabs" role="group" aria-label={t.leaderboard}>
              <button type="button" className={view === 'video' ? 'active' : ''} aria-pressed={view === 'video'} onClick={() => setView('video')}><Users size={14} /> {t.videoCreators}</button>
              <button type="button" className={view === 'tutorial' ? 'active' : ''} aria-pressed={view === 'tutorial'} onClick={() => setView('tutorial')}><BookOpen size={14} /> {t.tutorialCreators}</button>
              <button type="button" className={view === 'saved' ? 'active' : ''} aria-pressed={view === 'saved'} onClick={() => setView('saved')}><Bookmark size={14} /> {t.savedCreators}{savedCreators.size ? <small>{savedCreators.size}</small> : null}</button>
            </div>
          </header>
          {view === 'video' && (
            <div className="creator-rank-tabs" role="tablist" aria-label={t.leaderboard}>
              {videoRankKeys.map((key) => <button key={key} type="button" role="tab" aria-selected={rankKey === key} className={rankKey === key ? 'active' : ''} onClick={() => setRankKey(key)}>{t.rankTabs[key]}</button>)}
            </div>
          )}
          <div className="creator-grid">
            {ranked.map((creator) => <CreatorCard key={creator.id} creator={creator} rankKey={activeRankKey} language={language} saved={savedCreators.has(creator.id)} onToggleSave={() => toggleSaved(creator.id)} cases={cases} tutorialGuides={tutorialGuides} />)}
          </div>
          {ranked.length === 0 && <div className="creator-empty"><Bookmark size={22} /><p>{t.noSaved}</p></div>}
        </section>
      </section>
    </div>
  )
}

function CreatorDetailPage({ language, creator, cases, tutorialGuides }: { language: Language; creator: CreatorProfile; cases: CatalogCase[]; tutorialGuides: TutorialGuide[] }) {
  const t = copy[language].creators
  const [savedCreators, setSavedCreators] = useState(() => loadStoredSet(favoriteCreatorStorageKey))
  const [favoriteCases, setFavoriteCases] = useState(() => loadStoredSet(favoriteStorageKey))
  const [promptOnly, setPromptOnly] = useState(() => new URLSearchParams(window.location.search).get('prompt') === '1')
  const [activeDuration, setActiveDuration] = useState<DurationRange>('ALL')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selected, setSelected] = useState<OpenedCase | null>(null)
  const creatorCases = creator.caseIds.map((id) => cases.find((item) => item.id === id)).filter((item): item is CatalogCase => Boolean(item))
  const creatorCategories = [...new Set(creatorCases.map((item) => item.category))]
  const creatorTutorials = creator.tutorialIds.map((id) => tutorialGuides.find((item) => item.id === id)).filter((item): item is TutorialGuide => Boolean(item))
  const saved = savedCreators.has(creator.id)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (promptOnly) url.searchParams.set('prompt', '1')
    else url.searchParams.delete('prompt')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [promptOnly])

  const filteredCases = creatorCases.filter((item) => {
    const durationMatches = activeDuration === 'ALL'
      || (activeDuration === 'UP_TO_5' && item.duration <= 5)
      || (activeDuration === 'SIX_TO_10' && item.duration > 5 && item.duration <= 10)
      || (activeDuration === 'ELEVEN_TO_15' && item.duration > 10 && item.duration <= 15)
      || (activeDuration === 'OVER_15' && item.duration > 15)
    const categoryMatches = activeCategory === 'ALL' || item.category === activeCategory
    return durationMatches && categoryMatches && (!promptOnly || item.hasPrompt)
  })

  const toggleCreator = () => {
    setSavedCreators((current) => {
      const next = new Set(current)
      if (next.has(creator.id)) next.delete(creator.id)
      else next.add(creator.id)
      saveStoredSet(favoriteCreatorStorageKey, next)
      return next
    })
  }
  const toggleCase = (id: string) => {
    setFavoriteCases((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveStoredSet(favoriteStorageKey, next)
      return next
    })
  }
  const primaryRank = creator.ranks.overall ?? creator.ranks.tutorials

  return (
    <div className="standalone-page creator-detail-page">
      <article className="creator-profile shell">
        <a className="tutorial-back" href={pathFor(language, 'creators')}><ChevronRight size={14} /> {t.back}</a>
        <header className="creator-profile-hero">
          <div className="creator-profile-visual"><CreatorMosaic creator={creator} cases={cases} tutorialGuides={tutorialGuides} /><strong>{primaryRank ? `#${String(primaryRank).padStart(2, '0')}` : '—'}</strong></div>
          <div className="creator-profile-copy">
            <p>@{creator.handle}</p>
            <h1>{creator.displayName}</h1>
            <div className="creator-badges">{creator.badges.map((badge) => <span key={badge}>{t.badges[badge]}</span>)}</div>
            <div className="creator-profile-actions">
              <button type="button" className={saved ? 'active' : ''} onClick={toggleCreator} aria-pressed={saved}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? t.unsave : t.save}</button>
              <a href={creator.xUrl} target="_blank" rel="noreferrer"><XMark size={14} /> {t.followOnX}</a>
            </div>
          </div>
          <dl className="creator-profile-stats">
            <div><dt>{t.cases}</dt><dd>{creator.caseCount}</dd></div>
            <div><dt>{t.prompts}</dt><dd>{creator.promptCount}</dd></div>
            <div><dt>{t.tutorials}</dt><dd>{creator.tutorialCount}</dd></div>
            <div><dt>{t.activeWeeks}</dt><dd>{creator.activeWeeks}</dd></div>
          </dl>
        </header>

        {creatorCases.length > 0 && (
          <section className="creator-work" aria-labelledby="creator-work-title">
            <header>
              <div><span>01</span><h2 id="creator-work-title">{t.work}</h2></div>
              <div className="creator-work-filters">
                <label>{t.duration}<select value={activeDuration} onChange={(event) => setActiveDuration(event.target.value as DurationRange)}>{durationRanges.map((range) => <option value={range} key={range}>{durationLabel(range, language)}</option>)}</select></label>
                <label>{copy[language].catalog.category}<select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>{['ALL', ...creatorCategories].map((category) => <option value={category} key={category}>{taxonomyLabel(category, language, 'category')}</option>)}</select></label>
                <button type="button" role="switch" aria-checked={promptOnly} className={promptOnly ? 'active' : ''} onClick={() => setPromptOnly((value) => !value)}><Sparkles size={14} /> {t.promptOnly}<i><b /></i></button>
              </div>
            </header>
            <div className="case-grid">
              {filteredCases.map((item, index) => <CaseCard key={item.id} item={item} index={index} language={language} onOpen={(video) => setSelected({ item, video })} isFavorite={favoriteCases.has(item.id)} onFavorite={() => toggleCase(item.id)} isNew={false} />)}
            </div>
            {filteredCases.length === 0 && <div className="creator-empty"><p>{t.noCases}</p></div>}
          </section>
        )}

        {creatorTutorials.length > 0 && (
          <section className="creator-guides" aria-labelledby="creator-guides-title">
            <header><span>02</span><h2 id="creator-guides-title">{t.guides}</h2></header>
            <div>{creatorTutorials.map((tutorial) => <a key={tutorial.id} href={tutorialPath(language, tutorial.id)}><img src={tutorial.posterUrl} alt="" /><span><small>{copy[language].tutorials.categories[tutorial.category]}</small><strong>{tutorial.title[language]}</strong></span><ChevronRight size={17} /></a>)}</div>
          </section>
        )}

        <footer className="creator-profile-correction">
          <p>{t.correction}</p>
          <a href={`https://github.com/SkyNotSilent/awesome-minimax-h3-cases/issues/new?template=creator-correction.yml&title=${encodeURIComponent(`[Creator profile] @${creator.handle}`)}`} target="_blank" rel="noreferrer">{t.correctionCta} <ArrowUpRight size={14} /></a>
        </footer>
      </article>
      {selected && <CaseDialog item={selected.item} preparedVideo={selected.video} language={language} onClose={() => setSelected(null)} />}
    </div>
  )
}

function CreatorNotFound({ language }: { language: Language }) {
  return (
    <div className="standalone-page tutorial-not-found shell">
      <span>404</span>
      <h1>{language === 'zh' ? '这位创作者暂未进入榜单。' : 'This creator is not currently ranked.'}</h1>
      <a href={pathFor(language, 'creators')}>{copy[language].creators.back}</a>
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

function CaseDialog({ item, preparedVideo, language, onClose }: { item: CatalogCase; preparedVideo: HTMLVideoElement | null; language: Language; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [detail, setDetail] = useState<CaseDetail | null>(() => testDetails.get(item.id) ?? null)
  const [detailState, setDetailState] = useState<'loading' | 'ready' | 'error'>(detail ? 'ready' : 'loading')
  const copyTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const t = copy[language].dialog
  const title = caseTitle(item, language)
  const prompt = detail?.prompt ?? null
  const hasPublishedPrompt = detail?.promptProvenance !== 'not-published' && Boolean(prompt)

  const retryDetail = useCallback(() => {
    setDetailState('loading')
    loadCaseDetail(item.id, true).then((value) => {
      setDetail(value)
      setDetailState('ready')
    }).catch(() => setDetailState('error'))
  }, [item.id])

  useEffect(() => {
    if (detail) return
    let active = true
    loadCaseDetail(item.id).then((value) => {
      if (!active) return
      setDetail(value)
      setDetailState('ready')
    }).catch(() => {
      if (active) setDetailState('error')
    })
    return () => { active = false }
  }, [detail, item.id])

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
            <HostedVideo item={item} language={language} title={title} preparedVideo={preparedVideo} />
          ) : (
            <XPostEmbed sourceUrl={item.sourceUrl} title={title} posterUrl={item.posterUrl} language={language} />
          )}
        </div>
        <div className="dialog-copy">
          <div className="dialog-eyebrow"><span>{item.mode}</span>{detail ? <><span>{metadataValue(detail.resolution, language)}</span><span>{metadataValue(detail.aspectRatio, language)}</span></> : null}<span>{item.duration} {t.seconds}</span></div>
          <h2 id="dialog-title">{title}</h2>
          {detailState === 'loading' ? <div className="detail-skeleton" role="status" aria-live="polite"><span /><span /><span /></div> : null}
          {detailState === 'error' ? <div className="detail-error" role="alert"><p>{language === 'zh' ? '文字详情加载失败，视频仍可继续播放。' : 'Text details failed to load. The video can still play.'}</p><button type="button" onClick={retryDetail}>{language === 'zh' ? '重试详情' : 'Retry details'}</button></div> : null}
          {detail ? <p className="summary">{language === 'zh' ? detail.summary : detail.summaryEn}</p> : null}
          {detail ? <div className="case-model-line">{modelLabel(detail, language)}</div> : null}
          {detail && hasPublishedPrompt ? (
            <div className="published-prompt">
              <div className="prompt-heading">
                <span>{t.prompt} · {provenanceLabel(detail.promptProvenance, language)}</span>
                <button type="button" onClick={copyPrompt}>
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? t.copied : t.copy}
                </button>
              </div>
              <p className="prompt-notice">
                {t.promptPublished} · {t.promptNotice}
                {detail.promptSourceUrl ? (
                  <a href={detail.promptSourceUrl} target="_blank" rel="noreferrer">
                    {t.promptSource} <ArrowUpRight size={11} />
                  </a>
                ) : null}
              </p>
              <pre>{prompt}</pre>
            </div>
          ) : detail ? (
            <p className="prompt-unavailable">{t.promptUnavailable}</p>
          ) : null}
          <a className="original-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
            {t.source}{detail ? ` · ${sourceLabel({ ...item, sourceLabel: detail.sourceLabel }, language)}` : ''} <ArrowUpRight size={15} />
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
      <span>MINIMAX H3 CASES &amp; GUIDES — 2026</span>
    </footer>
  )
}

export default App
