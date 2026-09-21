import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { redactSensitiveText } from './redact-sensitive.mjs'
import { verifyVideoRoute } from './staged-publish.mjs'

test('redacts URLs and credential-shaped assignments without echoing values', () => {
  const secret = ['super', 'secret', 'value'].join('-')
  const text = redactSensitiveText(`failed https://bucket.example/video.mp4?token=${secret} VIDEO_S3_SECRET_ACCESS_KEY=${secret}`)
  assert.equal(text.includes(secret), false)
  assert.equal(text.includes('bucket.example'), false)
  assert.match(text, /\[redacted-url\]/)
})

test('media verifier never includes the signed redirect in thrown errors', async () => {
  const secret = ['temporary', 'signature', 'value'].join('-')
  const signatureParameter = ['X-Amz', 'Signature'].join('-')
  const signed = `https://bucket.example/video.mp4?${signatureParameter}=${secret}`
  const fetchImpl = async (_url, options) => {
    if (options.redirect === 'manual' && options.headers.Range === 'bytes=0-1' && _url.toString().includes('/media/')) {
      return new Response(null, { status: 307, headers: { Location: signed } })
    }
    throw new Error(`network failed for ${signed}`)
  }
  await assert.rejects(
    verifyVideoRoute({ siteBaseUrl: 'https://example.com', caseId: 'case-1', fetchImpl, attempts: 1 }),
    error => !error.message.includes(secret) && !error.message.includes('bucket.example'),
  )
})

test('history scanner reports metadata without echoing a leaked value', () => {
  const directory = mkdtempSync(join(tmpdir(), 'h3-history-scan-'))
  execFileSync('git', ['init', '-q'], { cwd: directory })
  execFileSync('git', ['config', 'user.email', 'security-test@example.com'], { cwd: directory })
  execFileSync('git', ['config', 'user.name', 'Security Test'], { cwd: directory })
  const secret = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('')
  writeFileSync(join(directory, 'leak.txt'), `${secret}\n`)
  execFileSync('git', ['add', 'leak.txt'], { cwd: directory })
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: directory })
  const result = spawnSync(process.execPath, [join(process.cwd(), 'scripts/privacy-history-scan.mjs'), '--repo', directory], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /credential or session artifact/)
  assert.equal(result.stderr.includes(secret), false)
})
