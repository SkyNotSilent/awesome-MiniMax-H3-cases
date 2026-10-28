import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createStaticServer } from './serve-static.mjs'

test('advertising endpoints and verification work without accounts or an enabled ad service', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'h3-advertising-'))
  await writeFile(join(directory, 'index.html'), '<!doctype html><head></head><body>Catalog</body>')
  await writeFile(join(directory, 'domain.html'), '<!doctype html><head></head><body>Root entry</body>')
  await writeFile(join(directory, 'robots.txt'), 'User-agent: *\nAllow: /\n')
  await writeFile(join(directory, 'sitemap.xml'), '<urlset></urlset>')
  await writeFile(join(directory, 'asset.txt'), 'Static asset')
  const advertisingEnv = { ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456', ADSENSE_ENABLED: 'false', GOOGLE_CLIENT_SECRET: 'private-value' }
  const server = await createStaticServer({ distDir: directory, catalogPath: null, videoStore: { sign: async () => 'https://media.example.test/play.mp4' }, accountApi: { handle: async () => false, close: async () => {} }, advertisingEnv, production: false })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const call = (path, host = 'awesome-minimax-h3-cases.zzskysilent.com', method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method, headers: { Host: host } }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject); req.end()
  })
  try {
    const config = await call('/ads-config.json?ignored=1')
    assert.equal(config.status, 200)
    assert.equal(JSON.parse(config.body).enabled, false)
    assert.equal(config.headers['cache-control'], 'no-store')
    assert.ok(!config.body.includes('private-value'))
    const txt = await call('/ads.txt', 'zzskysilent.com')
    assert.equal(txt.status, 200)
    assert.match(txt.headers['content-type'], /^text\/plain/)
    assert.equal(txt.body, 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n')
    const head = await call('/ads.txt', 'zzskysilent.com', 'HEAD')
    assert.equal(head.body, '')
    assert.equal(head.headers['content-length'], txt.headers['content-length'])
    assert.equal((await call('/ads.txt', 'zzskysilent.com', 'POST')).status, 405)
    const root = await call('/', 'zzskysilent.com')
    assert.equal(root.status, 308)
    assert.equal(root.headers.location, 'https://awesome-minimax-h3-cases.zzskysilent.com/')
    assert.equal(root.headers['cache-control'], 'no-store')
    assert.equal(root.body, '')
    const rootQuery = await call('/?added=release&q=city%20night', 'zzskysilent.com')
    assert.equal(rootQuery.status, 308)
    assert.equal(rootQuery.headers.location, 'https://awesome-minimax-h3-cases.zzskysilent.com/?added=release&q=city%20night')
    const rootHead = await call('/', 'zzskysilent.com', 'HEAD')
    assert.equal(rootHead.status, 308)
    assert.equal(rootHead.headers.location, root.headers.location)
    assert.equal(rootHead.body, '')
    assert.equal((await call('/', 'zzskysilent.com', 'POST')).status, 405)
    for (const path of ['/robots.txt', '/sitemap.xml', '/asset.txt', '/ads-config.json', '/advertising-runtime.mjs']) {
      const preserved = await call(path, 'zzskysilent.com')
      assert.equal(preserved.status, 200, path)
      assert.equal(preserved.headers.location, undefined, path)
    }
    assert.equal((await call('/missing/', 'zzskysilent.com')).status, 404)
    const api = await call('/api/catalog/summary', 'zzskysilent.com')
    assert.equal(api.status, 503)
    assert.equal(api.headers.location, undefined)
    assert.equal(JSON.parse(api.body).error, 'Catalog unavailable')
    const media = await call('/media/example.mp4', 'zzskysilent.com')
    assert.equal(media.status, 307)
    assert.equal(media.headers.location, 'https://media.example.test/play.mp4')
    for (const host of ['preview.example.test', 'localhost:4173', 'zzskysilent.com.evil.test']) {
      const unrelated = await call('/', host)
      assert.equal(unrelated.status, 200, host)
      assert.equal(unrelated.headers.location, undefined, host)
      assert.match(unrelated.body, /Catalog/)
    }
    const primary = await call('/')
    assert.equal(primary.status, 200)
    assert.equal(primary.headers.location, undefined)
    assert.match(primary.body, /Catalog/)
    assert.match(primary.body, /google-adsense-account/)
    assert.ok(!primary.body.includes('adsbygoogle.js'))
    assert.ok(!(await call('/', 'preview.example.test')).body.includes('google-adsense-account'))
    const runtime = await call('/advertising-runtime.mjs')
    assert.equal(runtime.status, 200)
    assert.match(runtime.headers['content-type'], /^text\/javascript/)
    advertisingEnv.ADSENSE_CLIENT_ID = 'invalid'
    assert.equal((await call('/ads.txt')).status, 404)
    assert.ok(!(await call('/')).body.includes('google-adsense-account'))
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
