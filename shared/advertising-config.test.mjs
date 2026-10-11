import { describe, expect, it } from 'vitest'
import { adsTxt, advertisingConfig, advertisingVerification } from './advertising-config.mjs'

const host = 'awesome-minimax-h3-cases.zzskysilent.com'
const env = { ADSENSE_CLIENT_ID: 'ca-pub-1234567890123456', ADSENSE_CATALOG_SLOT: '1234567890', ADSENSE_TUTORIAL_SLOT: '0987654321', ADSENSE_ENABLED: 'true', ADSENSE_SITE_READY: 'true', ADSENSE_CMP_PUBLISHED: 'true' }
const inventory = { approvedCatalogPaths: ['/', '/en/', '/cases/page/2/'], approvedTutorialIds: ['official-deployment'] }

describe('advertising release gates', () => {
  it('requires approval, published consent, explicit inventory and the production host', () => {
    expect(advertisingConfig(env, host, inventory).enabled).toBe(true)
    for (const key of ['ADSENSE_ENABLED', 'ADSENSE_SITE_READY', 'ADSENSE_CMP_PUBLISHED', 'ADSENSE_CLIENT_ID']) {
      expect(advertisingConfig({ ...env, [key]: '' }, host, inventory).enabled).toBe(false)
    }
    for (const origin of ['localhost:5173', 'zzskysilent.com', 'h3-field-notes-production.up.railway.app', `${host}.evil.test`]) {
      expect(advertisingConfig(env, origin, inventory).enabled).toBe(false)
    }
    expect(advertisingConfig(env, host, { approvedCatalogPaths: [], approvedTutorialIds: [] }).enabled).toBe(false)
  })

  it('cannot whitelist case details, arbitrary routes or malformed identifiers', () => {
    const settings = advertisingConfig(env, host, { approvedCatalogPaths: ['/cases/example/', '/privacy.html', '/cases/page/1/', '/cases/page/10/'], approvedTutorialIds: ['good-guide', '../cases/example', 'bad<script>'] })
    expect(settings.approvedPaths).toEqual(['/cases/page/10/', '/tutorials/good-guide/', '/en/tutorials/good-guide/'])
    expect(advertisingConfig({ ...env, ADSENSE_CATALOG_SLOT: 'bad' }, host, inventory).slots.catalog).toBe('')
  })

  it('uses the real publisher in ads.txt and verification without loading an ad tag', () => {
    expect(adsTxt(env)).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n')
    expect(adsTxt({ ADSENSE_CLIENT_ID: 'ca-pub-invalid' })).toBeNull()
    for (const verifiedHost of [host, 'zzskysilent.com']) {
      const html = advertisingVerification('<head></head>', env, verifiedHost)
      expect(html).toContain('name="google-adsense-account"')
      expect(html).not.toContain('<script')
    }
    expect(advertisingVerification('<head></head>', env, 'localhost')).toBe('<head></head>')
    expect(advertisingVerification('<head></head>', { ADSENSE_CLIENT_ID: '"><script>' }, host)).toBe('<head></head>')
  })
})
