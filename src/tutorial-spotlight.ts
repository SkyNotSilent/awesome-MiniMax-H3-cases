import type { TutorialGuide } from './types'

export const tutorialSubmissionUrl = 'https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/new?template=tutorial-submission.yml'

export function selectTutorialSpotlights(guides: TutorialGuide[], now: number): TutorialGuide[] {
  const authors = new Set<string>()
  return guides.filter(item => {
    const age = now - Date.parse(item.addedAt)
    return item.contribution && item.contentType === 'community' && item.evidence.status === 'active'
      && age >= 0 && age < 14 * 86400000
  }).sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt) || a.id.localeCompare(b.id)).filter(item => {
    const author = item.contribution!.authorUrl.replace(/\/+$/, '').toLowerCase()
    if (authors.has(author)) return false
    authors.add(author)
    return true
  }).slice(0, 3)
}
