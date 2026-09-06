import { readCatalogSnapshot, encodeCatalogSnapshot } from './catalog-snapshot.mjs'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir, platform, arch, cpus } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'
import { createStaticServer } from './serve-static.mjs'
import { createCatalogIndex, queryCatalog } from '../shared/catalog-query.mjs'
const execute = promisify(execFile)
if (process.argv.includes('--worker')) {
  const file = process.argv.at(-1), started = performance.now()
  const server = await createStaticServer({ catalogPath: file, videoStore: null })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const startupMs = performance.now() - started
  const base = `http://127.0.0.1:${server.address().port}/api/catalog`
  const queries = ['', '?category=comparison', '?q=camera&language=en', '?scene=city', '?collection=featured', '?duration=OVER_15', '?prompt=1']
  const times = [], roundTrips = [], statuses = []
  for (let wave = 0; wave < 5; wave++) await Promise.all(Array.from({ length: 20 }, async (_, i) => {
    const start = performance.now()
    const response = await fetch(`${base}${queries[(wave * 20 + i) % queries.length]}`)
    await response.arrayBuffer()
    times.push(Number(response.headers.get('server-timing')?.split('dur=')[1]))
    roundTrips.push(performance.now() - start); statuses.push(response.status)
  }))
  const p95 = values => values.sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]
  const metrics = { startupMs, p95Ms: p95(times), roundTripP95Ms: p95(roundTrips), rssMiB: process.memoryUsage().rss / 1048576, errors: statuses.filter(x => x >= 500).length }
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  console.log(JSON.stringify(metrics))
  if (metrics.startupMs > 5000 || metrics.p95Ms > 100 || metrics.errors || metrics.rssMiB > 256) process.exitCode = 1
} else {
  const directory = await mkdtemp(join(tmpdir(), 'h3-capacity-'))
  try {
    const base = await readCatalogSnapshot(new URL('../build/server-data/catalog.ndjson', import.meta.url))
    console.log(JSON.stringify({ node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0].model, concurrency: 20 }))
    for (const count of [base.cases.length, 5000, 10000]) {
      const started = performance.now()
      const data = count === base.cases.length ? base : { ...base, catalogVersion: `capacity-${count}`, cases: Array.from({ length: count }, (_, i) => {
        const original = base.cases[i % base.cases.length]
        const entropy = createHash('sha256').update(`case-${i}`).digest('hex')
        return { ...original, id: `capacity-${i}`, addedAt: new Date(Date.UTC(2026, 0, 1) + i * 7217000).toISOString(), title: `${original.title} ${entropy.slice(0, 12)}`, titleEn: `${original.titleEn} ${entropy.slice(12, 24)}`, search: { zh: `${original.search.zh} ${entropy}`, en: `${original.search.en} ${entropy}` } }
      }) }
      const file = join(directory, `${count}.ndjson`), bytes = encodeCatalogSnapshot(data)
      await writeFile(file, bytes)
      const index = createCatalogIndex(data)
      const first = queryCatalog(index), firstBytes = JSON.stringify(first)
      const next = queryCatalog(index, new URLSearchParams({ limit: '24', cursor: first.nextCursor }))
      const budgets = { firstGzip: gzipSync(firstBytes).length, firstDecoded: Buffer.byteLength(firstBytes), nextGzip: gzipSync(JSON.stringify(next)).length, facetsGzip: gzipSync(JSON.stringify(first.facets)).length }
      if (budgets.firstGzip > 51200 || budgets.firstDecoded > 256000 || budgets.nextGzip > 40960 || budgets.facetsGzip > 8192) throw new Error(`API capacity budget failed: ${JSON.stringify(budgets)}`)
      const artifact = { count, buildMs: performance.now() - started, serverBytes: Buffer.byteLength(bytes), serverGzip: gzipSync(bytes).length, ...budgets }
      try {
        const { stdout } = await execute(process.execPath, [import.meta.filename, '--worker', file], { maxBuffer: 1024 * 1024 })
        console.log(JSON.stringify({ ...artifact, ...JSON.parse(stdout) }))
      } catch (error) {
        console.error(JSON.stringify({ ...artifact, workerOutput: error.stdout }))
        throw new Error('Catalog capacity targets failed', { cause: error })
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
}
