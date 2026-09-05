import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path) => readFile(resolve(root, path), 'utf8')

describe('daily taxonomy pipeline wiring', () => {
  it('uses the shared taxonomy contract for text and low-FPS video review', async () => {
    const [classifier, videoReview, config] = await Promise.all([
      read('scripts/classify-candidates.mjs'),
      read('scripts/review-video.mjs'),
      read('config/model-routing.json').then(JSON.parse),
    ])
    expect(classifier).toContain('taxonomyClassifierPrompt()')
    expect(classifier).toContain('classificationError')
    expect(videoReview).toContain('taxonomyClassifierPrompt()')
    expect(videoReview).toContain('taxonomy.invalidValues')
    expect(config.dailyLimits.maxTaxonomyReviews).toBe(15)
  })

  it('publishes independent style and scene arrays and has no category-derived metadata table', async () => {
    const promoter = await read('scripts/promote-candidates.mjs')
    expect(promoter).toContain('resolveCandidateTaxonomy(candidate, caption)')
    expect(promoter).toContain('styles: classification.styles')
    expect(promoter).toContain('scenes: classification.scenes')
    expect(promoter).not.toContain('const categoryMetadata')
  })

  it('documents the fixed vocabulary and evidence-poor fallback', async () => {
    const docs = await Promise.all([
      read('docs/DAILY_COLLECTION_PROMPT.md'),
      read('docs/DISCOVERY_WORKFLOW.md'),
      read('docs/MODEL_ROUTING.md'),
    ])
    for (const document of docs) {
      expect(document).toContain('data/taxonomy.json')
      expect(document).toContain('showcase')
      expect(document).toMatch(/empty arrays|空数组/)
    }
  })
})
