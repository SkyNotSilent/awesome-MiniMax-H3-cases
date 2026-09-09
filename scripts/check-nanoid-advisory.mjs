import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findAffectedNanoidEntries, NANOID_ADVISORY, SAFE_VERSIONS_NOTE } from './nanoid-advisory.mjs'

const root = resolve(import.meta.dirname, '..')
const lockfile = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'))
const affected = findAffectedNanoidEntries(lockfile)

if (affected.length) {
  const errors = affected.map(({ path, version }) =>
    `${path}: nanoid@${version} is affected by ${NANOID_ADVISORY.cve} (${NANOID_ADVISORY.id}) - ${NANOID_ADVISORY.url}. Upgrade to a safe version: ${SAFE_VERSIONS_NOTE}.`
  )
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`No affected nanoid versions found in package-lock.json (checked against ${NANOID_ADVISORY.id}).`)
