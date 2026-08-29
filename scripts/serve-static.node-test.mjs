import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { createStaticServer } from './serve-static.mjs'

let baseUrl
let outsideDir
let rootDir
let server

function rawRequest(path, method = 'GET') {
  const address = server.address()
  return new Promise((resolveRequest, rejectRequest) => {
    const request = httpRequest({ host: '127.0.0.1', method, path, port: address.port }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolveRequest({
        body: Buffer.concat(chunks).toString('utf8'),
        headers: response.headers,
        status: response.statusCode,
      }))
    })
    request.on('error', rejectRequest)
    request.end()
  })
}

before(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'h3-static-root-'))
  outsideDir = await mkdtemp(join(tmpdir(), 'h3-static-outside-'))
  await mkdir(join(rootDir, 'faq'))
  await mkdir(join(rootDir, 'assets'))
  await mkdir(join(rootDir, 'data'))
  await writeFile(join(rootDir, 'index.html'), '<h1>Home</h1>')
  await writeFile(join(rootDir, '404.html'), '<h1>Custom missing</h1>')
  await writeFile(join(rootDir, 'faq', 'index.html'), '<h1>FAQ</h1>')
  await writeFile(join(rootDir, 'assets', 'index-BaL42Ee8.js'), 'console.log("asset")')
  await writeFile(join(rootDir, 'data', 'catalog.json'), '{"cases":[]}')
  await writeFile(join(outsideDir, 'secret.txt'), 'do not serve')
  await symlink(join(outsideDir, 'secret.txt'), join(rootDir, 'leak.txt'))

  server = await createStaticServer({ distDir: rootDir, logger: { error() {} } })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen)
      resolveListen()
    })
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolveClose) => server.close(resolveClose))
  if (rootDir) await rm(rootDir, { force: true, recursive: true })
  if (outsideDir) await rm(outsideDir, { force: true, recursive: true })
})

test('serves files and directory index pages with strict routing', async () => {
  const home = await fetch(`${baseUrl}/`)
  assert.equal(home.status, 200)
  assert.match(home.headers.get('content-type'), /^text\/html/)
  assert.equal(home.headers.get('cache-control'), 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  assert.equal(await home.text(), '<h1>Home</h1>')

  const redirect = await fetch(`${baseUrl}/faq?lang=en`, { redirect: 'manual' })
  assert.equal(redirect.status, 308)
  assert.equal(redirect.headers.get('location'), '/faq/?lang=en')

  const faq = await fetch(`${baseUrl}/faq/`)
  assert.equal(faq.status, 200)
  assert.equal(await faq.text(), '<h1>FAQ</h1>')

  const head = await fetch(`${baseUrl}/faq/`, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), String(Buffer.byteLength('<h1>FAQ</h1>')))
  assert.equal(await head.text(), '')
})

test('adds shared-cache headers to non-fingerprinted JSON', async () => {
  const catalog = await fetch(`${baseUrl}/data/catalog.json`)
  assert.equal(catalog.status, 200)
  assert.equal(catalog.headers.get('cache-control'), 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
})

test('adds immutable caching and honors conditional requests for fingerprinted assets', async () => {
  const asset = await fetch(`${baseUrl}/assets/index-BaL42Ee8.js`)
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('content-type'), /^text\/javascript/)
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  const etag = asset.headers.get('etag')
  assert.ok(etag)

  const cached = await fetch(`${baseUrl}/assets/index-BaL42Ee8.js`, {
    headers: { 'If-None-Match': etag },
  })
  assert.equal(cached.status, 304)
  assert.equal(await cached.text(), '')
})

test('returns an actual 404 response and rejects unsupported methods', async () => {
  const missing = await fetch(`${baseUrl}/missing-page`)
  assert.equal(missing.status, 404)
  assert.equal(missing.headers.get('cache-control'), 'no-store')
  assert.equal(await missing.text(), '<h1>Custom missing</h1>')

  const post = await fetch(`${baseUrl}/`, { method: 'POST' })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET, HEAD')
})

test('redirects hosted video requests through a short-lived signed URL', async () => {
  await new Promise((resolveClose) => server.close(resolveClose))
  const signedRequests = []
  server = await createStaticServer({
    distDir: rootDir,
    logger: { error() {} },
    videoStore: {
      async sign(key, method) {
        signedRequests.push({ key, method })
        return `https://storage.example/${key}.mp4?signature=test`
      },
    },
  })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen)
      resolveListen()
    })
  })

  baseUrl = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(`${baseUrl}/media/x-123.mp4`, { redirect: 'manual' })
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'https://storage.example/x-123.mp4?signature=test')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60, s-maxage=300, stale-while-revalidate=60')
  assert.deepEqual(signedRequests, [{ key: 'x-123', method: 'GET' }])
})

test('blocks traversal syntax and symlinks that escape the static root', async () => {
  for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt', '/%5c..%5csecret.txt']) {
    const response = await rawRequest(path)
    assert.equal(response.status, 400, path)
    assert.doesNotMatch(response.body, /do not serve/)
  }

  const symlinkEscape = await fetch(`${baseUrl}/leak.txt`)
  assert.equal(symlinkEscape.status, 403)
  assert.doesNotMatch(await symlinkEscape.text(), /do not serve/)
})

test('uses a built-in 404 page when dist/404.html is absent', async () => {
  await unlink(join(rootDir, '404.html'))
  const missing = await fetch(`${baseUrl}/still-missing`)
  assert.equal(missing.status, 404)
  assert.match(await missing.text(), /Page not found/)
})
