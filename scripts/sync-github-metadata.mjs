import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const execFile = promisify(execFileCallback)
const root = resolve(import.meta.dirname, '..')
const stats = JSON.parse(await readFile(resolve(root, 'data/project-stats.json'), 'utf8'))
const repository = 'SkyNotSilent/awesome-minimax-h3-cases'
const homepage = 'https://h3-field-notes-production.up.railway.app'
const description = `${stats.cases} playable MiniMax H3 / Hailuo H3 cases, ${stats.completePrompts} complete public Prompts, and ${stats.tutorials} source-checked tutorials. Bilingual, traceable, updated continuously.`
const topics = [
  'minimax-h3',
  'hailuo-h3',
  'hailuo-3',
  'ai-video',
  'video-generation',
  'prompts',
  'comfyui',
  'awesome-list',
  'tutorials',
]

if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ repository, homepage, description, topics }, null, 2))
  process.exit(0)
}

const args = ['repo', 'edit', repository, '--description', description, '--homepage', homepage, '--enable-discussions']
for (const topic of topics) args.push('--add-topic', topic)
await execFile('gh', args, { cwd: root })
console.log(`Synced GitHub description, homepage, Discussions, and ${topics.length} topics from project stats.`)
