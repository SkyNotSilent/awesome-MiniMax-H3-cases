import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const canonical = await readFile(resolve(root, 'config/site.json'), 'utf8')
for (const skill of ['minimax-h3-prompt-library', 'minimax-h3-tutorial-guide']) {
  const path = resolve(root, `agents/skills/${skill}/scripts/site.json`)
  if (process.argv.includes('--write')) await writeFile(path, canonical)
  else if (await readFile(path, 'utf8') !== canonical) throw new Error('SKILL_SITE_CONFIG_STALE')
}
console.log('Verified bundled Skill site configuration.')
