import { describe, expect, it } from 'vitest'
import rawCases from '../data/cases.json'
import { detectVisitorLanguage, metadataValue, modelLabel, resolveRoute, tutorialEcosystemPath, tutorialPath } from './i18n'
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

describe('tutorial routes', () => {
  it('resolves bilingual detail pages and builds equivalent localized paths', () => {
    expect(resolveRoute('/tutorials/mac-native/')).toEqual({ language: 'zh', page: 'tutorial-detail', tutorialSlug: 'mac-native' })
    expect(resolveRoute('/en/tutorials/mac-native/')).toEqual({ language: 'en', page: 'tutorial-detail', tutorialSlug: 'mac-native' })
    expect(tutorialPath('zh', 'mac-native')).toBe('/tutorials/mac-native/')
    expect(tutorialPath('en', 'mac-native')).toBe('/en/tutorials/mac-native/')
  })

  it('resolves the ecosystem collection without treating it as a tutorial slug', () => {
    expect(resolveRoute('/tutorials/ecosystem/')).toEqual({ language: 'zh', page: 'tutorial-ecosystem', tutorialSlug: 'ecosystem' })
    expect(resolveRoute('/en/tutorials/ecosystem/')).toEqual({ language: 'en', page: 'tutorial-ecosystem', tutorialSlug: 'ecosystem' })
    expect(tutorialEcosystemPath('zh')).toBe('/tutorials/ecosystem/')
    expect(tutorialEcosystemPath('en')).toBe('/en/tutorials/ecosystem/')
  })
})
