import { describe, expect, it } from 'vitest'
import taxonomy from '../data/taxonomy.json'
import schema from '../data/schema.json'
import {
  classifyLegacyCase,
  migrateCaseTaxonomy,
  stripTaxonomyFields,
} from './migrate-taxonomy.mjs'
import {
  sanitizeTaxonomyClassification,
  taxonomyKeys,
  taxonomyLabel,
} from './taxonomy.mjs'

describe('fixed case taxonomy', () => {
  it('keeps the public vocabulary at the approved 10/12/14 entries', () => {
    expect(taxonomy.categories).toHaveLength(10)
    expect(taxonomy.styles).toHaveLength(12)
    expect(taxonomy.scenes).toHaveLength(14)
    expect(taxonomyKeys('categories')).toContain('showcase')
    expect(taxonomyLabel('cinematic', 'zh', 'categories')).toBe('电影叙事')
    expect(taxonomyLabel('cinematic', 'en', 'categories')).toBe('Cinematic & Narrative')
  })

  it('filters invalid values, removes duplicates, and caps multi-value facets at two', () => {
    expect(sanitizeTaxonomyClassification({
      category: 'cinematic',
      styles: ['photoreal', 'photoreal', 'retro', 'not-public'],
      scenes: ['city', 'nature', 'fantasy'],
    })).toEqual({
      category: 'cinematic',
      styles: ['photoreal', 'retro'],
      scenes: ['city', 'nature'],
      invalidValues: ['styles:not-public'],
    })
  })

  it('keeps the JSON schema enums synchronized with the taxonomy file', () => {
    expect(schema.properties.category.enum).toEqual(taxonomy.categories.map((entry) => entry.key))
    expect(schema.properties.styles.items.enum).toEqual(taxonomy.styles.map((entry) => entry.key))
    expect(schema.properties.scenes.items.enum).toEqual(taxonomy.scenes.map((entry) => entry.key))
    expect(schema.properties.styles.maxItems).toBe(2)
    expect(schema.properties.scenes.maxItems).toBe(2)
  })
})

describe('legacy taxonomy migration', () => {
  it('does not mistake Seedance for a dance case', () => {
    const result = classifyLegacyCase({
      id: 'seedance-comparison',
      title: '同场景双模型的电影感对比',
      titleEn: 'Cinematic Comparison of Two Models on the Same Scene',
      summary: '比较 MiniMax H3 与 Seedance 2.5。',
      summaryEn: 'A comparison between MiniMax H3 and Seedance 2.5.',
      sourceCaption: 'MiniMax H3 vs Seedance 2.5',
      category: 'Local Generation & Dance',
      styles: ['Dance'],
      scenes: ['Character dance'],
    })
    expect(result.category).toBe('comparison')
    expect(result.scenes).not.toContain('dance')
  })

  it('allows evidence-poor cases to use showcase with empty style and scene arrays', () => {
    const result = classifyLegacyCase({
      id: 'unknown-demo',
      title: '一次 H3 测试',
      titleEn: 'An H3 test',
      summary: '公开案例。',
      summaryEn: 'A public example.',
      sourceCaption: 'MiniMax H3 test',
      category: 'Community Showcase',
      styles: ['Unspecified'],
      scenes: ['MiniMax H3 test clip'],
    })
    expect(result).toMatchObject({ category: 'showcase', styles: [], scenes: [] })
  })

  it('changes only category, styles, and scenes and is idempotent', () => {
    const original = {
      id: 'case-1',
      title: '霓虹城市追逐',
      titleEn: 'A Neon City Chase',
      summary: '车辆穿过雨夜城市。',
      summaryEn: 'A vehicle crosses a rainy city at night.',
      sourceCaption: 'cinematic chase',
      category: 'Cinematic & VFX',
      styles: ['Cinematic', 'Neon', 'Action'],
      scenes: ['Vehicle Chase', 'Rainy street'],
      tags: ['MiniMax H3', '原标签'],
      mode: 'Unknown',
      addedAt: '2026-08-01T00:00:00.000Z',
      prompt: null,
      sourceUrl: 'https://x.com/example/status/1',
      engagement: { views: 1 },
    }
    const migrated = migrateCaseTaxonomy(original)
    expect(stripTaxonomyFields(migrated)).toEqual(stripTaxonomyFields(original))
    expect(migrated.styles).toHaveLength(2)
    expect(migrateCaseTaxonomy(migrated)).toEqual(migrated)
  })
})
