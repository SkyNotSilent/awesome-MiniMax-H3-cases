import inventory from '../config/advertising.json' with { type: 'json' }
import { primaryOrigin } from './site-config.mjs'

export const advertisingRootHost = 'zzskysilent.com'
const primaryHost = new URL(primaryOrigin).host
const clientPattern = /^ca-pub-\d{16}$/
const slotPattern = /^\d{10}$/

export function advertisingConfig(env = process.env, host = '', approved = inventory) {
  const client = clientPattern.test(env.ADSENSE_CLIENT_ID ?? '') ? env.ADSENSE_CLIENT_ID : ''
  const catalogSlot = slotPattern.test(env.ADSENSE_CATALOG_SLOT ?? '') ? env.ADSENSE_CATALOG_SLOT : ''
  const tutorialSlot = slotPattern.test(env.ADSENSE_TUTORIAL_SLOT ?? '') ? env.ADSENSE_TUTORIAL_SLOT : ''
  const approvedPaths = [
    ...(approved.approvedCatalogPaths ?? []).filter(path => ['/', '/en/'].includes(path) || /^\/(?:en\/)?cases\/page\/(?:[2-9]|[1-9]\d+)\/$/.test(path)),
    ...(approved.approvedTutorialIds ?? []).filter(id => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)).flatMap(id => [`/tutorials/${id}/`, `/en/tutorials/${id}/`]),
  ]
  const enabled = host === primaryHost && Boolean(client) && env.ADSENSE_ENABLED === 'true' && env.ADSENSE_SITE_READY === 'true' && env.ADSENSE_CMP_PUBLISHED === 'true' && approvedPaths.length > 0
  return { origin: primaryOrigin, enabled, client, slots: { catalog: catalogSlot, tutorial: tutorialSlot }, approvedPaths }
}

export function adsTxt(env = process.env) {
  const { client } = advertisingConfig(env)
  return client ? `google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n` : null
}

export function advertisingVerification(html, env = process.env, host = '') {
  const { client } = advertisingConfig(env)
  if (!client || ![primaryHost, advertisingRootHost].includes(host)) return html
  return html.replace('</head>', `<meta name="google-adsense-account" content="${client}"></head>`)
}
