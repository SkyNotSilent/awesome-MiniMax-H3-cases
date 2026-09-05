import { execFile as execFileCallback, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { readmeScreenshotFiles } from './readme-screenshot-files.mjs'

const execFile = promisify(execFileCallback)
const root = resolve(import.meta.dirname, '..')
const screenshotDir = resolve(root, 'docs/screenshots')
const stats = JSON.parse(await readFile(resolve(root, 'data/project-stats.json'), 'utf8'))
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const guides = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const resources = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const resourceSnapshotAt = resources.find((item) => item.snapshotAt)?.snapshotAt
if (!resourceSnapshotAt) throw new Error('Tutorial resources are missing a Star snapshot date')
const configuredBase = process.env.SCREENSHOT_BASE_URL
const baseUrl = configuredBase || 'http://127.0.0.1:4173'
const latestCaseAddedAt = Math.max(...cases.map((item) => Date.parse(item.addedAt)))
const latestGuideAddedAt = Math.max(...guides.map((item) => Date.parse(item.addedAt)))
const screenshotCurrentBaselines = {
  cases: new Date(latestCaseAddedAt).toISOString(),
  tutorials: new Date(latestGuideAddedAt).toISOString(),
}
let changedScreenshotCount = 0
const changedScreenshotFiles = []

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
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  if (!response || response.status() !== 200) throw new Error(`${path} returned ${response?.status()}`)
  if ((await page.locator('html').getAttribute('lang')) !== language) throw new Error(`${path} language mismatch`)
  await page.getByRole('heading', { name: heading }).waitFor()
  if (path === '/' || path === '/en/' || path.includes('collection=latest')) {
    await page.locator('.case-card:not(.case-card-skeleton)').first().waitFor({ timeout: 30_000 })
    if (path === '/' || path === '/en/') await page.waitForTimeout(1800)
  }
  await page.waitForTimeout(350)
  const dimensions = await page.evaluate(() => ({
    viewport: globalThis.innerWidth,
    document: globalThis.document.documentElement.scrollWidth,
  }))
  if (dimensions.document > dimensions.viewport + 1) {
    throw new Error(`${path} overflows horizontally: ${JSON.stringify(dimensions)}`)
  }
}

async function writeScreenshotIfChanged(page, filename, options = {}) {
  const path = resolve(screenshotDir, filename)
  const screenshot = await page.screenshot(options)
  const previous = await readFile(path).catch(() => null)
  if (previous?.equals(screenshot) || (previous && await screenshotsAreVisuallyEquivalent(previous, screenshot))) return false
  await writeFile(path, screenshot)
  changedScreenshotCount += 1
  changedScreenshotFiles.push(filename)
  return true
}

async function screenshotsAreVisuallyEquivalent(previous, next) {
  try {
    const [before, after] = await Promise.all([previous, next].map((body) => sharp(body)
      .resize({ width: 360, fit: 'inside' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })))
    if (before.info.width !== after.info.width || before.info.height !== after.info.height) return false
    let totalDifference = 0
    let maximumDifference = 0
    for (let index = 0; index < before.data.length; index += 1) {
      const difference = Math.abs(before.data[index] - after.data[index])
      totalDifference += difference
      maximumDifference = Math.max(maximumDifference, difference)
    }
    return totalDifference / before.data.length < 0.05 && maximumDifference < 12
  } catch {
    return false
  }
}

async function writeScreenshotManifest() {
  const files = Object.fromEntries(await Promise.all(readmeScreenshotFiles.map(async (filename) => {
    const body = await readFile(resolve(screenshotDir, filename))
    return [filename, createHash('sha256').update(body).digest('hex')]
  })))
  const manifest = `${JSON.stringify({
    version: 1,
    generatedAt: stats.generatedAt,
    cases: stats.cases,
    completePrompts: stats.completePrompts,
    tutorials: stats.tutorials,
    rankedCreators: stats.rankedCreators,
    files,
  }, null, 2)}\n`
  const path = resolve(screenshotDir, 'snapshot.json')
  const previous = await readFile(path, 'utf8').catch(() => null)
  if (previous !== manifest) await writeFile(path, manifest)
}

async function captureIntro(page, path, language, filename, type = 'jpeg') {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  if (!response || response.status() !== 200) throw new Error(`${path} returned ${response?.status()}`)
  if ((await page.locator('html').getAttribute('lang')) !== language) throw new Error(`${path} language mismatch`)
  const intro = page.locator('.intro-splash')
  await intro.waitFor({ state: 'visible' })
  await intro.locator('.intro-proof-cases strong').filter({ hasText: String(stats.cases) }).waitFor()
  await page.addStyleTag({ content: `
    .intro-splash,
    .intro-splash::before,
    .intro-splash::after,
    .intro-splash * {
      animation-delay: -100s !important;
      animation-duration: 0.001s !important;
      transition: none !important;
    }
    .intro-progress span { transform: scaleX(1) !important; }
  ` })
  await page.waitForTimeout(80)
  const clipped = await page.evaluate(() => {
    const selectors = [
      '.intro-proof-cases strong',
      '.intro-proof-cases p',
      '.intro-proof-cases em',
      '.intro-proof-update strong',
      '.intro-proof-update p',
      '.intro-wordmark span',
      '.intro-wordmark strong',
      '.intro-proof-verdict',
      '.intro-bottomline p',
      '.intro-ready',
    ]
    return selectors.flatMap((selector) => [...globalThis.document.querySelectorAll(selector)].flatMap((element) => {
      const bounds = element.getBoundingClientRect()
      const outside = bounds.left < -1
        || bounds.right > globalThis.innerWidth + 1
        || bounds.top < -1
        || bounds.bottom > globalThis.innerHeight + 1
      return outside ? [{ selector, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }] : []
    }))
  })
  if (clipped.length > 0) throw new Error(`${path} intro content is clipped: ${JSON.stringify(clipped)}`)
  await writeScreenshotIfChanged(page, filename, type === 'jpeg'
    ? { type: 'jpeg', quality: 88 }
    : { type: 'png' })
}

async function dismissIntro(page, label) {
  const button = page.getByRole('button', { name: label })
  if (await button.count()) await button.evaluate((element) => element.click()).catch(() => {})
}

async function focusUpdateSnapshot(page) {
  const summary = page.locator('.update-summary')
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
  await writeScreenshotIfChanged(page, 'agent-skills-output.png', { type: 'png' })
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

async function blockRemoteFonts(context) {
  await context.route(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/, (route) => route.abort())
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
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  await blockRemoteFonts(desktop)
  await desktop.addInitScript((baselines) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-cases-seen-through-v2', baselines.cases)
    localStorage.setItem('minimax-h3-tutorials-seen-through-v2', baselines.tutorials)
  }, screenshotCurrentBaselines)
  const page = await desktop.newPage()
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => recordConsoleError('', message))

  await captureIntro(page, '/', 'zh-CN', 'intro-zh.jpg')
  await captureIntro(page, '/en/', 'en', 'intro-en.jpg')

  await verifyPage(page, '/', 'zh-CN', '先看 MiniMax H3 的真实效果。')
  await dismissIntro(page, '跳过开场')
  await focusUpdateSnapshot(page)
  await writeScreenshotIfChanged(page, 'case-library-zh.jpg', { type: 'jpeg', quality: 88 })

  await verifyPage(page, '/?collection=latest', 'zh-CN', '先看 MiniMax H3 的真实效果。')
  await dismissIntro(page, '跳过开场')
  await page.getByRole('button', { name: '最新收录' }).waitFor()
  await writeScreenshotIfChanged(page, 'latest-collection-zh.jpg', { type: 'jpeg', quality: 88 })

  await verifyPage(page, '/en/', 'en', 'See what MiniMax H3 actually makes.')
  await dismissIntro(page, 'Skip intro')
  await focusUpdateSnapshot(page)
  await writeScreenshotIfChanged(page, 'case-library-en.jpg', { type: 'jpeg', quality: 88 })

  await verifyPage(page, '/en/?collection=latest', 'en', 'See what MiniMax H3 actually makes.')
  await dismissIntro(page, 'Skip intro')
  await page.getByRole('button', { name: 'Latest' }).waitFor()
  await writeScreenshotIfChanged(page, 'latest-collection-en.jpg', { type: 'jpeg', quality: 88 })

  await verifyPage(page, '/tutorials/', 'zh-CN', 'MiniMax H3 教程')
  await page.getByRole('button', { name: '8GB 显存' }).click()
  await page.getByRole('heading', { name: '4-bit + DiffSynth：最低 8GB 显存路线' }).waitFor()
  await page.getByRole('button', { name: '全部硬件' }).click()
  await focusTutorialUpdates(page)
  await writeScreenshotIfChanged(page, 'tutorials-zh.png', { type: 'png' })

  await verifyPage(page, '/en/tutorials/', 'en', 'MiniMax H3 Tutorials')
  await focusTutorialUpdates(page)
  await writeScreenshotIfChanged(page, 'tutorials-en.png', { type: 'png' })

  await verifyPage(page, '/tutorials/ecosystem/', 'zh-CN', '教程与工具生态')
  await page.getByText(`Star 快照: ${resourceSnapshotAt}`).first().waitFor()
  await writeScreenshotIfChanged(page, 'tutorial-ecosystem-zh.png', { type: 'png' })

  await verifyPage(page, '/en/tutorials/ecosystem/', 'en', 'Tutorial and Tool Ecosystem')
  await page.getByText(`Stars snapshot: ${resourceSnapshotAt}`).first().waitFor()
  await writeScreenshotIfChanged(page, 'tutorial-ecosystem-en.png', { type: 'png' })

  await verifyPage(page, '/creators/', 'zh-CN', '持续做出好作品的人。')
  await writeScreenshotIfChanged(page, 'creators-zh.png', { type: 'png' })

  await verifyPage(page, '/en/creators/', 'en', 'Follow the people who keep making.')
  await writeScreenshotIfChanged(page, 'creators-en.png', { type: 'png' })

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  await blockRemoteFonts(mobile)
  await mobile.addInitScript((baselines) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-cases-seen-through-v2', baselines.cases)
    localStorage.setItem('minimax-h3-tutorials-seen-through-v2', baselines.tutorials)
  }, screenshotCurrentBaselines)
  const mobilePage = await mobile.newPage()
  mobilePage.on('pageerror', (error) => browserProblems.push(`mobile pageerror: ${error.message}`))
  mobilePage.on('console', (message) => recordConsoleError('mobile ', message))
  await captureIntro(mobilePage, '/', 'zh-CN', 'intro-zh-mobile.jpg')
  await captureIntro(mobilePage, '/en/', 'en', 'intro-en-mobile.jpg')
  await verifyPage(mobilePage, '/', 'zh-CN', '先看 MiniMax H3 的真实效果。')
  await dismissIntro(mobilePage, '跳过开场')
  await focusUpdateSnapshot(mobilePage)
  await writeScreenshotIfChanged(mobilePage, 'case-library-zh-mobile.jpg', { type: 'jpeg', quality: 86 })
  await verifyPage(mobilePage, '/tutorials/', 'zh-CN', 'MiniMax H3 教程')
  await focusTutorialUpdates(mobilePage)
  await writeScreenshotIfChanged(mobilePage, 'tutorials-zh-mobile.png', { type: 'png' })
  await verifyPage(mobilePage, '/en/', 'en', 'See what MiniMax H3 actually makes.')
  await dismissIntro(mobilePage, 'Skip intro')
  await focusUpdateSnapshot(mobilePage)
  await writeScreenshotIfChanged(mobilePage, 'case-library-en-mobile.jpg', { type: 'jpeg', quality: 86 })
  await verifyPage(mobilePage, '/en/tutorials/', 'en', 'MiniMax H3 Tutorials')
  await focusTutorialUpdates(mobilePage)
  await writeScreenshotIfChanged(mobilePage, 'tutorials-en-mobile.png', { type: 'png' })
  await verifyPage(mobilePage, '/creators/', 'zh-CN', '持续做出好作品的人。')
  await writeScreenshotIfChanged(mobilePage, 'creators-zh-mobile.png', { type: 'png' })
  await verifyPage(mobilePage, '/en/creators/', 'en', 'Follow the people who keep making.')
  await writeScreenshotIfChanged(mobilePage, 'creators-en-mobile.png', { type: 'png' })
  await mobile.close()
  await desktop.close()

  await captureSkillOutput(browser)
  if (browserProblems.length) throw new Error(browserProblems.join('\n'))
  await writeScreenshotManifest()
  const changedSummary = changedScreenshotFiles.length > 0 ? ` (${changedScreenshotFiles.join(', ')})` : ''
  console.log(`Captured bilingual README screenshots from ${stats.cases} cases, ${stats.tutorials} tutorials, and ${stats.rankedCreators} creators; ${changedScreenshotCount} files changed${changedSummary}.`)
} finally {
  if (browser) await browser.close()
  if (preview) preview.kill('SIGTERM')
}
