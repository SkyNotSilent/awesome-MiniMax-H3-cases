export type CaseMode = 'T2VA' | 'FL2VA' | 'Ref2VA' | 'Unknown'

export interface VideoCase {
  id: string
  title: string
  titleEn: string
  model: string
  mode: CaseMode
  summary: string
  summaryEn: string
  prompt: string | null
  promptSourceUrl?: string
  archiveSourceUrl?: string
  promptCompleteness?: 'complete'
  sourceUrl: string
  sourceLabel: string
  author: string
  publishedAt: string
  mediaUrl?: string | null
  posterUrl: string
  duration: number
  aspectRatio: string
  resolution: string
  tags: string[]
  category: string
  styles: string[]
  scenes: string[]
  inputTypes: Array<'text' | 'image' | 'video' | 'audio' | 'unknown'>
  promptProvenance: 'official-verbatim' | 'creator-verbatim' | 'external-archive-verbatim' | 'not-published'
  sourceType: 'official' | 'x' | 'community'
  verified: boolean
  sourceCaption?: string
  engagement?: {
    replies: number
    reposts: number
    likes: number
    views: number
    snapshotAt?: string
    capturedAt?: string
  }
  approvedAt?: string
  attributionNote?: string
  editorialBasis?: string
}

export type LocalizedText = Record<'zh' | 'en', string>
export type LocalizedList = Record<'zh' | 'en', string[]>

export type TutorialCategory =
  | 'getting-started'
  | 'comfyui'
  | 'prompt'
  | 'acceleration'
  | 'long-video'
  | 'audio'
  | 'training'

export interface TutorialResource {
  id: string
  code: string
  category: 'mac' | 'official' | 'workflow' | 'acceleration' | 'long-video' | 'audio' | 'training' | 'resources'
  featured: boolean
  title: string
  url: string
  kind: LocalizedText
  description: LocalizedText
  audience: LocalizedText
  steps: LocalizedList
  facts: string[]
  tags: string[]
  action: LocalizedText
  verifiedAt: string
  stars?: number
  forks?: number
  pushedAt?: string
  snapshotAt?: string
  requirements?: LocalizedText
  strengths?: LocalizedList
  limitations?: LocalizedList
}

export type TutorialHardwareProfile =
  | 'apple-silicon'
  | 'vram-8'
  | 'vram-12'
  | 'vram-16'
  | 'vram-24-plus'
  | 'cloud-gpu'

export interface TutorialGuide {
  id: string
  contentType: 'foundation' | 'community'
  category: TutorialCategory
  title: LocalizedText
  outcome: LocalizedText
  audience: LocalizedText
  hardware: LocalizedText
  prerequisites: LocalizedList
  steps: LocalizedList
  commands: string[]
  checks?: LocalizedList
  caveats: LocalizedList
  posterUrl: string
  tags: string[]
  relatedResourceIds: string[]
  source: {
    platform: 'docs' | 'github' | 'x'
    url: string
    author: string
    handle?: string
    publishedAt?: string
    originalLanguage: 'zh' | 'en' | 'ja'
  }
  engagement?: {
    replies?: number
    reposts?: number
    likes?: number
    views?: number
    snapshotAt: string
  }
  verifiedAt: string
  flagship?: boolean
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes?: number
  hardwareProfiles?: TutorialHardwareProfile[]
  testedVersions?: string[]
  expectedResult?: LocalizedText
  troubleshooting?: Array<{
    problem: LocalizedText
    solution: LocalizedText
  }>
  uninstall?: LocalizedList
  sourceRefs?: Array<{
    title: string
    url: string
  }>
}
