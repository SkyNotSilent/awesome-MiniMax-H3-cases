import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const options = new Map()
for (let index = 0; index < args.length; index++) {
  const name = args[index]
  if (!['--fixture', '--hardware', '--goal'].includes(name)) throw new Error(`Unknown option: ${name}`)
  const value = args[++index]
  if (!value?.trim() || value.startsWith('--')) throw new Error(`Missing value for ${name}`)
  if (options.has(name)) throw new Error(`Duplicate option ${name}`)
  options.set(name, value.trim())
}
const argument = name => options.get(name) || ''
const fixture = argument('--fixture') ? resolve(process.cwd(), argument('--fixture')) : null
const hardware = argument('--hardware').toLowerCase()
const goal = argument('--goal').toLowerCase()
if (!hardware && !goal) throw new Error('Usage: node scripts/query.mjs --hardware <profile> --goal <outcome> [--fixture <file>]')

let payload
if (fixture) payload = JSON.parse(await readFile(fixture, 'utf8'))
else {
  const baseUrl = (process.env.H3_LIBRARY_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/data/tutorial-guides.v2.json`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Tutorial request failed (${response.status}). No steps or commands were invented.`)
  payload = await response.json()
}

// Raw arrays are accepted only by the explicitly requested offline fixture mode.
if (fixture && Array.isArray(payload)) payload = { schemaVersion: 2, contentVersion: 'fixture', guides: payload }
const localized = value => value && typeof value.zh === 'string' && typeof value.en === 'string'
const localizedList = value => value && ['zh', 'en'].every(lang => Array.isArray(value[lang]) && value[lang].every(item => typeof item === 'string'))
if (payload?.schemaVersion !== 2 || typeof payload.contentVersion !== 'string'
  || (!fixture && !/^[a-f0-9]{64}$/.test(payload.contentVersion)) || !Array.isArray(payload.guides)
  || !payload.guides.every(guide => guide && typeof guide.id === 'string'
    && ['setup', 'project', 'reference'].includes(guide.guideType)
    && localized(guide.title) && localized(guide.outcome) && localized(guide.hardware)
    && localizedList(guide.prerequisites) && localizedList(guide.steps) && (!guide.checks || localizedList(guide.checks))
    && typeof guide.source?.url === 'string' && typeof guide.source?.author === 'string'
    && ['active', 'stale', 'unavailable', 'needs-review'].includes(guide.evidence?.status)
    && Number.isFinite(Date.parse(guide.evidence.sourceCheckedAt)))
  || new Set(payload.guides.map(guide => guide.id)).size !== payload.guides.length) {
  throw new Error('Invalid tutorial catalog contract. Lookup failed; no steps or commands were invented.')
}
const guides = payload.guides

const tokens = `${hardware} ${goal}`.split(/\s+/).filter(Boolean)
const matches = guides
  .filter((guide) => guide.evidence?.status === 'active')
  .map((guide) => {
    const haystack = [guide.category, guide.learningTrack, ...(guide.hardwareProfiles || []), ...(guide.tags || []), guide.title?.zh, guide.title?.en, guide.outcome?.zh, guide.outcome?.en, guide.hardware?.zh, guide.hardware?.en].join(' ').toLowerCase()
    return { guide, score: tokens.filter((token) => haystack.includes(token)).length }
  })
  .filter((item) => item.score > 0)
  .sort((a, b) => b.score - a.score || Number(Boolean(b.guide.flagship)) - Number(Boolean(a.guide.flagship)))
  .slice(0, 5)
  .map(({ guide }) => ({ id: guide.id, guideType: guide.guideType, title: guide.title, outcome: guide.outcome, hardware: guide.hardware, prerequisites: guide.prerequisites, steps: guide.steps, commandItems: guide.commandItems || [], checks: guide.checks, troubleshooting: guide.troubleshooting || [], source: guide.source, sourceCheckedAt: guide.evidence.sourceCheckedAt, siteTestedAt: guide.evidence.siteTestedAt || null, difficulty: guide.difficulty, depth: guide.depth, applicableVersions: guide.applicableVersions || [], learningResources: guide.learningResources || [], chapters: guide.chapters || [], expectedResult: guide.expectedResult, caveats: guide.caveats, uninstall: guide.uninstall, sourceRefs: guide.sourceRefs || [], materialsNote: guide.materialsNote }))

console.log(JSON.stringify({ hardware, goal, matches, disclosure: matches.length ? 'Verify the latest upstream README before execution.' : 'No verified match. No steps or commands were invented.' }, null, 2))
