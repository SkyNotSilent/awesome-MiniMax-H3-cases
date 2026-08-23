import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const skills = ['minimax-h3-prompt-library', 'minimax-h3-tutorial-guide']

for (const skill of skills) {
  const directory = resolve(root, 'agents/skills', skill)
  const [markdown, metadata, manifest] = await Promise.all([
    readFile(resolve(directory, 'SKILL.md'), 'utf8'),
    readFile(resolve(directory, 'agents/openai.yaml'), 'utf8'),
    readFile(resolve(directory, 'package.json'), 'utf8').then(JSON.parse),
  ])

  if (!markdown.startsWith('---\n')) throw new Error(`${skill}: SKILL.md is missing YAML frontmatter`)
  if (!markdown.includes(`name: ${skill}`)) throw new Error(`${skill}: frontmatter name does not match directory`)
  if (manifest.name !== skill) throw new Error(`${skill}: package name does not match directory`)
  if (!markdown.includes(`version: ${manifest.version}`)) throw new Error(`${skill}: package and skill versions differ`)
  if (!metadata.includes('display_name:')) throw new Error(`${skill}: OpenAI interface metadata is incomplete`)
}

const promptSkill = await readFile(resolve(root, 'agents/skills/minimax-h3-prompt-library/SKILL.md'), 'utf8')
const tutorialSkill = await readFile(resolve(root, 'agents/skills/minimax-h3-tutorial-guide/SKILL.md'), 'utf8')
if (!/never (create|generate)/i.test(promptSkill)) throw new Error('Prompt skill must explicitly reject generated prompts')
if (!/Never guess missing/i.test(tutorialSkill)) throw new Error('Tutorial skill must explicitly reject guessed commands')

console.log(`Validated ${skills.length} installable MiniMax H3 Agent Skills.`)
