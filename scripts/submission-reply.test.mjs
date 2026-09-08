import { describe, expect, it } from 'vitest'
import guides from '../data/tutorial-guides.json' with { type: 'json' }
import { publishedReply } from './submission-reply.mjs'

describe('submission publication feedback', () => {
  it('generates both localized tutorial links and the original source without posting', () => {
    const guide = guides.find((item) => item.id === 'minimax-director-timeline')
    const reply = publishedReply('tutorial', guide)
    expect(reply).toContain('/tutorials/minimax-director-timeline/')
    expect(reply).toContain('/en/tutorials/minimax-director-timeline/')
    expect(reply).toContain('https://github.com/imbutus/ComfyUI-MiniMaxDirector')
    expect(reply).toContain('permanent attribution')
  })
})
