import { describe, expect, it } from 'vitest'
import { skillAnchor, skillInstallCommand } from './skills'
import type { SkillPackage } from './types'

const base = { repository: 'o/r', branch: 'main', skills: [] } as unknown as SkillPackage
const skill = (path: string, name = 'demo') => ({ name, path, description: '' })

describe('skill install commands', () => {
  it('installs a single skill from its directory', () => {
    expect(skillInstallCommand({ ...base, skills: [skill('skills/demo/SKILL.md')] })).toBe('npx skills add https://github.com/o/r/tree/main/skills/demo')
  })

  it('installs multi-skill and catalog packages at repository level', () => {
    expect(skillInstallCommand({ ...base, skills: [skill('skills/a/SKILL.md', 'a'), skill('skills/b/SKILL.md', 'b')] })).toBe('npx skills add o/r')
    expect(skillInstallCommand({ ...base, catalog: true })).toBe('npx skills add o/r')
  })

  it('selects a root SKILL.md by name and keeps per-skill commands exact', () => {
    const item = { ...base, skills: [skill('SKILL.md', 'root-skill'), skill('.agents/skills/turbo/SKILL.md', 'turbo')] }
    expect(skillInstallCommand(item, item.skills[0])).toBe('npx skills add o/r --skill root-skill')
    expect(skillInstallCommand(item, item.skills[1])).toBe('npx skills add https://github.com/o/r/tree/main/.agents/skills/turbo')
    expect(skillAnchor('MiniMax h3-video-producer')).toBe('skill-minimax-h3-video-producer')
  })
})
