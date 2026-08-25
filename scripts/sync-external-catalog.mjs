import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildExternalLedger, sha256 } from './external-catalog.mjs'
import { candidatesPath } from './review-paths.mjs'

const root = resolve(import.meta.dirname, '..')

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

function requestHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'awesome-minimax-h3-cases/1.0 external-catalog-check',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  }
}

async function fetchText(url) {
  const response = await fetch(url, { headers: requestHeaders() })
  if (!response.ok) throw new Error(`External catalog request failed with HTTP ${response.status}.`)
  return response.text()
}

async function remoteCommit(url) {
  const payload = JSON.parse(await fetchText(url))
  const sha = Array.isArray(payload) ? payload[0]?.sha : payload?.sha
  if (!sha) throw new Error('Could not resolve the external catalog commit SHA.')
  return sha
}

const configArg = option('--config')
if (!configArg) throw new Error('Usage: npm run sync:external -- --config <private-config.json> [--force] [--dry-run]')

const configPath = resolve(root, configArg)
const config = await readJson(configPath)
if (!config?.sourceId || !config?.catalogUrl || !config?.commitApiUrl || !config?.ledgerPath) {
  throw new Error('Private config requires sourceId, catalogUrl, commitApiUrl, and ledgerPath.')
}

const ledgerPath = resolve(root, config.ledgerPath)
const previousLedger = await readJson(ledgerPath)
const checkedAt = new Date().toISOString()
const catalogCommit = await remoteCommit(config.commitApiUrl)
const force = process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const publicCases = await readJson(resolve(root, 'data/cases.json'), [])
const candidates = await readJson(candidatesPath, [])
const localDataHash = sha256(JSON.stringify({ publicCases, candidates }))

if (!force && previousLedger?.catalogCommit === catalogCommit && previousLedger?.localDataHash === localDataHash) {
  const unchanged = { ...previousLedger, checkedAt }
  if (!dryRun) {
    await mkdir(dirname(ledgerPath), { recursive: true })
    await writeFile(ledgerPath, `${JSON.stringify(unchanged, null, 2)}\n`)
  }
  console.log(JSON.stringify({ changed: false, catalogCommit, counts: unchanged.counts, checkedAt }))
  process.exit(0)
}

const catalogText = await fetchText(config.catalogUrl)
const catalog = JSON.parse(catalogText)
const ledger = buildExternalLedger({
  sourceId: config.sourceId,
  catalog,
  catalogCommit,
  catalogHash: sha256(catalogText),
  localDataHash,
  checkedAt,
  previousLedger,
  publicCases,
  candidates,
  batchLimit: Number(config.batchLimit) || 25,
})

if (!dryRun) {
  await mkdir(dirname(ledgerPath), { recursive: true })
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
}

console.log(JSON.stringify({
  changed: true,
  catalogCommit,
  catalogHash: ledger.catalogHash,
  counts: ledger.counts,
  checkedAt,
}))
