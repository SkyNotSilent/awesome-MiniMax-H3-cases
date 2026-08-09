export type CaseMode = 'T2VA' | 'FL2VA' | 'Ref2VA' | 'Unknown'

export interface VideoCase {
  id: string
  title: string
  titleEn: string
  model: string
  mode: CaseMode
  summary: string
  summaryEn: string
  prompt: string
  promptEn?: string
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
  promptProvenance: 'official-verbatim' | 'official-adapted' | 'creator-verbatim' | 'reconstructed' | 'unknown'
  sourceType: 'official' | 'x' | 'community'
  verified: boolean
}
