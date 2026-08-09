import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  Code2,
  FileCode2,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import rawCases from '../data/cases.json'
import rawTemplates from '../data/templates.json'
import type { CaseMode, VideoCase } from './types'
import { XPostEmbed } from './XPostEmbed'

const cases = rawCases as VideoCase[]
const templates = rawTemplates as PromptTemplate[]
const modes: Array<'ALL' | CaseMode> = ['ALL', 'T2VA', 'FL2VA', 'Ref2VA', 'Unknown']
const allCategories = [...new Set(cases.map((item) => item.category))]
const allStyles = [...new Set(cases.flatMap((item) => item.styles))]
const allScenes = [...new Set(cases.flatMap((item) => item.scenes))]

interface PromptTemplate {
  id: string
  title: string
  titleEn: string
  mode: CaseMode
  useWhen: string
  sourceCaseId: string
  sections: string[]
  template: string
}

const modeCopy: Record<(typeof modes)[number], string> = {
  ALL: '全部样例',
  T2VA: '文字生视频',
  FL2VA: '首尾帧',
  Ref2VA: '全模态参考',
  Unknown: '模式待确认',
}

const toolkitResources = [
  {
    code: 'R01',
    kind: 'OFFICIAL / SKILLS',
    title: 'MiniMax-AI / MiniMax-H3',
    description: '官方仓库与本地部署入口。内置 9 个 Agent Skill；先装 h3-prompt-writing，让 Claude / Codex 按镜头、对白与环境声组织 H3 提示词。',
    tags: ['9 Skills', 'Prompt Writing', 'Local Deploy'],
    url: 'https://github.com/MiniMax-AI/MiniMax-H3',
    action: '打开官方仓库',
  },
  {
    code: 'R02',
    kind: 'ACCELERATION / LORA',
    title: 'MiniMax-H3 Turbo LoRA',
    description: '将常规约 20 步采样压缩到 4–8 步并保留同步立体声音频。4 步用于快速预览，v4 版本在 6–8 步通常更稳。',
    tags: ['4–8 Steps', 'Audio + Video', 'ComfyUI'],
    url: 'https://huggingface.co/larryvrh/MiniMax-H3-Turbo-Lora',
    action: '打开 Hugging Face',
  },
  {
    code: 'R03',
    kind: 'LONG VIDEO / CONTEXT',
    title: 'ComfyUI H3 Motion Context',
    description: '用于多段 H3 视频续接，把上一段的画面与音频上下文带入下一段，减少片段连接处的动作、节奏和声音断裂。',
    tags: ['Clip Chaining', 'Motion Context', 'Audio Continuity'],
    url: 'https://github.com/NikoDemon80/ComfyUI-H3-Motion-Context',
    action: '打开续接节点',
  },
  {
    code: 'R04',
    kind: 'AUDIO / WORKFLOWS',
    title: 'MiniMax H3 Audio T8',
    description: '面向 ComfyUI 原生 H3 的 14 节点扩展，覆盖音频条件、双时钟采样、混音、裁切、预检和 Ref2VA 参考，并附 API 与前端工作流。',
    tags: ['14 Nodes', 'Dual Clock', 'Audio Control'],
    url: 'https://github.com/T8mars/comfyui-minimax-h3-audio-T8',
    action: '打开音频工作流',
  },
]

function App() {
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
      const haystack = [
        item.title,
        item.titleEn,
        item.summary,
        item.prompt,
        item.category,
        ...item.tags,
        ...item.styles,
        ...item.scenes,
      ]
        .join(' ')
        .toLowerCase()
      return matchesMode && matchesCategory && matchesStyle && matchesScene && (!needle || haystack.includes(needle))
    })
  }, [activeCategory, activeMode, activeScene, activeStyle, query])

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null)
    document.body.classList.add('modal-open')
    window.addEventListener('keydown', close)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', close)
    }
  }, [selected])

  return (
    <main id="top">
      <div className="grain" aria-hidden="true" />
      <Header />

      <section className="hero shell">
        <div className="hero-kicker reveal reveal-1">
          <span className="live-dot" /> COMMUNITY RESEARCH INDEX / 2026
        </div>
        <h1 className="reveal reveal-2">
          H3 <span>FIELD</span>
          <br />NOTES<sup>β</sup>
        </h1>
        <div className="hero-bottom reveal reveal-3">
          <p>
            MiniMax H3 的社区实验档案。收录真实视频、完整提示词、输入方式与可复现工作流。
          </p>
          <div className="hero-stats" aria-label="项目统计">
            <Stat value={String(cases.length).padStart(2, '0')} label="公开案例" />
            <Stat value={String(templates.length).padStart(2, '0')} label="提示词模板" />
            <Stat value="24" label="帧 / 秒" />
          </div>
        </div>
      </section>

      <section className="catalog shell" id="catalog">
        <div className="catalog-bar">
          <div>
            <p className="section-index">01 / 案例索引</p>
            <h2>观察。拆解。复现。</h2>
          </div>
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">搜索案例</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索提示词、场景、标签…"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="清除搜索">
                <X size={15} />
              </button>
            )}
          </label>
        </div>

        <div className="filter-panel" aria-label="案例筛选">
          <div className="filter-label">
            <SlidersHorizontal size={16} aria-hidden="true" /> FILTER INDEX
          </div>
          <FilterGroup
            label="生成模式"
            options={modes}
            value={activeMode}
            onChange={(value) => setActiveMode(value as (typeof modes)[number])}
            format={(value) => modeCopy[value as (typeof modes)[number]]}
          />
          <FilterGroup label="内容分类" options={['ALL', ...allCategories]} value={activeCategory} onChange={setActiveCategory} />
          <FilterGroup label="视觉风格" options={['ALL', ...allStyles]} value={activeStyle} onChange={setActiveStyle} />
          <FilterGroup label="场景" options={['ALL', ...allScenes]} value={activeScene} onChange={setActiveScene} />
        </div>

        <div className="case-grid" aria-live="polite">
          {filtered.map((item, index) => (
            <CaseCard key={item.id} item={item} index={index} onOpen={() => setSelected(item)} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <span>NO MATCHES</span>
            <p>没有找到匹配案例，换一个关键词或模式试试。</p>
          </div>
        )}
      </section>

      <Templates />
      <Toolkit />
      <Method />
      <FAQ />
      <Footer />
      {selected && <CaseDialog item={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

function Header() {
  return (
    <header className="shell site-header reveal reveal-1">
      <a className="brand" href="#top" aria-label="H3 Field Notes 首页">
        H3<span>/FN</span>
      </a>
      <nav>
        <a href="#catalog">案例</a>
        <a href="#templates">模板</a>
        <a href="#toolkit">工具链</a>
        <a href="#method">收录方式</a>
        <a href="#faq">常见问题</a>
      </nav>
      <a
        className="source-button"
        href="https://github.com/SkyNotSilent/awesome-minimax-h3"
        target="_blank"
        rel="noreferrer"
      >
        <Code2 size={16} /> SOURCE
      </a>
    </header>
  )
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
  format = (option) => (option === 'ALL' ? '全部' : option),
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  format?: (option: string) => string
}) {
  return (
    <div className="filter-group">
      <strong>{label}</strong>
      <div>
        {options.map((option) => (
          <button key={option} className={option === value ? 'active' : ''} onClick={() => onChange(option)}>
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function CaseCard({
  item,
  index,
  onOpen,
}: {
  item: VideoCase
  index: number
  onOpen: () => void
}) {
  return (
    <article className="case-card" style={{ '--order': index } as React.CSSProperties}>
      <button className="media" onClick={onOpen} aria-label={`查看 ${item.title} 详情`}>
        {item.mediaUrl ? (
          <video src={item.mediaUrl} poster={item.posterUrl} muted loop playsInline preload="metadata" />
        ) : (
          <img
            src={item.posterUrl}
            alt={`${item.title} 视频封面`}
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
        <span className="duration">
          <Clock3 size={12} /> {item.duration}s
        </span>
        <span className="play-mark">
          {item.mediaUrl || item.sourceType === 'x' ? 'PLAY' : 'VIEW'} <ChevronRight size={14} />
        </span>
      </button>
      <div className="case-meta">
        <div className="mode-line">
          <span>{item.mode} / {item.category}</span>
          {item.verified && (
            <span className="verified">
              <Check size={11} /> 官方可复现
            </span>
          )}
          {!item.verified && item.sourceType === 'x' && (
            <span className="verified community-source">
              <ArrowUpRight size={11} /> X 社区
            </span>
          )}
        </div>
        <a className="case-title" href={`/cases/${item.id}/`}>
          <h3>{item.title}</h3>
          <p>{item.titleEn}</p>
        </a>
        <div className="tags">
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </div>
    </article>
  )
}

function Templates() {
  const [copied, setCopied] = useState<string | null>(null)

  async function copyTemplate(item: PromptTemplate) {
    await navigator.clipboard.writeText(item.template)
    setCopied(item.id)
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <section className="templates shell" id="templates">
      <div className="templates-intro">
        <p className="section-index">02 / PROMPT AS CODE</p>
        <h2>从单个案例，<br />提炼可复用镜头协议。</h2>
        <p>每个模板都能追溯到已核验案例；变量可替换，来源不会丢。</p>
      </div>
      <div className="template-list">
        {templates.map((item) => (
          <article key={item.id}>
            <div className="template-code">{item.id}</div>
            <div className="template-body">
              <div className="template-mode">{item.mode}</div>
              <h3>{item.title}</h3>
              <p className="template-en">{item.titleEn}</p>
              <p>{item.useWhen}</p>
              <div className="template-sections">
                {item.sections.map((section) => <span key={section}>{section}</span>)}
              </div>
            </div>
            <button onClick={() => copyTemplate(item)}>
              {copied === item.id ? <Check size={15} /> : <FileCode2 size={15} />}
              {copied === item.id ? '已复制' : '复制模板'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function Toolkit() {
  return (
    <section className="toolkit shell" id="toolkit">
      <div className="toolkit-heading">
        <div>
          <p className="section-index">03 / H3 FIELD KIT</p>
          <h2>从提示词，<br />一路接到成片。</h2>
        </div>
        <p>
          不只给模型权重。这里整理真正会影响落地效率的官方 Skill、加速 LoRA、长视频续接与音视频工作流。
        </p>
      </div>

      <div className="toolkit-grid">
        {toolkitResources.map((item) => (
          <a
            className="resource-card"
            href={item.url}
            target="_blank"
            rel="noreferrer"
            key={item.code}
            aria-label={`${item.title}：${item.action}`}
          >
            <div className="resource-topline">
              <span>{item.code}</span>
              <span>{item.kind}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div className="resource-tags">
              {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <div className="resource-action">
              {item.action} <ArrowUpRight size={15} />
            </div>
          </a>
        ))}
      </div>

      <div className="toolkit-notes">
        <article className="speed-note">
          <div className="note-label">FIELD NOTE / 速度组合</div>
          <h3>少叠插件，先把采样链路跑稳。</h3>
          <p>
            实战优先尝试 <strong>Turbo LoRA + SageAttention</strong>。4 步适合预览，6–8 步用于成片；EasyCache 更适合原生 20 步工作流，不建议和 4 步 Turbo 叠加。端到端速度仍会受到 VAE 解码与视频封装影响。
          </p>
          <small>生态观察：当前 H3 LoRA 热点集中在加速，人物与画风训练仍处于早期。</small>
        </article>

        <article className="pipeline-note">
          <div className="note-label">NEXT PIPELINE / 无人出片</div>
          <div className="pipeline-flow" aria-label="下一步自动化路线">
            <div><span>01</span><strong>AGENT</strong><small>h3-prompt-writing</small></div>
            <ChevronRight size={18} aria-hidden="true" />
            <div><span>02</span><strong>COMFYUI API</strong><small>生成音视频</small></div>
            <ChevronRight size={18} aria-hidden="true" />
            <div><span>03</span><strong>REMOTION</strong><small>自动剪辑与交付</small></div>
          </div>
        </article>
      </div>
    </section>
  )
}

function Method() {
  return (
    <section className="method shell" id="method">
      <div className="method-heading">
        <p className="section-index">04 / 收录方式</p>
        <h2>不是热度榜。<br />是可验证的实验记录。</h2>
      </div>
      <div className="method-steps">
        <MethodStep number="A" title="发现" text="监控 X 关键词与重点创作者，归档原帖地址和公开元数据，并通过官方嵌入播放器站内展示。" />
        <MethodStep number="B" title="低成本核验" text="规则先过滤，MiMo V2.5 Pro 处理文本；只有入围视频才交给 MiMo V2.5 多模态核验。" />
        <MethodStep number="C" title="人工归档" text="候选不会超时自动发布。审核合并后，再同步网站、GitHub 目录与 Agent Skill。" />
      </div>
    </section>
  )
}

function MethodStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article>
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  )
}

function FAQ() {
  return (
    <section className="faq shell" id="faq">
      <div className="faq-heading">
        <p className="section-index">05 / FAQ</p>
        <h2>关于 MiniMax H3<br />视频提示词案例库</h2>
      </div>
      <div className="faq-list">
        <article>
          <h3>MiniMax H3 和 Hailuo 3.0 是什么关系？</h3>
          <p>本项目把 MiniMax H3 作为模型名称，并同时覆盖社区常用的 Hailuo 3.0 / 海螺 3.0 检索表达，方便找到同一技术生态下的视频案例。</p>
        </article>
        <article>
          <h3>这里有哪些 AI 视频生成模式？</h3>
          <p>当前收录 T2VA 文字生视频、FL2VA 首尾帧条件视频，以及 Ref2VA 全模态参考视频；案例可包含图像、视频、声音、对白和时间轴控制。</p>
        </article>
        <article>
          <h3>X 上发现的案例会自动发布吗？</h3>
          <p>不会。浏览器任务只写入候选队列，先核对模型、作者、原帖、提示词来源和版权风险，再由人工批准进入公开案例库。</p>
        </article>
      </div>
    </section>
  )
}

function CaseDialog({ item, onClose }: { item: VideoCase; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copyPrompt() {
    await navigator.clipboard.writeText(item.prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="case-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" onClick={onClose} aria-label="关闭详情">
          <X size={19} />
        </button>
        <div className="dialog-video">
          {item.mediaUrl ? (
            <video src={item.mediaUrl} poster={item.posterUrl} controls autoPlay playsInline />
          ) : (
            <XPostEmbed sourceUrl={item.sourceUrl} title={item.title} posterUrl={item.posterUrl} />
          )}
        </div>
        <div className="dialog-copy">
          <div className="dialog-eyebrow">
            <span>{item.mode}</span>
            <span>{item.resolution}</span>
            <span>{item.aspectRatio}</span>
            <span>{item.duration} 秒</span>
          </div>
          <h2 id="dialog-title">{item.title}</h2>
          <p className="summary">{item.summary}</p>
          <div className="prompt-heading">
            <span>提示词记录 / PROMPT RECORD · {item.promptProvenance}</span>
            <button onClick={copyPrompt}>
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <pre>{item.prompt}</pre>
          <a className="original-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
            查看原始来源 · {item.sourceLabel} <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
    </div>
  )
}

function Footer() {
  return (
    <footer className="shell">
      <div className="footer-mark">
        <Sparkles size={16} /> OPEN COMMUNITY ARCHIVE
      </div>
      <p>仅收录公开来源；版权归原作者所有。发现错误或希望移除内容，请提交 Issue。</p>
      <span>H3/FN — 2026</span>
    </footer>
  )
}

export default App
