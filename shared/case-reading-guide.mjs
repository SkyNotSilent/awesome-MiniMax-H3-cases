export const caseReadingGuide = {
  zh: {
    title: '如何比较这些案例',
    notes: [
      '先按输入条件选模式：T2VA 从文字开始，FL2VA 使用首帧或尾帧，Ref2VA 使用参考素材。再按场景和风格缩小范围，打开案例查看原帖说明和实际输出。',
      '比较同类案例时，留意镜头切换中的主体一致性、运镜连续性，以及对白、环境声与画面事件的同步。分辨率和时长是输出规格；生成速度、显存需求和稳定性还需要在自己的设备上验证。',
      '案例摘要是本站的画面导读；视频、图片和逐字展示的完整 Prompt 属于原作者。来源未公开完整 Prompt 时，先参考已公开的素材和流程，复现条件以原始来源为准。',
    ],
  },
  en: {
    title: 'How to compare these examples',
    notes: [
      'Choose a mode by your inputs: T2VA starts with text, FL2VA uses a first or last frame, and Ref2VA uses reference assets. Narrow the library by scene and style, then open an example to examine its output and source notes.',
      'Compare subject consistency across cuts, camera continuity, and the timing of dialogue or environmental sounds against picture events. Resolution and duration describe the output; speed, VRAM needs, and reliability require checks on your own hardware.',
      'Case summaries are our viewing notes. Videos, images, and complete prompts shown verbatim belong to their creators. When a full prompt is unpublished, consult the available assets and workflow; the original source determines the reproduction conditions.',
    ],
  },
}

export function caseReadingMarkup(locale) {
  const guide = caseReadingGuide[locale === 'en' ? 'en' : 'zh']
  return `<details class="case-reading-guide"><summary>${guide.title}</summary>${guide.notes.map(note => `<p>${note}</p>`).join('')}</details>`
}
