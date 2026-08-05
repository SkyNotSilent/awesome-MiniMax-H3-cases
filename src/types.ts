export type CaseMode = 'T2VA' | 'FL2VA' | 'Ref2VA'

export interface VideoCase {
  id: string
  title: string
  titleEn: string
  model: string
  mode: CaseMode
  summary: string
  prompt: string
  sourceUrl: string
  sourceLabel: string
  author: string
  publishedAt: string
  mediaUrl: string
  posterUrl: string
  duration: number
  aspectRatio: string
  resolution: string
  tags: string[]
  category: string
  styles: string[]
  scenes: string[]
  inputTypes: Array<'text' | 'image' | 'video' | 'audio'>
  promptProvenance: 'official-verbatim' | 'official-adapted' | 'creator-verbatim' | 'reconstructed'
  sourceType: 'official' | 'x' | 'community'
  verified: boolean
}
