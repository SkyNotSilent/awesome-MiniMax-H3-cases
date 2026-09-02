import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const REPOSITORY = 'SkyNotSilent/awesome-minimax-h3-cases'
const SNAPSHOT_CAP = 120

const root = resolve(import.meta.dirname, '..')
const historyPath = resolve(root, 'data/traffic-history.json')
const write = process.argv.includes('--write')
const today = new Date().toISOString().slice(0, 10)
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'awesome-minimax-h3-cases-traffic-snapshot',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}

const fetchGithub = async (path) => {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`, { headers })
  if (!response.ok) throw new Error(`GitHub traffic request failed for ${path || '/'}: ${response.status}`)
  return response.json()
}

const previous = existsSync(historyPath)
  ? JSON.parse(await readFile(historyPath, 'utf8'))
  : { repo: REPOSITORY, generatedAt: '', days: [], referrerSnapshots: [], pathSnapshots: [] }

const [repository, views, clones, referrers, paths] = await Promise.all([
  fetchGithub(''),
  fetchGithub('/traffic/views?per=day'),
  fetchGithub('/traffic/clones?per=day'),
  fetchGithub('/traffic/popular/referrers'),
  fetchGithub('/traffic/popular/paths'),
])

const dayIndex = new Map(previous.days.map((day) => [day.date, { ...day }]))
const upsertDay = (date, patch) => {
  const existing = dayIndex.get(date) ?? { date }
  const merged = { ...existing }
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = Math.max(existing[key] ?? 0, value)
  }
  dayIndex.set(date, merged)
}

for (const entry of views.views ?? []) {
  upsertDay(entry.timestamp.slice(0, 10), { views: entry.count, uniqueVisitors: entry.uniques })
}
for (const entry of clones.clones ?? []) {
  upsertDay(entry.timestamp.slice(0, 10), { clones: entry.count, uniqueCloners: entry.uniques })
}
upsertDay(today, {
  stars: repository.stargazers_count,
  forks: repository.forks_count,
  watchers: repository.subscribers_count,
  openIssues: repository.open_issues_count,
})

const replaceTodaySnapshot = (snapshots, top) => [
  ...snapshots.filter((snapshot) => snapshot.date !== today),
  { date: today, top },
].slice(-SNAPSHOT_CAP)

const next = {
  repo: REPOSITORY,
  generatedAt: new Date().toISOString(),
  days: [...dayIndex.values()].sort((a, b) => a.date.localeCompare(b.date)),
  referrerSnapshots: replaceTodaySnapshot(
    previous.referrerSnapshots ?? [],
    (referrers ?? []).map(({ referrer, count, uniques }) => ({ referrer, count, uniques })),
  ),
  pathSnapshots: replaceTodaySnapshot(
    previous.pathSnapshots ?? [],
    (paths ?? []).map(({ path, title, count, uniques }) => ({ path, title, count, uniques })),
  ),
}

const serialize = (history) => `${JSON.stringify({ ...history, generatedAt: undefined }, null, 2)}\n`
const unchanged = existsSync(historyPath) && serialize(previous) === serialize(next)

if (!write) {
  console.log(JSON.stringify(next.days.slice(-14), null, 2))
  console.log(`Dry run: ${next.days.length} days tracked, ${unchanged ? 'no changes' : 'changes pending'}; rerun with --write to persist.`)
} else if (unchanged) {
  console.log('Traffic history unchanged; nothing written.')
} else {
  await writeFile(historyPath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`Updated ${historyPath.replace(`${root}/`, '')} with ${next.days.length} days of traffic history.`)
}
