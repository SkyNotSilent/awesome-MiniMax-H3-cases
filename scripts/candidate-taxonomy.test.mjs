import { describe, expect, it } from 'vitest'
import taxonomy from '../data/taxonomy.json' with { type: 'json' }
import {
  categoryForCandidate,
  resolveCandidateTaxonomy,
  sanitizeCandidateClassification,
  taxonomyClassifierPrompt,
} from './candidate-taxonomy.mjs'

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

  it('builds the classifier contract from the single public taxonomy source', () => {
    const prompt = taxonomyClassifierPrompt()
    for (const kind of ['categories', 'styles', 'scenes']) {
      for (const entry of taxonomy[kind]) expect(prompt).toContain(entry.key)
    }
    expect(prompt).toContain('at most 2')
    expect(prompt).toContain('empty arrays')
    expect(prompt).toContain('Never infer, reconstruct, complete, paraphrase, or translate a prompt')
  })

  it('keeps independently classified styles and scenes without deriving them from category', () => {
    expect(resolveCandidateTaxonomy({
      classification: {
        category: 'music',
        styles: ['retro', 'ugc'],
        scenes: ['performance'],
      },
    }, 'A singer performs on stage')).toEqual({
      category: 'music',
      styles: ['retro', 'ugc'],
      scenes: ['performance'],
      needsVideoReview: false,
    })
  })

  it('marks evidence-poor showcase candidates for private video review', () => {
    expect(resolveCandidateTaxonomy({ classification: { category: 'showcase', styles: [], scenes: [] } }, 'H3 test')).toEqual({
      category: 'showcase',
      styles: [],
      scenes: [],
      needsVideoReview: true,
    })
  })

  it('uses a validated low-FPS review to refine an evidence-poor text result', () => {
    expect(resolveCandidateTaxonomy({
      classification: { category: 'showcase', styles: [], scenes: [] },
      videoReview: { category: 'animation', styles: ['anime'], scenes: ['fantasy'] },
    }, 'H3 test')).toEqual({
      category: 'animation',
      styles: ['anime'],
      scenes: ['fantasy'],
      needsVideoReview: false,
    })
  })

  it('refuses classifier values outside the taxonomy before publication', () => {
    expect(() => resolveCandidateTaxonomy({
      classification: { category: 'cinematic', styles: ['Cinematic'], scenes: ['city'] },
    }, '')).toThrow(/outside data\/taxonomy\.json/)
  })
})
