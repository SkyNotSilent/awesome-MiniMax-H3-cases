import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? resolve(process.cwd(), process.argv[index + 1]) : fallback
}

function statusId(value) {
  try {
    const url = new URL(value)
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) return null
    return url.pathname.match(/\/status\/(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

export function stageCandidates(candidates, config, taxonomy) {
  if (!config?.dryRun || config.network || config.publish || config.storage) {
    throw new Error('Public demo config must keep dryRun=true and network/publish/storage=false.')
  }
  const categories = new Set(taxonomy.categories.map((entry) => entry.key))
  const styles = new Set(taxonomy.styles.map((entry) => entry.key))
  const scenes = new Set(taxonomy.scenes.map((entry) => entry.key))
  const seen = new Set()
  const staged = []
  const rejected = []
  const duplicates = []

  for (const [index, candidate] of candidates.entries()) {
    const id = statusId(candidate.sourceUrl)
    if (!id) { rejected.push({ index, reason: 'invalid-original-x-status' }); continue }
    if (seen.has(id)) { duplicates.push({ index, statusId: id }); continue }
    seen.add(id)
    if (!config.allowedModels.includes(candidate.model)) { rejected.push({ index, statusId: id, reason: 'model-not-allowed' }); continue }
    if (!categories.has(candidate.category)
      || candidate.styles?.some((value) => !styles.has(value))
      || candidate.scenes?.some((value) => !scenes.has(value))) {
      rejected.push({ index, statusId: id, reason: 'invalid-taxonomy' }); continue
    }
    const hasPrompt = Boolean(candidate.prompt?.trim())
    if (hasPrompt && (candidate.promptProvenance !== 'creator-verbatim' || candidate.promptCompleteness !== 'complete')) {
      rejected.push({ index, statusId: id, reason: 'prompt-provenance-incomplete' }); continue
    }
    if (!hasPrompt && candidate.promptProvenance !== 'not-published') {
      rejected.push({ index, statusId: id, reason: 'missing-prompt-must-be-not-published' }); continue
    }
    staged.push({
      statusId: id,
      sourceUrl: `https://x.com/i/status/${id}`,
      author: candidate.author,
      model: candidate.model,
      category: candidate.category,
      styles: candidate.styles ?? [],
      scenes: candidate.scenes ?? [],
      promptAvailable: hasPrompt,
      nextRequiredGate: 'browser-source-and-media-verification',
    })
  }

  return {
    version: 1,
    dryRun: true,
    networkRequests: 0,
    filesWritten: 0,
    inputCount: candidates.length,
    stagedCount: staged.length,
    duplicateCount: duplicates.length,
    rejectedCount: rejected.length,
    staged,
    duplicates,
    rejected,
  }
}

const inputPath = option('--input', resolve(root, 'examples/collection/candidates.json'))
const configPath = option('--config', resolve(root, 'examples/collection/config.json'))
const [candidates, config, taxonomy] = await Promise.all([
  readFile(inputPath, 'utf8').then(JSON.parse),
  readFile(configPath, 'utf8').then(JSON.parse),
  readFile(resolve(root, 'data/taxonomy.json'), 'utf8').then(JSON.parse),
])
console.log(JSON.stringify(stageCandidates(candidates, config, taxonomy), null, 2))
