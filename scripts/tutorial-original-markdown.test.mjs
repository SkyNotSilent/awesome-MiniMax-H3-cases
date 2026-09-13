import { describe, expect, it } from 'vitest'
import { headingSlug, markdownToOriginalContent, normalizeMdx } from './tutorial-original-markdown.mjs'

const github = {
  resolveLink: (href) => new URL(href, 'https://github.com/o/r/blob/main/').href,
  resolveMedia: (src) => new URL(src, 'https://raw.githubusercontent.com/o/r/abc123/').href,
}

describe('MDX normalization', () => {
  it('turns documentation components into plain Markdown', () => {
    const mdx = [
      '> ## Documentation Index',
      '> Fetch the complete documentation index at: https://docs.comfy.org/llms.txt',
      '',
      '# Page title',
      '',
      '<UpdateReminder />',
      '',
      '<Note>',
      '  Commercial use needs a license.',
      '</Note>',
      '',
      '<CardGroup cols={2}>',
      '  <Card title="Download Workflow" icon="download" href="/templates/t2v">',
      '    Place in <code>ComfyUI/models/</code>',
      '  </Card>',
      '</CardGroup>',
      '',
      '<Steps>',
      '  <Step title="Select a template">',
      '    <img src="https://cdn.example.com/a.webp" alt="Open template" width="800" height="400" />',
      '  </Step>',
      '</Steps>',
      '',
      '<video controls className="w-full" src="https://example.com/out.mp4" />',
    ].join('\n')
    const markdown = normalizeMdx(mdx)
    expect(markdown).not.toContain('Documentation Index')
    expect(markdown).not.toContain('<UpdateReminder')
    expect(markdown).toContain('> Commercial use needs a license.')
    expect(markdown).toContain('- [**Download Workflow**](/templates/t2v) — Place in `ComfyUI/models/`')
    expect(markdown).toContain('#### Select a template')
    expect(markdown).toContain('![Open template](https://cdn.example.com/a.webp)')
    expect(markdown).toContain('<video src="https://example.com/out.mp4"></video>')
  })
})

describe('MDX indentation', () => {
  it('keeps lists nested in components as lists instead of code', () => {
    const mdx = ['<Steps>', '  <Step title="Update inputs">', '    1. First item', '    2. Second item', '       - nested', '  </Step>', '</Steps>'].join('\n')
    const { blocks } = markdownToOriginalContent(normalizeMdx(mdx))
    expect(blocks).toEqual([
      { type: 'heading', level: 4, inlines: [{ t: 'Update inputs' }] },
      { type: 'list', ordered: true, items: [{ depth: 0, inlines: [{ t: 'First item' }] }, { depth: 0, inlines: [{ t: 'Second item' }] }, { depth: 1, inlines: [{ t: 'nested' }] }] },
    ])
  })
})

describe('Markdown conversion', () => {
  it('keeps the document title and converts headings, lists, tables, code, and links', () => {
    const { title, blocks } = markdownToOriginalContent([
      '# Tool name',
      '',
      '[![CI](https://img.shields.io/badge/ci-pass-green.svg)](https://github.com/o/r/actions)',
      '',
      'Read the [guide](docs/guide.md), jump to [usage](#usage), or run `make`.',
      '',
      '## Usage',
      '',
      '1. Install',
      '   - nested **note**',
      '2. Run',
      '',
      '| Mode | Steps |',
      '| --- | --- |',
      '| Turbo | 8 |',
      '',
      '```bash',
      './h3 --help',
      '```',
      '',
      '![Diagram](assets/flow.png)',
      '',
      '---',
    ].join('\n'), github)
    expect(title).toBe('Tool name')
    expect(blocks).toEqual([
      { type: 'paragraph', inlines: [{ t: 'Read the ' }, { t: 'guide', href: 'https://github.com/o/r/blob/main/docs/guide.md' }, { t: ', jump to usage, or run ' }, { t: 'make', c: true }, { t: '.' }] },
      { type: 'heading', level: 3, inlines: [{ t: 'Usage' }] },
      { type: 'list', ordered: true, items: [{ depth: 0, inlines: [{ t: 'Install' }] }, { depth: 1, inlines: [{ t: 'nested ' }, { t: 'note', b: true }] }, { depth: 0, inlines: [{ t: 'Run' }] }] },
      { type: 'table', header: [[{ t: 'Mode' }], [{ t: 'Steps' }]], rows: [[[{ t: 'Turbo' }], [{ t: '8' }]]] },
      { type: 'code', language: 'bash', text: './h3 --help' },
      { type: 'image', remote: { url: 'https://raw.githubusercontent.com/o/r/abc123/assets/flow.png' }, mediaId: expect.stringMatching(/^md-[0-9a-f]{12}$/), alt: 'Diagram' },
      { type: 'divider' },
    ])
  })

  it('keeps code, tables, and images nested in list items and callouts', () => {
    const { blocks } = markdownToOriginalContent([
      '3. Extract the last frame:',
      '   ```bash',
      '   ./scripts/extract.sh segA.mp4',
      '   ```',
      '4. Continue',
      '   1. nested ordered',
      '',
      '> Note:',
      '>',
      '> ```bash',
      '> make',
      '> ```',
    ].join('\n'), github)
    expect(blocks).toEqual([
      { type: 'list', ordered: true, start: 3, items: [
        { depth: 0, inlines: [{ t: 'Extract the last frame:' }], blocks: [{ type: 'code', language: 'bash', text: './scripts/extract.sh segA.mp4' }] },
        { depth: 0, inlines: [{ t: 'Continue' }] },
        { depth: 1, ordered: true, inlines: [{ t: 'nested ordered' }] },
      ] },
      { type: 'quote', inlines: [], blocks: [{ type: 'paragraph', inlines: [{ t: 'Note:' }] }, { type: 'code', language: 'bash', text: 'make' }] },
    ])
  })

  it('names mirrored media by repository path so new commits reuse files', () => {
    const at = (revision) => markdownToOriginalContent('![x](a/b.png)', { ...github, resolveMedia: (src) => new URL(src, `https://raw.githubusercontent.com/o/r/${revision}/`).href }).blocks[0].mediaId
    expect(at('1111111111111111111111111111111111111111')).toBe(at('2222222222222222222222222222222222222222'))
  })

  it('extracts media from raw HTML and drops presentational wrappers', () => {
    const { blocks } = markdownToOriginalContent([
      '<p align="center"><img src="docs/hero.gif" alt="Hero"></p>',
      '',
      '<video src="https://example.com/out.mp4"></video>',
      '',
      '<details><summary>More</summary>Hidden text</details>',
    ].join('\n'), github)
    expect(blocks.map((block) => block.type)).toEqual(['image', 'video', 'paragraph'])
    expect(blocks[1]).toMatchObject({ type: 'video', remote: { url: 'https://example.com/out.mp4', variants: [] } })
    expect(blocks[2]).toEqual({ type: 'paragraph', inlines: [{ t: 'More Hidden text' }] })
  })

  it('limits a captured page to the linked section', () => {
    const markdown = ['# Page', '', '## Text to Video (T2V)', '', 'T2V body', '', '### Tips', '', 'tip', '', '## Image to Video (I2V)', '', 'I2V body', '', '## Next'].join('\n')
    expect(headingSlug('MiniMax H3 Image to Video (I2V)')).toBe('minimax-h3-image-to-video-i2v')
    const { title, blocks } = markdownToOriginalContent(markdown, { ...github, section: 'text-to-video-t2v' })
    expect(title).toBe('Page')
    expect(blocks.map((block) => block.inlines?.[0]?.t)).toEqual(['Text to Video (T2V)', 'T2V body', 'Tips', 'tip'])
  })
})
