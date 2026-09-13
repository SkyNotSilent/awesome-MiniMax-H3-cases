import type { Language } from './i18n'
import type { TutorialGuide } from './types'

// The form of a tutorial source, independent of its topic and hardware.
export type TutorialFormat = 'article' | 'post' | 'video' | 'repository' | 'documentation'

export const tutorialFormats: TutorialFormat[] = ['article', 'post', 'repository', 'documentation', 'video']

export const tutorialFormatLabels: Record<Language, Record<TutorialFormat, string>> = {
  zh: { article: '长文', post: '帖子', video: '视频', repository: '开源仓库', documentation: '官方文档' },
  en: { article: 'Article', post: 'Post', video: 'Video', repository: 'Repository', documentation: 'Documentation' },
}

export function tutorialFormat(guide: Pick<TutorialGuide, 'source' | 'original'>): TutorialFormat {
  switch (guide.source.platform) {
    case 'x':
      return guide.original?.kind === 'x-article' ? 'article' : 'post'
    case 'reddit':
      return 'post'
    case 'youtube':
      return 'video'
    case 'github':
      return 'repository'
    default:
      return 'documentation'
  }
}
