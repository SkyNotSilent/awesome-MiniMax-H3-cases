import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')

test('localized archives include viewing summaries and comparison advice', async () => {
  for (const [prefix, heading] of [['', '如何比较这些案例'], ['en/', 'How to compare these examples']]) {
    const html = await readFile(resolve(root, `dist/${prefix}cases/page/2/index.html`), 'utf8')
    assert.ok(html.includes(heading))
    assert.equal((html.match(/class="case-viewing-note"/g) ?? []).length, 48)
  }
})

test('tutorial fallbacks keep editorial guidance before attributed originals', async () => {
  for (const [prefix, heading, original] of [['', '本站导读', '原文:'], ['en/', 'Site guide', 'Original:']]) {
    const html = await readFile(resolve(root, `dist/${prefix}tutorials/official-deployment/index.html`), 'utf8')
    assert.ok(html.indexOf(heading) >= 0)
    assert.ok(html.indexOf(original) > html.indexOf(heading))
    assert.ok(html.includes(prefix ? 'Done when' : '完成标准'))
  }
})

test('rights links retain a private path for ownership evidence', async () => {
  for (const prefix of ['', 'en/']) {
    const html = await readFile(resolve(root, `dist/${prefix}contact/index.html`), 'utf8')
    assert.ok(html.includes('id="copyright"'))
    assert.ok(html.includes('/security/advisories/new'))
  }
})

test('FAQ fallbacks also distinguish editorial guidance from generation tests', async () => {
  for (const [prefix, heading] of [['', '收录代表本站做过生成实测吗？'], ['en/', 'Does inclusion mean the site tested generation?']]) {
    const html = await readFile(resolve(root, `dist/${prefix}faq/index.html`), 'utf8')
    assert.ok(html.includes(heading))
  }
})
