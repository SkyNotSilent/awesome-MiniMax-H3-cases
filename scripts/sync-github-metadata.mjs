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

await execFile(
  'gh',
  ['repo', 'edit', repository, '--description', description, '--homepage', homepage, '--enable-discussions'],
  { cwd: root },
)

const topicArgs = ['api', '--method', 'PUT', `repos/${repository}/topics`]
for (const topic of topics) topicArgs.push('-f', `names[]=${topic}`)
await execFile('gh', topicArgs, { cwd: root })
console.log(`Synced GitHub description, homepage, Discussions, and ${topics.length} topics from project stats.`)
