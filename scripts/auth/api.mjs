import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { createAccountStore } from './store.mjs'

const token = () => randomBytes(32).toString('base64url')
const hash = (value) => createHash('sha256').update(value).digest('hex')
const casePattern = /^[\w.-]{1,160}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const sessionAge = 30 * 24 * 60 * 60
const failure = (status, message) => Object.assign(new Error(message), { status })
function equal(a, b) {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  )
}
function cookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value),
  )
}
function names(origin) {
  return origin.startsWith('https:')
    ? { session: '__Host-h3-session', login: '__Host-h3-login' }
    : { session: 'h3-session', login: 'h3-login' }
}
function cookie(name, value, origin, age) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${origin.startsWith('https:') ? '; Secure' : ''}`
}
function headers(response) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}
function json(response, status, value) {
  headers(response)
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}
function redirect(response, target) {
  headers(response)
  response.writeHead(303, { Location: target })
  response.end()
}
function returnPath(value) {
  if (
    !value ||
    value.length > 4096 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) <= 32)
  )
    return '/'
  const url = new URL(value, 'https://site.invalid')
  if (url.origin !== 'https://site.invalid' || url.pathname.startsWith('/api/')) return '/'
  url.searchParams.delete('auth')
  return `${url.pathname}${url.search}${url.hash}`
}
async function body(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw failure(415, 'JSON required')
  if (Number(request.headers['content-length']) > 100000) {
    request.resume()
    throw failure(413, 'Body too large')
  }
  const chunks = []
  let bytes = 0
  const timeout = setTimeout(() => request.destroy(), 5000)
  try {
    for await (const chunk of request) {
      bytes += chunk.length
      if (bytes > 100000) throw failure(413, 'Body too large')
      chunks.push(chunk)
    }
    const value = JSON.parse(Buffer.concat(chunks).toString())
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure(400, 'Invalid body')
    return value
  } catch (error) {
    if (error.status) throw error
    throw failure(400, 'Invalid JSON')
  } finally {
    clearTimeout(timeout)
  }
}

export function createAccountApi({ env = process.env, store, provider } = {}) {
  const origins = (env.AUTH_ORIGINS ?? '')
    .split(',')
    .filter(Boolean)
    .map((value) => new URL(value.trim()).origin)
  if (
    origins.some(
      (value) => !value.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value),
    )
  )
    throw new Error('Auth origins must use HTTPS except localhost')
  const enabled = Boolean(
    env.AUTH_ENABLED === 'true' &&
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      (store || env.AUTH_DATABASE_URL) &&
      origins.length,
  )
  const accounts = enabled ? (store ?? createAccountStore(env.AUTH_DATABASE_URL)) : null
  const originFor = (request) => origins.find((origin) => new URL(origin).host === request.headers.host)
  const google = (origin) =>
    provider ??
    new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, `${origin}/api/auth/google/callback`)
  async function session(request, origin) {
    const value = cookies(request)[names(origin).session]
    return value && /^[\w-]{43}$/.test(value) ? accounts.session(hash(value), origin) : null
  }
  async function requireSession(request, origin, write = false) {
    const account = await session(request, origin)
    if (!account) throw failure(401, 'Login required')
    if (
      write &&
      (request.headers.origin !== origin || !equal(request.headers['x-csrf-token'], account.csrf_token))
    )
      throw failure(403, 'Invalid request origin or CSRF token')
    return account
  }
  return {
    close: () => accounts?.close(),
    async catalogContext(request, index) {
      if (!enabled) throw failure(503, 'Account service unavailable')
      const origin = originFor(request)
      if (!origin) throw failure(403, 'Invalid origin')
      const account = await requireSession(request, origin)
      const validIds = new Set(index.records.map((record) => record.item.id))
      return {
        userId: account.id,
        favorites: (await accounts.favorites(account.id)).filter((id) => validIds.has(id)),
      }
    },
    async handle(request, response, index) {
      const url = new URL(request.url, 'http://localhost')
      if (!url.pathname.startsWith('/api/auth/') && !url.pathname.startsWith('/api/me/')) return false
      try {
        if (url.pathname === '/api/auth/session' && request.method === 'GET' && !enabled) {
          json(response, 200, { enabled: false, user: null, csrfToken: null })
          return true
        }
        if (!enabled) throw failure(503, 'Account service unavailable')
        const origin = originFor(request)
        if (!origin) throw failure(403, 'Invalid origin')
        const validIds = new Set(index?.records.map((record) => record.item.id) ?? [])
        if (url.pathname === '/api/auth/google/start' && request.method === 'GET') {
          const state = token(),
            browser = token(),
            nonce = token()
          const client = google(origin)
          const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()
          await accounts.putLogin({
            stateHash: hash(state),
            browserHash: hash(browser),
            origin,
            verifier: codeVerifier,
            nonce,
            returnTo: returnPath(url.searchParams.get('returnTo')),
            expiresAt: new Date(Date.now() + 600000),
          })
          response.setHeader('Set-Cookie', cookie(names(origin).login, browser, origin, 600))
          redirect(
            response,
            client.generateAuthUrl({
              scope: ['openid', 'email', 'profile'],
              state,
              nonce,
              code_challenge: codeChallenge,
              code_challenge_method: 'S256',
              prompt: 'select_account',
            }),
          )
        } else if (url.pathname === '/api/auth/google/callback' && request.method === 'GET') {
          const state = url.searchParams.get('state'),
            browser = cookies(request)[names(origin).login]
          if (!state || !browser || !/^[\w-]{43}$/.test(state) || !/^[\w-]{43}$/.test(browser))
            throw failure(400, 'Invalid login transaction')
          const login = await accounts.consumeLogin(hash(state), hash(browser), origin)
          if (!login) throw failure(400, 'Login expired or already used')
          response.setHeader('Set-Cookie', cookie(names(origin).login, '', origin, 0))
          const result = new URL(login.return_to, origin)
          try {
            if (url.searchParams.has('error') || !url.searchParams.get('code'))
              throw failure(400, 'Login cancelled')
            const client = google(origin)
            const { tokens } = await client.getToken({
              code: url.searchParams.get('code'),
              codeVerifier: login.verifier,
              redirect_uri: `${origin}/api/auth/google/callback`,
            })
            const ticket = await client.verifyIdToken({
              idToken: tokens.id_token,
              audience: env.GOOGLE_CLIENT_ID,
            })
            const profile = ticket.getPayload()
            if (
              !profile ||
              !equal(profile.nonce, login.nonce) ||
              !profile.sub ||
              !profile.email ||
              !profile.email_verified
            )
              throw failure(400, 'Invalid Google identity')
            const value = token()
            const oldToken = cookies(request)[names(origin).session]
            await accounts.createSession(
              {
                sub: profile.sub,
                email: profile.email,
                name: (profile.name ?? profile.email).slice(0, 200),
                picture:
                  typeof profile.picture === 'string' &&
                  /^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(profile.picture)
                    ? profile.picture
                    : null,
              },
              {
                tokenHash: hash(value),
                origin,
                csrfToken: token(),
                expiresAt: new Date(Date.now() + sessionAge * 1000),
                oldTokenHash: oldToken ? hash(oldToken) : null,
              },
            )
            response.setHeader('Set-Cookie', [
              cookie(names(origin).login, '', origin, 0),
              cookie(names(origin).session, value, origin, sessionAge),
            ])
            result.searchParams.set('auth', 'success')
          } catch {
            result.searchParams.set('auth', 'failed')
          }
          redirect(response, `${result.pathname}${result.search}${result.hash}`)
        } else if (url.pathname === '/api/auth/session' && request.method === 'GET') {
          const account = await session(request, origin)
          json(response, 200, {
            enabled: true,
            user: account
              ? { id: account.id, name: account.name, email: account.email, picture: account.picture }
              : null,
            csrfToken: account?.csrf_token ?? null,
          })
        } else if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
          await requireSession(request, origin, true)
          await accounts.logout(hash(cookies(request)[names(origin).session]))
          response.setHeader('Set-Cookie', cookie(names(origin).session, '', origin, 0))
          json(response, 200, { ok: true })
        } else if (url.pathname === '/api/me/favorites' && request.method === 'GET') {
          const account = await requireSession(request, origin)
          json(response, 200, {
            userId: account.id,
            favorites: (await accounts.favorites(account.id)).filter((id) => validIds.has(id)),
          })
        } else if (url.pathname === '/api/me/favorites/import' && request.method === 'POST') {
          const account = await requireSession(request, origin, true)
          const value = await body(request)
          if (
            Object.keys(value).some((key) => !['importId', 'batchId', 'favorites', 'final'].includes(key)) ||
            !uuidPattern.test(value.importId) ||
            !Number.isInteger(value.batchId) ||
            value.batchId < 0 ||
            value.batchId > 20 ||
            typeof value.final !== 'boolean' ||
            !Array.isArray(value.favorites) ||
            value.favorites.length > 500 ||
            value.favorites.some((id) => typeof id !== 'string' || !casePattern.test(id))
          )
            throw failure(400, 'Invalid import')
          await accounts.importFavorites(
            account.id,
            origin,
            value.importId,
            value.batchId,
            [...new Set(value.favorites)].filter((id) => validIds.has(id)),
            value.final,
          )
          json(response, 200, { ok: true })
        } else if (
          /^\/api\/me\/favorites\/[^/]+$/.test(url.pathname) &&
          ['PUT', 'DELETE'].includes(request.method)
        ) {
          const account = await requireSession(request, origin, true)
          const id = decodeURIComponent(url.pathname.split('/').at(-1))
          if (!casePattern.test(id) || !validIds.has(id)) throw failure(400, 'Invalid case ID')
          await accounts.favorite(account.id, id, request.method === 'PUT')
          json(response, 200, { ok: true })
        } else throw failure(405, 'Method or endpoint not allowed')
      } catch (error) {
        json(response, error.status ?? 503, {
          error: error.status ? error.message : 'Account service unavailable',
        })
      }
      return true
    },
  }
}
