import { test, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const exec = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const fixtures = JSON.parse(await readFile(resolve(root, 'agents/skills/minimax-h3-tutorial-guide/fixtures/tutorial-guides.json'), 'utf8'))

async function withServer(payload, run) {
  const paths = []
  const server = createServer((req, res) => {
    paths.push(req.url)
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(typeof payload === 'function' ? payload(req.url) : payload))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try { await run(`http://127.0.0.1:${server.address().port}`, paths) }
  finally { await new Promise(resolve => server.close(resolve)) }
}

function query(skill, args, url) {
  return exec(process.execPath, [`agents/skills/${skill}/scripts/query.mjs`, ...args], {
    cwd: root, env: { ...process.env, H3_LIBRARY_URL: url },
  })
}

test('Prompt query preserves single, quoted and multiple words without fixture option', async () => {
  await withServer({ cases: [] }, async url => {
    for (const args of [['city'], ['city cinematic'], ['city', 'cinematic']]) {
      const result = JSON.parse((await query('minimax-h3-prompt-library', args, url)).stdout)
      expect(result.query).toBe(args.join(' '))
    }
  })
})

test('Prompt query rejects unknown options and missing fixture values', async () => {
  for (const args of [['city', '--bogus'], ['city', '--fixture']]) {
    await expect(query('minimax-h3-prompt-library', args, 'http://127.0.0.1:1')).rejects.toThrow(/Unknown option|Missing value/)
  }
})

test('Prompt lookup never treats a hasPrompt flag as evidence of complete verbatim text', async () => {
  const cases = ['full', 'fragment', 'adapted'].map(id => ({ id, title: 'city', hasPrompt: true, sourceUrl: 'https://example.com/source' }))
  await withServer(path => path === '/data/catalog.json' ? { cases } : {
    prompt: 'Exact public text', promptProvenance: path.includes('adapted') ? 'official-adapted' : 'creator-verbatim',
    promptCompleteness: path.includes('fragment') ? 'excerpt' : 'complete',
  }, async url => {
    const result = JSON.parse((await query('minimax-h3-prompt-library', ['city'], url)).stdout)
    expect(result.matches.map(item => item.publicPrompt)).toEqual(['Exact public text', null, null])
  })
})

test('Tutorial query uses the versioned endpoint and rejects obsolete payloads', async () => {
  await withServer({ schemaVersion: 2, contentVersion: 'a'.repeat(64), guides: fixtures }, async (url, paths) => {
    const result = JSON.parse((await query('minimax-h3-tutorial-guide', ['--goal', 'mac'], url)).stdout)
    expect(result.matches[0].id).toBe('skill-tutorial-sample')
    expect(paths).toEqual(['/data/tutorial-guides.v2.json'])
  })
  for (const payload of [fixtures, {}, { schemaVersion: 2, contentVersion: 'a'.repeat(64), guides: [{}] }]) {
    await withServer(payload, async url => {
      await expect(query('minimax-h3-tutorial-guide', ['--goal', 'mac'], url)).rejects.toThrow(/Invalid tutorial/)
    })
  }
})
