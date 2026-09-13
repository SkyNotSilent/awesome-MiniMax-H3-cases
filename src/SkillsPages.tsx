import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Check, ChevronRight, Copy, Search, X } from 'lucide-react'
import { loadSkillOriginal, loadSkills } from './data-client'
import { pathFor, skillPath, type Language } from './i18n'
import { OriginalDocument, OriginalSkeleton, OriginalUnavailable } from './TutorialOriginal'
import { skillAnchor, skillInstallCommand } from './skills'
import type { SkillCategory, SkillPackage, TutorialOriginal } from './types'
import './skills.css'

const CATEGORIES: SkillCategory[] = ['prompt', 'production', 'comfyui', 'api', 'local']
const CATEGORY_LABELS: Record<Language, Record<SkillCategory, string>> = {
  zh: { prompt: '写 Prompt', production: '成片流程', comfyui: 'ComfyUI 驱动', api: '云端运行', local: '本地运行' },
  en: { prompt: 'Prompt writing', production: 'Production', comfyui: 'ComfyUI control', api: 'Cloud runs', local: 'Local inference' },
}
type Origin = 'all' | 'official' | 'community'

function formatStars(value: number, language: Language) {
  return new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function InstallCommand({ command, language, compact = false }: { command: string; language: Language; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])
  const zh = language === 'zh'
  return <div className={`skill-install${compact ? ' is-compact' : ''}`}>
    <code>{command}</code>
    <button type="button" onClick={() => { navigator.clipboard?.writeText(command).then(() => setCopied(true)).catch(() => undefined) }} aria-label={`${zh ? '复制安装命令' : 'Copy install command'}: ${command}`}>
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}<span>{copied ? (zh ? '已复制' : 'Copied') : (zh ? '复制' : 'Copy')}</span>
    </button>
  </div>
}

function useSkills() {
  const [skills, setSkills] = useState<SkillPackage[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    loadSkills().then((value) => { if (active) setSkills(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])
  return { skills, failed }
}

function SkillCard({ item, language }: { item: SkillPackage; language: Language }) {
  const zh = language === 'zh'
  return <article className={`skill-card${item.official ? ' is-official' : ''}`}>
    <p className="skill-card-kicker"><span>{CATEGORY_LABELS[language][item.category]}</span>{item.official && <strong>{zh ? '官方' : 'Official'}</strong>}</p>
    <h3><a href={skillPath(language, item.id)}>{item.name}</a></h3>
    <p className="skill-card-repo">{item.repository}</p>
    <p className="skill-card-summary">{item.summary[language]}</p>
    <p className="skill-card-meta">
      <span>{item.skillCount} {zh ? '个 Skill' : item.skillCount === 1 ? 'skill' : 'skills'}</span>
      <span>★ {formatStars(item.stars, language)}</span>
      {item.license && <span>{item.license}</span>}
    </p>
    <InstallCommand command={skillInstallCommand(item)} language={language} compact />
    <a className="skill-card-open" href={skillPath(language, item.id)}>{zh ? '阅读 SKILL.md 原文' : 'Read the SKILL.md'} <ChevronRight size={14} /></a>
  </article>
}

function SkillsIndex({ skills, language }: { skills: SkillPackage[]; language: Language }) {
  const zh = language === 'zh'
  const [origin, setOrigin] = useState<Origin>('all')
  const [category, setCategory] = useState<'all' | SkillCategory>('all')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return skills.filter((item) => {
      if (origin === 'official' && !item.official) return false
      if (origin === 'community' && item.official) return false
      if (category !== 'all' && item.category !== category) return false
      if (!needle) return true
      return [item.name, item.repository, item.summary[language], ...item.skills.flatMap((skill) => [skill.name, skill.description])].join(' ').toLowerCase().includes(needle)
    })
  }, [category, language, origin, query, skills])
  const skillCount = skills.reduce((sum, item) => sum + item.skillCount, 0)
  // Official cards span two columns; pair each with a community card so rows stay full.
  const arranged = useMemo(() => {
    const official = filtered.filter((item) => item.official)
    const community = filtered.filter((item) => !item.official)
    return official.flatMap((item, index) => community[index] ? [item, community[index]] : [item]).concat(community.slice(official.length))
  }, [filtered])
  const counts = new Map(CATEGORIES.map((key) => [key, skills.filter((item) => item.category === key).length]))
  return <div className="standalone-page skills-page">
    <section className="shell skills-hub" aria-labelledby="skills-title">
      <header className="skills-index-header">
        <p>03 / H3 SKILLS / {skills.length}</p>
        <h1 id="skills-title">MiniMax H3 Skills</h1>
        <p className="skills-lede">{zh
          ? `收录 ${skills.length} 个面向 MiniMax H3 的 Agent Skill 包，共 ${skillCount} 个 Skill。每个都完整收录 SKILL.md 原文，附一行安装命令。`
          : `${skills.length} Agent Skill packages built for MiniMax H3, ${skillCount} skills in total. Each includes its complete SKILL.md and a one-line install command.`}</p>
      </header>
      <ol className="skills-howto" aria-label={zh ? '怎么用' : 'How to use'}>
        <li><span>01</span><strong>{zh ? '挑一个 Skill' : 'Pick a skill'}</strong><small>{zh ? '按用途筛选，先读原文确认它做什么。' : 'Filter by purpose and read the original first.'}</small></li>
        <li><span>02</span><strong>{zh ? '复制安装命令' : 'Copy the install command'}</strong><small>{zh ? '在终端运行，按提示选择要安装到的 Agent。' : 'Run it in a terminal and choose the agents to install into.'}</small></li>
        <li><span>03</span><strong>{zh ? '直接说需求' : 'Describe what you want'}</strong><small>{zh ? '在 Claude Code、Codex 等 Agent 里描述镜头，Skill 会自动接手。' : 'Ask Claude Code, Codex, or another agent; the skill takes over.'}</small></li>
      </ol>
      <div className="skills-filters">
        <nav aria-label={zh ? '按来源' : 'By origin'}>
          {(['all', 'official', 'community'] as const).map((key) => <button key={key} type="button" aria-pressed={origin === key} className={origin === key ? 'active' : ''} onClick={() => setOrigin(key)}>
            {key === 'all' ? (zh ? '全部' : 'All') : key === 'official' ? (zh ? '官方' : 'Official') : (zh ? '社区' : 'Community')}
          </button>)}
        </nav>
        <nav aria-label={zh ? '按用途' : 'By purpose'}>
          <button type="button" aria-pressed={category === 'all'} className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{zh ? '全部用途' : 'All purposes'}</button>
          {CATEGORIES.filter((key) => counts.get(key)).map((key) => <button key={key} type="button" aria-pressed={category === key} className={category === key ? 'active' : ''} onClick={() => setCategory(key)}>{CATEGORY_LABELS[language][key]} {counts.get(key)}</button>)}
        </nav>
        <label className="skills-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">{zh ? '搜索 Skills' : 'Search skills'}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? '搜索名称、仓库或用途…' : 'Search names, repositories, or uses…'} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={zh ? '清除搜索' : 'Clear search'}><X size={13} /></button>}
        </label>
      </div>
      <p className="skills-count" aria-live="polite">{filtered.length} / {skills.length}</p>
      {filtered.length
        ? <div className="skills-grid">{arranged.map((item) => <SkillCard key={item.id} item={item} language={language} />)}</div>
        : <p className="skills-empty">{zh ? '没有匹配的 Skill，换个关键词试试。' : 'No matching skills. Try another keyword.'}</p>}
      <p className="skills-submit">{zh ? '做了 H3 Skill？' : 'Built an H3 skill?'} <a href="https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/new?template=tutorial-submission.yml" target="_blank" rel="noreferrer">{zh ? '提交收录' : 'Submit it'} <ArrowUpRight size={13} /></a></p>
    </section>
  </div>
}

function SkillDetail({ item, language }: { item: SkillPackage; language: Language }) {
  const zh = language === 'zh'
  const [original, setOriginal] = useState<TutorialOriginal | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    loadSkillOriginal(item.id).then((value) => { if (active) setOriginal(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [item.id])
  useEffect(() => {
    const scrollToSkill = () => {
      const id = window.location.hash.slice(1)
      if (id.startsWith('skill-')) document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }
    window.addEventListener('tutorial-original-ready', scrollToSkill)
    return () => window.removeEventListener('tutorial-original-ready', scrollToSkill)
  }, [])
  const repositoryUrl = `https://github.com/${item.repository}`
  const sourceLabel = zh ? '在 GitHub 查看' : 'View on GitHub'
  return <div className="standalone-page skill-detail-page">
    <article className="shell skill-detail">
      <a className="tutorial-back" href={pathFor(language, 'skills')}><ChevronRight size={14} /> {zh ? '返回 Skills' : 'Back to Skills'}</a>
      <header className="skill-detail-hero">
        <p>{CATEGORY_LABELS[language][item.category]} / {item.official ? (zh ? '官方' : 'Official') : (zh ? '社区' : 'Community')}</p>
        <h1>{item.name}</h1>
        <strong>{item.summary[language]}</strong>
        <InstallCommand command={skillInstallCommand(item)} language={language} />
        <a className="skill-repo-link" href={repositoryUrl} target="_blank" rel="noreferrer">{item.repository} <ArrowUpRight size={14} /></a>
      </header>
      <div className="tutorial-detail-layout has-original">
        <main className="tutorial-detail-content">
          {failed ? <OriginalUnavailable language={language} sourceUrl={repositoryUrl} sourceLabel={sourceLabel} />
            : original ? <OriginalDocument original={original} language={language} sourceLabel={sourceLabel} kindLabel="SKILL.md" revisionUrl={original.source.revision ? `${repositoryUrl}/tree/${original.source.revision}` : null} />
            : <OriginalSkeleton />}
        </main>
        <aside className="tutorial-detail-meta skill-facts">
          <h2>{zh ? '包信息' : 'Package'}</h2>
          <dl>
            <div><dt>{zh ? '作者' : 'Author'}</dt><dd><a href={`https://github.com/${item.author}`} target="_blank" rel="noreferrer">{item.author}</a></dd></div>
            <div><dt>{zh ? '许可证' : 'License'}</dt><dd>{item.license ?? (zh ? '未声明' : 'Not declared')}</dd></div>
            <div><dt>{zh ? 'Star 快照' : 'Stars'}</dt><dd>{formatStars(item.stars, language)} · {item.starsAt}</dd></div>
            <div><dt>{zh ? '仓库更新' : 'Updated'}</dt><dd>{item.updatedAt}</dd></div>
          </dl>
          <h2>{zh ? `包含 ${item.skillCount} 个 Skill` : `${item.skillCount} ${item.skillCount === 1 ? 'skill' : 'skills'}`}</h2>
          {item.catalog && <p className="skill-facts-note">{zh ? '这个包的 Skill 太多，下方原文收录 README 与完整的 Skill 目录，每一行都链到对应的 SKILL.md。' : 'This package has too many skills to reproduce one by one. The original below carries its README and a complete index linking every SKILL.md.'} <a href="#skill-index">{zh ? '跳到目录' : 'Jump to the index'}</a></p>}
          <ul className="skill-facts-list">{item.skills.map((skill) => <li key={skill.path}>
            <a href={`#${skillAnchor(skill.name)}`}>{skill.name}</a>
            {item.skills.length > 1 && <InstallCommand command={skillInstallCommand(item, skill)} language={language} compact />}
          </li>)}</ul>
        </aside>
      </div>
    </article>
  </div>
}

export default function SkillsRoute({ language, slug }: { language: Language; slug?: string }) {
  const { skills, failed } = useSkills()
  const zh = language === 'zh'
  // The app shell sets the generic Skills title; a detail page names its package once loaded.
  useEffect(() => {
    const item = slug ? skills?.find((entry) => entry.id === slug) : null
    if (item) document.title = `${item.name} — MiniMax H3 Skills`
  }, [skills, slug])
  if (failed) return <section className="resource-state shell" role="alert"><span>!</span><p>{zh ? 'Skills 加载失败，请刷新重试。' : 'Skills failed to load. Please refresh.'}</p></section>
  if (!skills) return <section className="resource-state shell" role="status"><span>…</span><p>{zh ? '正在加载 Skills…' : 'Loading skills…'}</p></section>
  if (!slug) return <SkillsIndex skills={skills} language={language} />
  const item = skills.find((entry) => entry.id === slug)
  if (!item) return <section className="resource-state shell" role="status"><span>404</span><p>{zh ? '没有找到这个 Skill。' : 'Skill not found.'}</p><a href={pathFor(language, 'skills')}>{zh ? '返回 Skills' : 'Back to Skills'}</a></section>
  return <SkillDetail item={item} language={language} />
}
