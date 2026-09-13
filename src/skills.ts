import type { SkillPackage } from './types'

// Multi-skill and catalog packages install at repository level, where the CLI offers
// every skill for selection; a single skill installs from its own directory.
export function skillInstallCommand(item: SkillPackage, target?: SkillPackage['skills'][number]) {
  const skill = target ?? (item.skills.length === 1 ? item.skills[0] : undefined)
  if (!skill) return `npx skills add ${item.repository}`
  const directory = skill.path.includes('/') ? skill.path.slice(0, skill.path.lastIndexOf('/')) : ''
  return `npx skills add https://github.com/${item.repository}/tree/${item.branch}${directory ? `/${directory}` : ''}`
}

export function skillAnchor(name: string) {
  return `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
}
