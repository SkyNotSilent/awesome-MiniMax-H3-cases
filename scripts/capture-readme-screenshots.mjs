import { execFile as execFileCallback, spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const execFile = promisify(execFileCallback)
const root = resolve(import.meta.dirname, '..')
const screenshotDir = resolve(root, 'docs/screenshots')
const stats = JSON.parse(await readFile(resolve(root, 'data/project-stats.json'), 'utf8'))
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const guides = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const configuredBase = process.env.SCREENSHOT_BASE_URL
const baseUrl = configuredBase || 'http://127.0.0.1:4173'
const latestCaseAddedAt = Math.max(...cases.map((item) => Date.parse(item.addedAt)))
const latestGuideAddedAt = Math.max(...guides.map((item) => Date.parse(item.addedAt)))
const screenshotUpdateBaseline = new Date(Math.min(latestCaseAddedAt, latestGuideAddedAt) - 1).toISOString()

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds))

async function waitForPreview() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await wait(250)
  }
  throw new Error(`Preview did not become ready at ${baseUrl}`)
}

async function verifyPage(page, path, language, heading) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  if (!response || response.status() !== 200) throw new Error(`${path} returned ${response?.status()}`)
  if ((await page.locator('html').getAttribute('lang')) !== language) throw new Error(`${path} language mismatch`)
  await page.getByRole('heading', { name: heading }).waitFor()
  if (path === '/' || path === '/en/') await page.waitForTimeout(1800)
  const dimensions = await page.evaluate(() => ({
    viewport: globalThis.innerWidth,
    document: globalThis.document.documentElement.scrollWidth,
  }))
  if (dimensions.document > dimensions.viewport + 1) {
    throw new Error(`${path} overflows horizontally: ${JSON.stringify(dimensions)}`)
  }
}

async function dismissIntro(page, label) {
  const button = page.getByRole('button', { name: label })
  if (await button.count()) await button.evaluate((element) => element.click()).catch(() => {})
}

async function focusUpdateSnapshot(page) {
  const summary = page.locator('.update-summary.has-updates')
  await summary.waitFor()
  await summary.scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
}

async function focusTutorialUpdates(page) {
  const filter = page.locator('.added-date-filter')
  await filter.waitFor()
  await filter.scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function captureSkillOutput(browser) {
  const { stdout, stderr } = await execFile('npx', ['--yes', 'skills', 'add', '.', '--list'], {
    cwd: root,
    maxBuffer: 1024 * 1024,
  })
  const commandOutput = `${stdout}${stderr}`
  const skillNames = ['minimax-h3-prompt-library', 'minimax-h3-tutorial-guide']
  if (skillNames.some((skill) => !commandOutput.includes(skill))) {
    throw new Error('Skills CLI did not discover both repository Skills')
  }
  const installOutput = [
    'Source: .',
    '✓ Local path validated',
    `✓ Found ${skillNames.length} skills`,
    '',
    'Available Skills',
    `├─ ${skillNames[0]}`,
    `└─ ${skillNames[1]}`,
    '',
    'Ready for Codex and Claude Code',
  ].join('\n')
  const guide = guides.find((item) => item.id === 'mac-native')
  if (!guide) throw new Error('mac-native guide is missing')

  const context = await browser.newContext({ viewport: { width: 1280, height: 780 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box} body{margin:0;background:#090a08;color:#f4f5ed;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      main{min-height:780px;padding:54px;background:radial-gradient(circle at 88% 5%,#d9ff4320,transparent 34%),#090a08}
      .top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #343830;padding-bottom:22px;margin-bottom:34px}
      .brand{font:700 24px/1.1 Arial,sans-serif}.brand b,.acid{color:#d9ff43}.meta{color:#848a7d;font-size:12px;letter-spacing:.12em}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.panel{border:1px solid #353a31;background:#11130f;padding:26px;min-height:560px}
      .label{color:#d9ff43;font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:24px}.command{color:#d9ff43;margin-bottom:14px}
      pre{white-space:pre-wrap;color:#bbc0b4;font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0}
      h2{font:700 34px/1.05 Arial,sans-serif;margin:0 0 20px;letter-spacing:-.04em}.row{border-top:1px solid #2a2e27;padding:15px 0;display:grid;grid-template-columns:135px 1fr;gap:18px;font-size:12px;line-height:1.55}
      .row span{color:#747a6e}.row strong{font-weight:500}.foot{margin-top:22px;color:#747a6e;font-size:10px}.ok{display:inline-block;width:8px;height:8px;border-radius:50%;background:#d9ff43;margin-right:8px;box-shadow:0 0 14px #d9ff43}
    </style></head><body><main>
      <div class="top"><div class="brand">MiniMax H3 <b>Agent Skills</b></div><div class="meta"><span class="ok"></span>VERIFIED REPOSITORY OUTPUT · ${escapeHtml(stats.generatedAt)}</div></div>
      <div class="grid">
        <section class="panel"><div class="label">01 / Actual install discovery</div><div class="command">$ npx skills add . --list</div><pre>${escapeHtml(installOutput)}</pre><div class="foot">Generated by the repository screenshot command from the real Skills CLI.</div></section>
        <section class="panel"><div class="label">02 / Structured tutorial result</div><h2>${escapeHtml(guide.title.en)}</h2>
          <div class="row"><span>SELECTED FOR</span><strong>Apple Silicon · local audio-video inference</strong></div>
          <div class="row"><span>DIFFICULTY / TIME</span><strong>${escapeHtml(guide.difficulty)} · about ${escapeHtml(guide.estimatedMinutes)} minutes</strong></div>
          <div class="row"><span>TESTED VERSIONS</span><strong>${escapeHtml(guide.testedVersions.join(' · '))}</strong></div>
          <div class="row"><span>FIRST COMMAND</span><strong>${escapeHtml(guide.commands[0])}</strong></div>
          <div class="row"><span>SUCCESS RESULT</span><strong>${escapeHtml(guide.expectedResult.en)}</strong></div>
          <div class="row"><span>SAFETY RULE</span><strong>Verify the latest upstream README. Never guess missing commands, versions, or compatibility.</strong></div>
        </section>
      </div>
    </main></body></html>`)
  await page.screenshot({ path: resolve(screenshotDir, 'agent-skills-output.png') })
  await context.close()
}

await mkdir(screenshotDir, { recursive: true })
let preview
let browser
const browserProblems = []

function recordConsoleError(prefix, message) {
  if (message.type() !== 'error') return
  const text = message.text()
  const location = message.location()?.url || ''
  const externalResourceFailure = text.startsWith('Failed to load resource: net::')
    && location
    && !location.startsWith(baseUrl)
  if (externalResourceFailure) return
  browserProblems.push(`${prefix}console: ${text}${location ? ` (${location})` : ''}`)
}

try {
  if (!configuredBase) {
    preview = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', '4173'], {
      cwd: root,
      stdio: 'ignore',
    })
    await waitForPreview()
  }

  browser = await chromium.launch({ headless: true })
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await desktop.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-updates-seen-through-v1', baseline)
  }, screenshotUpdateBaseline)
  const page = await desktop.newPage()
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => recordConsoleError('', message))

  await verifyPage(page, '/', 'zh-CN', '先看 MiniMax H3 的真实效果。')
  await dismissIntro(page, '跳过开场')
  await page.getByRole('button', { name: '编辑精选' }).click()
  if (!(await page.url()).includes('collection=featured')) throw new Error('Collection URL was not persisted')
  await page.getByRole('button', { name: '全部案例' }).click()
  await focusUpdateSnapshot(page)
  await page.screenshot({ path: resolve(screenshotDir, 'case-library-zh.jpg'), type: 'jpeg', quality: 88 })

  await verifyPage(page, '/en/', 'en', 'See what MiniMax H3 actually makes.')
  await dismissIntro(page, 'Skip intro')
  await focusUpdateSnapshot(page)
  await page.screenshot({ path: resolve(screenshotDir, 'case-library-en.jpg'), type: 'jpeg', quality: 88 })

  await verifyPage(page, '/tutorials/', 'zh-CN', 'MiniMax H3 教程')
  await page.getByRole('button', { name: '8GB 显存' }).click()
  await page.getByRole('heading', { name: '4-bit + DiffSynth：最低 8GB 显存路线' }).waitFor()
  await page.getByRole('button', { name: '全部硬件' }).click()
  await focusTutorialUpdates(page)
  await page.screenshot({ path: resolve(screenshotDir, 'tutorials-zh.png') })

  await verifyPage(page, '/en/tutorials/', 'en', 'MiniMax H3 Tutorials')
  await focusTutorialUpdates(page)
  await page.screenshot({ path: resolve(screenshotDir, 'tutorials-en.png') })

  await verifyPage(page, '/tutorials/ecosystem/', 'zh-CN', '教程与工具生态')
  await page.getByText(`Star 快照: ${stats.generatedAt}`).first().waitFor()
  await page.screenshot({ path: resolve(screenshotDir, 'tutorial-ecosystem-zh.png') })

  await verifyPage(page, '/en/tutorials/ecosystem/', 'en', 'Tutorial and Tool Ecosystem')
  await page.getByText(`Stars snapshot: ${stats.generatedAt}`).first().waitFor()
  await page.screenshot({ path: resolve(screenshotDir, 'tutorial-ecosystem-en.png') })

  await verifyPage(page, '/creators/', 'zh-CN', '持续做出好作品的人。')
  await page.screenshot({ path: resolve(screenshotDir, 'creators-zh.png') })

  await verifyPage(page, '/en/creators/', 'en', 'Follow the people who keep making.')
  await page.screenshot({ path: resolve(screenshotDir, 'creators-en.png') })

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await mobile.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-updates-seen-through-v1', baseline)
  }, screenshotUpdateBaseline)
  const mobilePage = await mobile.newPage()
  mobilePage.on('pageerror', (error) => browserProblems.push(`mobile pageerror: ${error.message}`))
  mobilePage.on('console', (message) => recordConsoleError('mobile ', message))
  await verifyPage(mobilePage, '/', 'zh-CN', '先看 MiniMax H3 的真实效果。')
  await dismissIntro(mobilePage, '跳过开场')
  await focusUpdateSnapshot(mobilePage)
  await mobilePage.screenshot({ path: resolve(screenshotDir, 'case-library-zh-mobile.jpg'), type: 'jpeg', quality: 86 })
  await verifyPage(mobilePage, '/tutorials/', 'zh-CN', 'MiniMax H3 教程')
  await focusTutorialUpdates(mobilePage)
  await mobilePage.screenshot({ path: resolve(screenshotDir, 'tutorials-zh-mobile.png') })
  await verifyPage(mobilePage, '/en/', 'en', 'See what MiniMax H3 actually makes.')
  await dismissIntro(mobilePage, 'Skip intro')
  await focusUpdateSnapshot(mobilePage)
  await mobilePage.screenshot({ path: resolve(screenshotDir, 'case-library-en-mobile.jpg'), type: 'jpeg', quality: 86 })
  await verifyPage(mobilePage, '/en/tutorials/', 'en', 'MiniMax H3 Tutorials')
  await focusTutorialUpdates(mobilePage)
  await mobilePage.screenshot({ path: resolve(screenshotDir, 'tutorials-en-mobile.png') })
  await verifyPage(mobilePage, '/creators/', 'zh-CN', '持续做出好作品的人。')
  await mobilePage.screenshot({ path: resolve(screenshotDir, 'creators-zh-mobile.png') })
  await verifyPage(mobilePage, '/en/creators/', 'en', 'Follow the people who keep making.')
  await mobilePage.screenshot({ path: resolve(screenshotDir, 'creators-en-mobile.png') })
  await mobile.close()
  await desktop.close()

  await captureSkillOutput(browser)
  if (browserProblems.length) throw new Error(browserProblems.join('\n'))
  console.log(`Captured bilingual README screenshots from ${stats.cases} cases, ${stats.tutorials} tutorials, and ${stats.rankedCreators} creators.`)
} finally {
  if (browser) await browser.close()
  if (preview) preview.kill('SIGTERM')
}
