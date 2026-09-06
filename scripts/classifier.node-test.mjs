import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
const execute = promisify(execFile)

test('classification checkpoints survive later failure, resume remaining rows, and share daily quota', async t => {
  const root = await mkdtemp(join(tmpdir(), 'h3-classifier-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const path of ['scripts', 'data', 'config', '.review']) await mkdir(join(root, path))
  for (const name of ['classify-candidates.mjs', 'candidate-taxonomy.mjs', 'taxonomy.mjs', 'review-paths.mjs', 'review-runtime.mjs']) await copyFile(new URL(name, import.meta.url), join(root, 'scripts', name))
  await copyFile(new URL('../data/taxonomy.json', import.meta.url), join(root, 'data/taxonomy.json'))
  await copyFile(new URL('../config/model-routing.json', import.meta.url), join(root, 'config/model-routing.json'))
  const candidates = Array.from({ length: 10 }, (_, i) => ({ id: `case-${i}`, text: `Public example ${i}`, reviewStatus: 'pending' }))
  await writeFile(join(root, '.review/candidates.json'), JSON.stringify(candidates))
  await writeFile(join(root, 'mock.mjs'), `
    import { appendFile } from 'node:fs/promises'
    globalThis.fetch = async (_url, options) => {
      const batch = JSON.parse(JSON.parse(options.body).messages[1].content)
      await appendFile('requests.jsonl', JSON.stringify(batch.map(x => x.id)) + '\\n')
      if (process.env.FAIL_SECOND && batch.some(x => x.id === 'case-5')) return new Response(null, { status: 503 })
      return new Response(JSON.stringify({ choices: [{ finish_reason: process.env.FIXTURE_MODE === 'truncated' && batch.length > 3 ? 'length' : 'stop', message: { content: JSON.stringify({ items: batch.map(x => ({ id: process.env.FIXTURE_MODE === 'wrong-id' ? 'unknown-id' : x.id, isH3Case: true, confidence: 0.9, mode: 'unknown', category: process.env.FIXTURE_MODE === 'taxonomy' ? 'invalid-fixture' : 'showcase', styles: [], scenes: [], inputTypes: ['unknown'], reason: 'fixture' })) }) } }] }))
    }
  `)
  const args = ['--import', join(root, 'mock.mjs'), join(root, 'scripts/classify-candidates.mjs')]
  const options = { cwd: root, env: { ...process.env, MIMO_API_KEY: 'fixture', FAIL_SECOND: '1' } }
  await assert.rejects(execute(process.execPath, args, options))
  const checkpoint = JSON.parse(await readFile(join(root, '.review/candidates.json')))
  assert.equal(checkpoint.filter(x => x.classification).length, 5)
  await writeFile(join(root, 'requests.jsonl'), '')
  await execute(process.execPath, args, { ...options, env: { ...options.env, FAIL_SECOND: '' } })
  const requests = (await readFile(join(root, 'requests.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  assert.deepEqual(requests, [candidates.slice(5).map(x => x.id)])
  assert.equal(JSON.parse(await readFile(join(root, '.review/candidates.json'))).filter(x => x.classification).length, 10)
  const runtime = JSON.parse(await readFile(join(root, '.review/runtime-v1.json')))
  const text = Object.values(runtime.quotas)[0].text
  assert.equal(text.attempts, 25)
  assert.equal(text.completed, 10)
  // A changed source invalidates only that candidate's saved classification.
  const current = JSON.parse(await readFile(join(root, '.review/candidates.json')))
  current[0].text = 'Changed public source text'
  await writeFile(join(root, '.review/candidates.json'), JSON.stringify(current))
  await writeFile(join(root, 'requests.jsonl'), '')
  await execute(process.execPath, args, { ...options, env: { ...options.env, FAIL_SECOND: '' } })
  assert.deepEqual((await readFile(join(root, 'requests.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse), [['case-0']])
  for (const mode of ['wrong-id', 'taxonomy', 'truncated']) {
    await writeFile(join(root, '.review/candidates.json'), JSON.stringify(candidates.slice(0, 5)))
    const attempt = execute(process.execPath, args, { ...options, env: { ...options.env, FAIL_SECOND: '', FIXTURE_MODE: mode } })
    if (mode === 'truncated') await attempt
    else await assert.rejects(attempt)
    const saved = JSON.parse(await readFile(join(root, '.review/candidates.json')))
    assert.equal(saved.filter(x => x.classification).length, mode === 'truncated' ? 5 : 0)
    if (mode === 'taxonomy') assert.equal(saved.filter(x => x.classificationError).length, 5)
  }

})
