import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const target = await mkdtemp(join(tmpdir(), 'minimax-h3-skills-'))

try {
  const promptSkill = join(target, 'minimax-h3-prompt-library')
  const tutorialSkill = join(target, 'minimax-h3-tutorial-guide')
  await cp(resolve(root, 'agents/skills/minimax-h3-prompt-library'), promptSkill, { recursive: true })
  await cp(resolve(root, 'agents/skills/minimax-h3-tutorial-guide'), tutorialSkill, { recursive: true })

  const promptResult = JSON.parse(execFileSync(process.execPath, ['scripts/query.mjs', 'city', '--fixture', 'fixtures'], { cwd: promptSkill, encoding: 'utf8' }))
  if (promptResult.matches?.[0]?.publicPrompt !== 'Repository-owned fixture prompt for offline Skill verification.') throw new Error('Installed Prompt Skill failed its offline query.')

  const tutorialResult = JSON.parse(execFileSync(process.execPath, ['scripts/query.mjs', '--hardware', 'apple silicon', '--goal', 'mac', '--fixture', 'fixtures/tutorial-guides.json'], { cwd: tutorialSkill, encoding: 'utf8' }))
  if (tutorialResult.matches?.[0]?.id !== 'skill-tutorial-sample') throw new Error('Installed tutorial Skill failed its offline query.')

  console.log('Verified both data-reading Skills from an isolated installation directory.')
} finally {
  await rm(target, { recursive: true, force: true })
}
