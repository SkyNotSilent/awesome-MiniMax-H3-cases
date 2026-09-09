import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { test } from 'node:test'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'h3-publication-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'scripts'))
  await mkdir(join(root, 'data'))
  await mkdir(join(root, '.review/publish-staging'), { recursive: true })
  for (const name of ['commit-staged-cases.mjs', 'staged-publish.mjs', 'review-paths.mjs', 'submission-feedback.mjs', 'submission-reply.mjs', 'submission-reply-text.mjs']) {
    await copyFile(new URL(name, import.meta.url), join(root, 'scripts', name))
  }
  const cases = ['a', 'b'].map(id => ({ id, sourceUrl: `https://example.com/${id}`, mediaUrl: `/media/${id}.mp4`, posterUrl: `/posters/x/${id}.jpg` }))
  await writeFile(join(root, 'data/cases.json'), '[]')
  await writeFile(join(root, '.review/candidates.json'), JSON.stringify(cases.map(item => item.id === 'a' ? { ...item, issueUrl: 'https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/16' } : item)))
  for (const item of cases) {
    await mkdir(join(root, '.review/publish-staging', item.id, 'posters'), { recursive: true })
    await writeFile(join(root, '.review/publish-staging', item.id, 'posters', `${item.id}.jpg`), 'fixture')
    await writeFile(join(root, '.review/publish-staging', `${item.id}.json`), JSON.stringify([item]))
  }
  await writeFile(join(root, 'mock-fetch.mjs'), `
    import { writeFile, access } from 'node:fs/promises'
    import { setTimeout } from 'node:timers/promises'
    let waited = false
    globalThis.fetch = async (url) => {
      if (!waited) {
        waited = true
        await writeFile(process.env.TEST_READY, '')
        for (let i = 0; i < 500; i++) {
          try { await access(process.env.TEST_RELEASE); break } catch { await setTimeout(10) }
        }
      }
      return String(url).includes('/media/')
        ? new Response(null, { status: 307, headers: { Location: 'https://example.invalid/video' } })
        : new Response('ab', { status: 206, headers: { 'Content-Range': 'bytes 0-1/2' } })
    }
  `)
  return root
}
function run(root, id) {
  let output = ''
  const child = spawn(process.execPath, ['--import', join(root, 'mock-fetch.mjs'), join(root, 'scripts/commit-staged-cases.mjs'), '--apply', '--staging', `.review/publish-staging/${id}.json`], {
    cwd: root, env: { ...process.env, TEST_READY: join(root, `${id}.ready`), TEST_RELEASE: join(root, `${id}.release`) },
  })
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  return new Promise(resolve => child.on('close', code => resolve({ code, output })))
}
async function waitFor(path) {
  for (let i = 0; i < 200; i++) {
    try { await access(path); return } catch { await setTimeout(10) }
  }
  throw new Error(`Fixture did not reach barrier: ${path}`)
}

test('two publication processes never succeed while losing a case', async t => {
  const root = await fixture(t)
  const a = run(root, 'a')
  await waitFor(join(root, 'a.ready'))
  const b = run(root, 'b')
  // Old implementation reaches media verification using the same stale snapshot.
  await Promise.race([b, waitFor(join(root, 'b.ready'))])
  await writeFile(join(root, 'a.release'), '')
  assert.equal((await a).code, 0)
  await writeFile(join(root, 'b.release'), '')
  const second = await b
  if (second.code !== 0) {
    assert.match(second.output, /already running|busy/)
    assert.equal((await run(root, 'b')).code, 0)
  }
  assert.deepEqual(JSON.parse(await readFile(join(root, 'data/cases.json'))).map(x => x.id).sort(), ['a', 'b'])
  assert.deepEqual(JSON.parse(await readFile(join(root, '.review/candidates.json'))), [])
  assert.equal(JSON.parse(await readFile(join(root, '.review/submission-feedback/case-a.json'))).status, 'awaiting-deployment')
})

test('reconciles publication after the public JSON was written but private cleanup was interrupted', async t => {
  const root = await fixture(t)
  await writeFile(join(root, 'a.release'), '')
  // Throw immediately after the atomic public rename, simulating an interrupted phase.
  await writeFile(join(root, 'interrupt.mjs'), `
    import fs from 'node:fs/promises'
    import { syncBuiltinESMExports } from 'node:module'
    const rename = fs.rename
    fs.rename = async (source, target) => {
      await rename(source, target)
      if (target.endsWith('/data/cases.json')) throw new Error('Fixture interruption after public write')
    }
    syncBuiltinESMExports()
  `)
  const child = spawn(process.execPath, ['--import', join(root, 'mock-fetch.mjs'), '--import', join(root, 'interrupt.mjs'), join(root, 'scripts/commit-staged-cases.mjs'), '--apply', '--staging', '.review/publish-staging/a.json'], {
    cwd: root, env: { ...process.env, TEST_READY: join(root, 'a.ready'), TEST_RELEASE: join(root, 'a.release') }, stdio: 'ignore',
  })
  assert.notEqual(await new Promise(resolve => child.on('close', resolve)), 0)
  assert.deepEqual(JSON.parse(await readFile(join(root, 'data/cases.json'))).map(x => x.id), ['a'])
  assert.equal((await run(root, 'a')).code, 0)
  assert.equal((await run(root, 'a')).code, 0)
  assert.deepEqual(JSON.parse(await readFile(join(root, 'data/cases.json'))).map(x => x.id), ['a'])
  assert.deepEqual(JSON.parse(await readFile(join(root, '.review/candidates.json'))).map(x => x.id), ['b'])
  const journal = JSON.parse(await readFile(join(root, '.review/publish-staging/journals/a.json')))
  assert.equal(journal.phase, 'complete')
  assert.equal(JSON.parse(await readFile(join(root, '.review/submission-feedback/case-a.json'))).status, 'awaiting-deployment')
  assert.match(journal.inputVersion, /^[a-f0-9]{64}$/)
  assert.ok(Number.isFinite(Date.parse(journal.recordedAt)))
})
