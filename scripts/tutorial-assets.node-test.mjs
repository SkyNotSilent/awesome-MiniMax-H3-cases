import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
test('built tutorial client uses a content-addressed asset instead of the legacy cached JSON', async () => {
  const names = await readdir(resolve(root, 'dist/assets'))
  const bundles = await Promise.all(names.filter(name => name.endsWith('.js')).map(name => readFile(resolve(root, 'dist/assets', name), 'utf8')))
  const asset = bundles.join('\n').match(/\/assets\/tutorial-guides-[\w-]+\.json/)?.[0]
  assert.ok(asset, 'Tutorial data needs a content-addressed URL across schema deployments')
  const [published, source] = await Promise.all([
    readFile(resolve(root, 'dist', asset.slice(1)), 'utf8'),
    readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'),
  ])
  assert.deepEqual(JSON.parse(published), JSON.parse(source))
})
