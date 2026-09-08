import { describe, expect, it } from 'vitest'
import { isOriginalCaseDestination } from './case-source-policy.mjs'

describe('case source destinations', () => {
  it('allows original posts and official model assets', () => {
    for (const url of [
      'https://x.com/creator/status/123456789',
      'https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/example.sh',
      'https://www.reddit.com/r/comfyui/comments/abc123/a_video/',
      'https://www.youtube.com/watch?v=abcdefghijk',
    ]) expect(isOriginalCaseDestination(url)).toBe(true)
  })

  it('rejects catalog sites, home pages and redirect lookalikes', () => {
    for (const url of [
      'https://catalog.example/cases/123',
      'https://x.com/',
      'https://x.com/redirect?url=https://catalog.example',
      'https://x.com.catalog.example/creator/status/123',
      'https://x.com@catalog.example/creator/status/123',
      'https://huggingface.co/another-account/catalog/blob/main/case.md',
      'http://x.com/creator/status/123',
    ]) expect(isOriginalCaseDestination(url)).toBe(false)
  })
})
