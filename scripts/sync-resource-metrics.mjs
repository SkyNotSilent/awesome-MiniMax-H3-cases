import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const resourcePath = resolve(root, 'data/tutorials.json')
const resources = JSON.parse(await readFile(resourcePath, 'utf8'))
const write = process.argv.includes('--write')
const snapshotAt = new Date().toISOString().slice(0, 10)
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'awesome-minimax-h3-cases-resource-sync',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}

for (const resource of resources) {
  const match = resource.url.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)\/?$/i)
  if (!match) continue
  const response = await fetch(`https://api.github.com/repos/${match[1]}`, { headers })
  if (!response.ok) throw new Error(`GitHub metrics failed for ${match[1]}: ${response.status}`)
  const repository = await response.json()
  resource.stars = repository.stargazers_count
  resource.forks = repository.forks_count
  resource.pushedAt = repository.pushed_at
  resource.snapshotAt = snapshotAt
}

if (write) {
  await writeFile(resourcePath, `${JSON.stringify(resources, null, 2)}\n`)
  console.log(`Updated dated GitHub metrics for ${resources.length} tutorial resources.`)
} else {
  console.log(JSON.stringify(resources.map(({ id, stars, forks, pushedAt }) => ({ id, stars, forks, pushedAt })), null, 2))
}
