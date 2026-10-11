import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer, request as httpRequest } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { createAccountStore } from './auth/store.mjs'
import { createAccountApi } from './auth/api.mjs'
import { handleCatalogApi } from './catalog-api.mjs'
import { createCatalogIndex } from '../shared/catalog-query.mjs'

const databaseUrl = process.env.TEST_AUTH_DATABASE_URL

test(
  'Google transactions, account isolation, imports and expiration against PostgreSQL',
  { skip: !databaseUrl },
  async (t) => {
    const schema = `auth_test_${randomUUID().replaceAll('-', '')}`
    const admin = new pg.Client({ connectionString: databaseUrl })
    await admin.connect()
    await admin.query(`CREATE SCHEMA ${schema}`)
    const scoped = new URL(databaseUrl)
    scoped.searchParams.set('options', `-c search_path=${schema}`)
    const db = new pg.Client({ connectionString: scoped.href })
    await db.connect()
    await db.query(await readFile(new URL('./auth/schema.sql', import.meta.url), 'utf8'))
    const store = createAccountStore(scoped.href)
    let nonce,
      identity = 'google-a',
      badNonce = false
    const provider = {
      async generateCodeVerifierAsync() {
        return { codeVerifier: 'verifier', codeChallenge: 'challenge' }
      },
      generateAuthUrl(options) {
        nonce = options.nonce
        return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(options)}`
      },
      async getToken(options) {
        assert.equal(options.codeVerifier, 'verifier')
        return { tokens: { id_token: 'test-token' } }
      },
      async verifyIdToken() {
        return {
          getPayload: () => ({
            sub: identity,
            email: `${identity}@example.com`,
            email_verified: true,
            name: identity,
            nonce: badNonce ? 'bad' : nonce,
          }),
        }
      },
    }
    let api
    const index = createCatalogIndex({
      version: 1,
      catalogVersion: 'auth-fixture',
      taxonomy: { categories: [], styles: [], scenes: [] },
      featuredCaseIds: [],
      tutorials: [],
      creators: [],
      cases: [
        {
          id: 'case-one',
          addedAt: '2026-10-01T00:00:00Z',
          duration: 5,
          category: 'test',
          styles: [],
          scenes: [],
          tags: [],
          search: { zh: 'one', en: 'one' },
        },
        {
          id: 'case-two',
          addedAt: '2026-10-01T00:00:00Z',
          duration: 5,
          category: 'test',
          styles: [],
          scenes: [],
          tags: [],
          search: { zh: 'two', en: 'two' },
        },
      ],
    })
    const server = createServer(async (req, res) => {
      if ((await api.handle(req, res, index)) || (await handleCatalogApi(req, res, index, api))) return
      res.writeHead(404)
      res.end()
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    api = createAccountApi({
      env: {
        AUTH_ENABLED: 'true',
        AUTH_ORIGINS: `${base},https://legacy.example`,
        GOOGLE_CLIENT_ID: 'test-client',
        GOOGLE_CLIENT_SECRET: 'test-secret',
      },
      store,
      provider,
    })
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve))
      await api.close()
      await db.end()
      await admin.query(`DROP SCHEMA ${schema} CASCADE`)
      await admin.end()
    })
    const call = (path, cookie = '', options = {}) =>
      fetch(`${base}${path}`, { redirect: 'manual', ...options, headers: { cookie, ...options.headers } })
    async function signIn(sub, returnTo = '/en/?q=one#catalog') {
      identity = sub
      const start = await call(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`)
      assert.equal(start.status, 303)
      assert.match(start.headers.get('cache-control'), /no-store/)
      const transaction = start.headers.getSetCookie()[0].split(';')[0]
      const state = new URL(start.headers.get('location')).searchParams.get('state')
      const callback = `/api/auth/google/callback?code=ok&state=${state}`
      const result = await call(callback, transaction)
      assert.equal(result.status, 303)
      const cookie =
        result.headers
          .getSetCookie()
          .find((value) => value.startsWith('h3-session='))
          ?.split(';')[0] ?? ''
      if (cookie)
        assert.match(
          result.headers.getSetCookie().find((value) => value.startsWith('h3-session=')),
          /HttpOnly; SameSite=Lax; Max-Age=2592000/,
        )
      return { cookie, callback, transaction, result }
    }
    assert.equal((await call('/api/me/favorites')).status, 401)
    assert.equal((await call('/api/catalog?collection=favorites')).status, 401)
    assert.equal((await call('/api/catalog', '', { method: 'POST' })).status, 405)
    const hostCall = (path, cookie = '') => new Promise((resolve, reject) => {
    const req = httpRequest(`${base}${path}`, { headers: { Host: 'legacy.example', Cookie: cookie } }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.end()
  })
  const secureStart = await hostCall('/api/auth/google/start')
  assert.equal(secureStart.status, 303)
  assert.match(secureStart.headers['set-cookie'][0], /^__Host-h3-login=.*; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/)
  assert.ok(!secureStart.headers['set-cookie'][0].includes('Domain='))
  const a = await signIn('google-a')
  const copiedCookie = `__Host-h3-session=${a.cookie.split('=')[1]}`
  const otherOrigin = await hostCall('/api/auth/session', copiedCookie)
  assert.equal(JSON.parse(otherOrigin.text).user, null)
  assert.equal(a.result.headers.get('location'), '/en/?q=one&auth=success#catalog')
    assert.equal((await call(a.callback, a.transaction)).status, 400)
    const sessionA = await (await call('/api/auth/session', a.cookie)).json()
    const write = (cookie, csrf, method, body) => ({
      method,
      headers: { Origin: base, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    assert.equal(
      (await call('/api/me/favorites/case-one', a.cookie, write(a.cookie, 'wrong', 'PUT'))).status,
      403,
    )
    assert.equal(
      (
        await call('/api/me/favorites/case-one', a.cookie, {
          ...write(a.cookie, sessionA.csrfToken, 'PUT'),
          headers: { Origin: 'https://evil.example', 'X-CSRF-Token': sessionA.csrfToken },
        })
      ).status,
      403,
    )
    assert.equal(
      (await call('/api/me/favorites/not-published', a.cookie, write(a.cookie, sessionA.csrfToken, 'PUT')))
        .status,
      400,
    )
    assert.equal(
      (await call('/api/me/favorites/case-one', a.cookie, write(a.cookie, sessionA.csrfToken, 'PUT'))).status,
      200,
    )
    assert.equal(
      (await call('/api/me/favorites/case-one', a.cookie, write(a.cookie, sessionA.csrfToken, 'PUT'))).status,
      200,
    )
    assert.deepEqual((await (await call('/api/me/favorites', a.cookie)).json()).favorites, ['case-one'])
    const a2 = await signIn('google-a')
    assert.deepEqual((await (await call('/api/me/favorites', a2.cookie)).json()).favorites, ['case-one'])
    const b = await signIn('google-b')
    const sessionB = await (await call('/api/auth/session', b.cookie)).json()
    assert.notEqual(sessionA.user.id, sessionB.user.id)
    assert.deepEqual((await (await call('/api/me/favorites', b.cookie)).json()).favorites, [])
    const importId = randomUUID()
    const batch = { importId, batchId: 0, favorites: ['case-one', 'case-two', 'missing'], final: true }
    assert.equal(
      (await call('/api/me/favorites/import', a.cookie, write(a.cookie, sessionA.csrfToken, 'POST', batch)))
        .status,
      200,
    )
    await call('/api/me/favorites/case-two', a.cookie, write(a.cookie, sessionA.csrfToken, 'DELETE'))
    assert.equal(
      (await call('/api/me/favorites/import', a.cookie, write(a.cookie, sessionA.csrfToken, 'POST', batch)))
        .status,
      200,
    )
    assert.deepEqual((await (await call('/api/me/favorites', a.cookie)).json()).favorites, ['case-one'])
    assert.equal(
      (await call('/api/me/favorites/import', b.cookie, write(b.cookie, sessionB.csrfToken, 'POST', batch)))
        .status,
      409,
    )
    const personal = await call('/api/catalog?collection=favorites&added=all', a.cookie)
    assert.equal(personal.status, 200)
    assert.equal((await personal.json()).total, 1)
    assert.equal(
      (await call('/api/auth/logout', b.cookie, write(b.cookie, sessionB.csrfToken, 'POST'))).status,
      200,
    )
    assert.equal((await call('/api/me/favorites', b.cookie)).status, 401)
    badNonce = true
    const rejected = await signIn('google-c', '//evil.example')
    assert.equal(rejected.cookie, '')
    assert.equal(rejected.result.headers.get('location'), '/?auth=failed')
    await db.query("UPDATE auth_sessions SET expires_at=now() - interval '1 second'")
    assert.equal((await call('/api/me/favorites', a.cookie)).status, 401)
    await db.query('DROP TABLE auth_sessions')
    assert.equal((await call('/api/auth/session', a.cookie)).status, 503)
    assert.equal((await call('/api/catalog?added=all')).status, 200)
  },
)

test('unconfigured auth exposes availability and never permits anonymous favorites', async (t) => {
  const api = createAccountApi({ env: {} })
  const server = createServer(async (req, res) => {
    await api.handle(req, res, null)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  assert.deepEqual(await (await fetch(`${base}/api/auth/session`)).json(), {
    enabled: false,
    user: null,
    csrfToken: null,
  })
  assert.equal((await fetch(`${base}/api/me/favorites`)).status, 503)
})
