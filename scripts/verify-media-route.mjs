import { pathToFileURL } from 'node:url'
import { verifyVideoRoute } from './staged-publish.mjs'
import { safeErrorMessage } from './redact-sensitive.mjs'

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

export async function verifyPublishedMedia({ site, caseId, fetchImpl = fetch }) {
  const result = await verifyVideoRoute({ siteBaseUrl: site, caseId, fetchImpl })
  return {
    caseId,
    ok: true,
    appStatus: result.appStatus,
    bucketStatus: result.bucketStatus,
    contentRange: Boolean(result.contentRange),
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const site = argumentValue('--site')
  const caseId = argumentValue('--case-id')
  if (!site?.startsWith('https://') || !/^[A-Za-z0-9_-]+$/.test(caseId || '')) {
    console.error('Use --site https://... --case-id SAFE_ID')
    process.exit(2)
  }
  try {
    console.log(JSON.stringify(await verifyPublishedMedia({ site, caseId })))
  } catch (error) {
    console.error(JSON.stringify({ caseId, ok: false, error: safeErrorMessage(error) }))
    process.exit(1)
  }
}
