import { describe, expect, it } from 'vitest'
import { categoryForCandidate, sanitizeCandidateClassification } from './candidate-taxonomy.mjs'

describe('daily candidate taxonomy', () => {
  it('rejects values outside the public taxonomy and keeps evidence-poor arrays empty', () => {
    const result = sanitizeCandidateClassification({
      category: 'cinematic',
      styles: ['photoreal', 'made-up-style'],
      scenes: [],
      styleBasis: 'visible live-action frame',
      sceneBasis: '',
    })
    expect(result.styles).toEqual(['photoreal'])
    expect(result.scenes).toEqual([])
    expect(result.invalidValues).toEqual(['styles:made-up-style'])
  })

  it('does not treat the model name Seedance as dance evidence', () => {
    expect(categoryForCandidate({ classification: { category: 'showcase' } }, 'MiniMax H3 vs Seedance 2.5')).toBe('comparison')
    expect(categoryForCandidate({ classification: { category: 'showcase' } }, 'Built locally; comparable to Seedance quality')).toBe('workflow')
  })
})
