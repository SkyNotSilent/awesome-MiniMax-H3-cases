import { describe, expect, it } from 'vitest'
import {
  collectOriginalMedia,
  draftInlines,
  rewriteOriginalMedia,
  textInlines,
  tutorialOriginalErrors,
  xPayloadToOriginal,
} from './tutorial-original.mjs'

const author = { screen_name: 'maker', name: 'Maker' }

function status(overrides = {}) {
  return {
    id: '100',
    url: 'https://x.com/maker/status/100',
    text: 'First line\n\nSecond paragraph with https://github.com/a/b and @friend',
    created_timestamp: 1786000000,
    author,
    ...overrides,
  }
}

const localImage = { src: '/tutorial-media/demo/1.webp', width: 800, height: 450 }

describe('inline conversion', () => {
  it('splits Draft.js text at style and link boundaries using UTF-16 offsets', () => {
    const block = {
      text: '🙂 bold link tail',
      inlineStyleRanges: [{ offset: 3, length: 4, style: 'Bold' }],
      entityRanges: [{ key: 7, offset: 8, length: 4 }],
    }
    const entities = new Map([[7, { type: 'LINK', data: { url: 'https://example.com/x' } }]])
    expect(draftInlines(block, (key) => entities.get(key))).toEqual([
      { t: '🙂 ' },
      { t: 'bold', b: true },
      { t: ' ' },
      { t: 'link', href: 'https://example.com/x' },
      { t: ' tail' },
    ])
  })

  it('drops unsafe link targets but keeps their text', () => {
    const block = { text: 'click', inlineStyleRanges: [], entityRanges: [{ key: 1, offset: 0, length: 5 }] }
    expect(draftInlines(block, () => ({ type: 'LINK', data: { url: 'javascript:alert(1)' } }))).toEqual([{ t: 'click' }])
  })

  it('links bare URLs and X handles in post text', () => {
    expect(textInlines('see https://github.com/a/b, thanks @friend!')).toEqual([
      { t: 'see ' },
      { t: 'https://github.com/a/b', href: 'https://github.com/a/b' },
      { t: ', thanks ' },
      { t: '@friend', href: 'https://x.com/friend' },
      { t: '!' },
    ])
  })
})

describe('X payload conversion', () => {
  it('turns an author thread into ordered sections with paragraphs, media, and quotes', () => {
    const payload = {
      thread: [
        status({
          media: { all: [{ type: 'photo', id: '9', url: 'https://pbs.twimg.com/media/a.jpg?name=orig', width: 1600, height: 900, altText: 'A frame' }] },
          quote: { url: 'https://x.com/other/status/5', text: 'Quoted text', author: { screen_name: 'other', name: 'Other' }, media: { all: [] } },
        }),
        status({ id: '101', url: 'https://x.com/maker/status/101', text: 'Watch https://www.youtube.com/watch?v=8Ug0dA4jXyY', media: { all: [{ type: 'video', id: '77', url: 'https://video.twimg.com/v.mp4', thumbnail_url: 'https://pbs.twimg.com/thumb.jpg', width: 1280, height: 720, duration: 5.5, formats: [{ container: 'mp4', url: 'https://video.twimg.com/v.mp4', bitrate: 2000 }] }] } }),
        status({ id: '102', url: 'https://x.com/someone/status/102', author: { screen_name: 'someone', name: 'Someone' } }),
      ],
    }
    const original = xPayloadToOriginal(payload, { tutorialId: 'demo', capturedAt: '2026-09-13T00:00:00.000Z', language: 'en' })
    expect(original.kind).toBe('x-thread')
    expect(original.sections).toHaveLength(2)
    expect(original.sections[0].url).toBe('https://x.com/maker/status/100')
    expect(original.sections[0].blocks.map((block) => block.type)).toEqual(['paragraph', 'paragraph', 'image', 'post-quote'])
    expect(original.sections[1].blocks.map((block) => block.type)).toEqual(['paragraph', 'youtube', 'video'])
    expect(original.sections[1].blocks[1]).toEqual({ type: 'youtube', videoId: '8Ug0dA4jXyY' })
  })

  it('converts an X Article with headings, grouped lists, code, dividers, and images', () => {
    const article = {
      title: 'Guide title',
      cover_media: { media_id: '1', media_info: { original_img_url: 'https://pbs.twimg.com/media/cover.jpg', original_img_width: 2000, original_img_height: 800 } },
      media_entities: [{ media_id: '2', media_info: { __typename: 'ApiImage', original_img_url: 'https://pbs.twimg.com/media/b.png', original_img_width: 900, original_img_height: 500 } }],
      content: {
        blocks: [
          { type: 'header-two', text: 'Setup', inlineStyleRanges: [], entityRanges: [] },
          { type: 'unordered-list-item', text: 'one', inlineStyleRanges: [], entityRanges: [] },
          { type: 'unordered-list-item', text: 'two', inlineStyleRanges: [], entityRanges: [], depth: 1 },
          { type: 'ordered-list-item', text: 'first', inlineStyleRanges: [], entityRanges: [] },
          { type: 'atomic', text: ' ', inlineStyleRanges: [], entityRanges: [{ key: 0, offset: 0, length: 1 }] },
          { type: 'atomic', text: ' ', inlineStyleRanges: [], entityRanges: [{ key: 1, offset: 0, length: 1 }] },
          { type: 'atomic', text: ' ', inlineStyleRanges: [], entityRanges: [{ key: 2, offset: 0, length: 1 }] },
          { type: 'blockquote', text: 'note', inlineStyleRanges: [], entityRanges: [] },
        ],
        entityMap: [
          { key: '0', value: { type: 'MARKDOWN', data: { markdown: '```bash\nnpm install\n```' } } },
          { key: '1', value: { type: 'DIVIDER', data: {} } },
          { key: '2', value: { type: 'MEDIA', data: { mediaItems: [{ mediaId: '2' }] } } },
        ],
      },
    }
    const original = xPayloadToOriginal({ thread: [status({ text: '', article })] }, { tutorialId: 'demo', capturedAt: '2026-09-13T00:00:00.000Z', language: 'zh' })
    expect(original.kind).toBe('x-article')
    expect(original.title).toBe('Guide title')
    expect(original.cover).toMatchObject({ width: 2000, height: 800 })
    expect(original.sections[0].blocks).toEqual([
      { type: 'heading', level: 3, inlines: [{ t: 'Setup' }] },
      { type: 'list', ordered: false, items: [{ depth: 0, inlines: [{ t: 'one' }] }, { depth: 1, inlines: [{ t: 'two' }] }] },
      { type: 'list', ordered: true, items: [{ depth: 0, inlines: [{ t: 'first' }] }] },
      { type: 'code', language: 'bash', text: 'npm install' },
      { type: 'divider' },
      { type: 'image', remote: { url: 'https://pbs.twimg.com/media/b.png' }, mediaId: '2', width: 900, height: 500 },
      { type: 'quote', inlines: [{ t: 'note' }] },
    ])
  })
})

describe('media mirroring and contract', () => {
  it('collects remote media once and rewrites them to mirrored local paths', () => {
    const original = xPayloadToOriginal({
      thread: [status({ media: { all: [{ type: 'video', id: '77', url: 'https://video.twimg.com/v.mp4', thumbnail_url: 'https://pbs.twimg.com/thumb.jpg', width: 1280, height: 720, formats: [] }] } })],
    }, { tutorialId: 'demo', capturedAt: '2026-09-13T00:00:00.000Z', language: 'en' })
    const media = collectOriginalMedia(original)
    expect(media.map((item) => [item.kind, item.key])).toEqual([['video', '77'], ['image', '77-poster']])
    const mirrored = rewriteOriginalMedia(original, new Map([
      ['77', { src: '/media/tutorial-77.mp4' }],
      ['77-poster', { src: '/tutorial-media/demo/77-poster.webp', width: 1280, height: 720 }],
    ]))
    const video = mirrored.sections[0].blocks.find((block) => block.type === 'video')
    expect(video).toEqual({ type: 'video', src: '/media/tutorial-77.mp4', poster: '/tutorial-media/demo/77-poster.webp', width: 1280, height: 720 })
    expect(tutorialOriginalErrors(mirrored)).toEqual([])
  })

  it('rejects remote media, unsafe links, and unknown block types', () => {
    const base = {
      tutorialId: 'demo',
      kind: 'x-thread',
      language: 'en',
      capturedAt: '2026-09-13T00:00:00.000Z',
      source: { url: 'https://x.com/maker/status/100', author: 'Maker' },
      sections: [{ blocks: [{ type: 'image', ...localImage }] }],
    }
    expect(tutorialOriginalErrors(base)).toEqual([])
    const remote = structuredClone(base)
    remote.sections[0].blocks[0] = { type: 'image', src: 'https://pbs.twimg.com/a.jpg', width: 1, height: 1 }
    expect(tutorialOriginalErrors(remote)).toContain('original.sections[0].blocks[0].src: mirrored media required')
    const unsafe = structuredClone(base)
    unsafe.sections[0].blocks[0] = { type: 'paragraph', inlines: [{ t: 'x', href: 'javascript:alert(1)' }] }
    expect(tutorialOriginalErrors(unsafe)).toContain('original.sections[0].blocks[0].inlines[0].href: HTTP(S) URL required')
    const unknown = structuredClone(base)
    unknown.sections[0].blocks[0] = { type: 'html', html: '<script>' }
    expect(tutorialOriginalErrors(unknown)).toContain('original.sections[0].blocks[0].type: unsupported block')
  })
})
