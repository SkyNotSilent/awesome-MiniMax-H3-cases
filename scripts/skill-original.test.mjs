import { describe, expect, it } from 'vitest'
import { detectLanguage, parseSkillFrontmatter, skillAnchor, skillSection } from './skill-original.mjs'

describe('SKILL.md parsing', () => {
  it('reads plain, quoted, and folded frontmatter values and returns the body', () => {
    const text = ['---', 'name: "h3-prompt-writing"', 'description: >-', '  Write MiniMax H3 prompts.', '  Use for shots and dialogue.', 'license: MIT', '---', '', '# Heading', 'Body'].join('\n')
    expect(parseSkillFrontmatter(text)).toEqual({
      name: 'h3-prompt-writing',
      description: 'Write MiniMax H3 prompts. Use for shots and dialogue.',
      body: '# Heading\nBody',
    })
    expect(parseSkillFrontmatter('# No frontmatter')).toEqual({ name: '', description: '', body: '# No frontmatter' })
  })

  it('builds a titled, anchored section that starts with the author description', () => {
    const section = skillSection({
      text: ['---', 'name: h3-video', 'description: Generate H3 videos', '---', '', '## Steps', '1. Run [it](scripts/run.sh)'].join('\n'),
      repository: 'o/r',
      branch: 'main',
      revision: 'abc',
      path: 'skills/h3-video/SKILL.md',
    })
    expect(section).toEqual({
      url: 'https://github.com/o/r/blob/main/skills/h3-video/SKILL.md',
      title: 'h3-video',
      anchor: 'skill-h3-video',
      blocks: [
        { type: 'quote', inlines: [{ t: 'Generate H3 videos' }] },
        { type: 'heading', level: 3, inlines: [{ t: 'Steps' }] },
        { type: 'list', ordered: true, items: [{ depth: 0, inlines: [{ t: 'Run ' }, { t: 'it', href: 'https://github.com/o/r/blob/main/skills/h3-video/scripts/run.sh' }] }] },
      ],
    })
  })

  it('derives stable anchors and the dominant language', () => {
    expect(skillAnchor('MiniMax h3-video-producer')).toBe('skill-minimax-h3-video-producer')
    expect(detectLanguage('这是一个中文的技能说明，用于生成视频。')).toBe('zh')
    expect(detectLanguage('これは動画を生成するためのスキルです。')).toBe('ja')
    expect(detectLanguage('Generate cinematic videos with H3.')).toBe('en')
  })
})
