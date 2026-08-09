import { describe, expect, it } from 'vitest'
import rawCases from '../data/cases.json'
import { metadataValue, modelLabel } from './i18n'
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
