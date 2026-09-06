import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStaticServer } from './serve-static.mjs'

test('catalog API bounds pages, hides full search text, and rejects stale cursors', async t => {
  const server = await createStaticServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const firstResponse = await fetch(`${base}/api/catalog`)
  assert.equal(firstResponse.status, 200)
  const first = await firstResponse.json()
  assert.equal(first.cases.length, 36)
  assert.ok(first.total > 36)
  assert.ok(first.cases.every(item => item.search === undefined && item.prompt === undefined && item.mediaUrl))
  const second = await (await fetch(`${base}/api/catalog?limit=24&cursor=${encodeURIComponent(first.nextCursor)}`)).json()
  assert.equal(second.cases.length, 24)
  assert.equal(new Set([...first.cases, ...second.cases].map(x => x.id)).size, 60)
  assert.equal((await fetch(`${base}/api/catalog?limit=10000`)).status, 400)
  const stale = JSON.parse(atob(first.nextCursor)); stale.v = 'old'
  assert.equal((await fetch(`${base}/api/catalog?cursor=${encodeURIComponent(btoa(JSON.stringify(stale)))}`)).status, 409)
  const saved = await fetch(`${base}/api/catalog?collection=favorites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorites: [first.cases[0].id] }) })
  assert.match(saved.headers.get('cache-control'), /no-store/)
  assert.equal((await saved.json()).total, 1)
  assert.equal((await fetch(`${base}/api/catalog`, { method: 'POST', body: 'x'.repeat(262145) })).status, 413)
  assert.equal((await fetch(`${base}/build/server-data/catalog.json`)).status, 404)
})
