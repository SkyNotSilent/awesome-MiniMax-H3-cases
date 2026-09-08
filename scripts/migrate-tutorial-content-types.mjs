import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const path = resolve(root, 'data/tutorial-guides.json')
const guides = JSON.parse(await readFile(path, 'utf8'))

const setupIds = new Set(['official-deployment', 'mac-native', 'rent-gpu-comfyui'])
const projectIds = new Set([
  'nvidia-comfyui',
  'context-ir-local-pipeline',
  'video-pov-camera-angles',
  'native-comfyui-modes',
  'prompt-agent-skill',
  'minimax-director-timeline',
  'storyboard-to-trailer',
  '3060-turbo-trailer',
  'dual-clock-audio',
  'ref2v-motion-context-chunks',
])

const pathPattern = /^(?:\.\.?\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+$/
for (const guide of guides) {
  guide.guideType = setupIds.has(guide.id) ? 'setup' : projectIds.has(guide.id) ? 'project' : 'reference'
  if (guide.commands?.length) {
    guide.commandItems = guide.commands.map((value) => ({
      kind: pathPattern.test(value) ? 'path' : 'command',
      value,
      ...(pathPattern.test(value) ? {} : { platform: guide.hardwareProfiles?.includes('apple-silicon') ? 'macos' : 'shell' }),
    }))
  }
}

await writeFile(path, `${JSON.stringify(guides, null, 2)}\n`)
console.log(`Classified ${guides.length} tutorial guides by learning intent.`)
