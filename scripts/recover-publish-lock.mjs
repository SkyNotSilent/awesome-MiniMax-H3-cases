import { readJson, recoverPublishLock, publishStagingRoot } from './review-paths.mjs'
import { resolve } from 'node:path'
if (process.argv.includes('--apply')) {
  await recoverPublishLock()
  console.log('Dead local writer lock recovered. Rerun the interrupted command to reconcile its staging manifest.')
} else {
  console.log(await readJson(resolve(publishStagingRoot, '.commit.lock')))
  console.log('Inspect the owner before using --apply. Active or unknown owners cannot be recovered automatically.')
}
