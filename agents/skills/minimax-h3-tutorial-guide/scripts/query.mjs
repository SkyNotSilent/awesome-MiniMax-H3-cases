import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
function argument(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : ''
}
const fixture = argument('--fixture') ? resolve(process.cwd(), argument('--fixture')) : null
const hardware = argument('--hardware').toLowerCase()
const goal = argument('--goal').toLowerCase()
if (!hardware && !goal) throw new Error('Usage: node scripts/query.mjs --hardware <profile> --goal <outcome> [--fixture <file>]')

let guides
if (fixture) guides = JSON.parse(await readFile(fixture, 'utf8'))
else {
  const baseUrl = (process.env.H3_LIBRARY_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/data/tutorial-guides.json`)
  if (!response.ok) throw new Error(`Tutorial request failed (${response.status}). No steps or commands were invented.`)
  guides = await response.json()
}

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
  .map(({ guide }) => ({ id: guide.id, guideType: guide.guideType, title: guide.title, outcome: guide.outcome, hardware: guide.hardware, prerequisites: guide.prerequisites, steps: guide.steps, commandItems: guide.commandItems || [], checks: guide.checks, troubleshooting: guide.troubleshooting || [], source: guide.source, sourceCheckedAt: guide.evidence.sourceCheckedAt, siteTestedAt: guide.evidence.siteTestedAt || null }))

console.log(JSON.stringify({ hardware, goal, matches, disclosure: matches.length ? 'Verify the latest upstream README before execution.' : 'No verified match. No steps or commands were invented.' }, null, 2))
