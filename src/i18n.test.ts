import { describe, expect, it } from 'vitest'
import rawCases from '../data/cases.json'
import { detectVisitorLanguage, metadataValue, modelLabel } from './i18n'
import type { VideoCase } from './types'

const cases = rawCases as VideoCase[]

describe('case metadata localization', () => {
  it('removes Chinese comparison and source-note metadata from English dialogs', () => {
    const comparison = cases.find((item) => item.id === 'x-yukyuk-h3-seedance-same-prompt')
    expect(comparison).toBeDefined()
    expect(modelLabel(comparison!, 'en')).toBe('MiniMax H3 vs Seedance 2 (creator-identified)')
    expect(metadataValue(comparison!.resolution, 'en')).toBe('Not specified in the original post')
    expect(metadataValue('原帖', 'en')).toBe('Original post')
  })
})

describe('visitor language detection', () => {
  it('uses Chinese for a Chinese browser or China time zone and English elsewhere', () => {
    expect(detectVisitorLanguage(['zh-CN', 'en-US'], 'America/New_York')).toBe('zh')
    expect(detectVisitorLanguage(['en-US'], 'Asia/Shanghai')).toBe('zh')
    expect(detectVisitorLanguage(['en-US', 'fr-FR'], 'Europe/Paris')).toBe('en')
  })
})
