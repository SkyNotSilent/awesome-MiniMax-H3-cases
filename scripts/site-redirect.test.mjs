import { expect, test } from 'vitest'
import { legacyPageRedirect } from '../shared/site-redirect.mjs'

const host = 'h3-field-notes-production.up.railway.app'
test('moves legacy pages without changing locale, encoded filters or route', () => {
  expect(legacyPageRedirect({ host, path: '/en/cases/example/?q=a%20b&added=release', mode: 'temporary' })).toEqual({ status: 302, location: 'https://awesome-minimax-h3-cases.zzskysilent.com/en/cases/example/?q=a%20b&added=release' })
  expect(legacyPageRedirect({ host, path: '/en/creators/author/?q=test', mode: 'permanent', method: 'HEAD' })?.status).toBe(308)
})
test('leaves APIs, media, health assets, local requests and new host untouched', () => {
  for (const path of ['/api/catalog/summary', '/media/example.mp4', '/data/catalog.json', '/posters/x/image.webp', '/assets/app.js', '/robots.txt', '/sitemap.xml', '/build-mode.json']) expect(legacyPageRedirect({ host, path, mode: 'permanent' })).toBeNull()
  for (const other of ['localhost:4173', 'awesome-minimax-h3-cases.zzskysilent.com', `${host}.evil.org`]) expect(legacyPageRedirect({ host: other, path: '/', mode: 'permanent' })).toBeNull()
  expect(legacyPageRedirect({ host, path: '/', mode: 'off' })).toBeNull()
  for (const path of ['//evil.org/', '/\\evil.org/']) expect(legacyPageRedirect({ host, path, mode: 'permanent' })).toBeNull()
  expect(legacyPageRedirect({ host, path: '/', mode: 'permanent', method: 'POST' })).toBeNull()
})
