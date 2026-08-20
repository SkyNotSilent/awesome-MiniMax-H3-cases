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
  promptProvenance: 'official-verbatim' | 'creator-verbatim' | 'not-published'
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
