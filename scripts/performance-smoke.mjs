/* global document, getComputedStyle, innerWidth, window */
import { chromium, devices } from 'playwright'

const baseUrl = (process.env.PERF_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const currentBaseline = '9999-12-31T23:59:59.999Z'

async function ready(page, path = '/') {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 60_000 })
  const skip = page.getByRole('button', { name: /跳过开场|Skip intro/i })
  if (await skip.count()) await skip.click()
  await page.locator('.case-card:not(.case-card-skeleton)').first().waitFor()
}

async function checkDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-updates-seen-through-v1', baseline)
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.__h3PerfClickAt = null
    const recordInteraction = (event) => {
      if (event.target.closest?.('.case-card .media') && window.__h3PerfClickAt === null) window.__h3PerfClickAt = performance.now()
    }
    document.addEventListener('pointerdown', recordInteraction, true)
    document.addEventListener('click', recordInteraction, true)
  }, currentBaseline)
  const page = await context.newPage()
  const mediaRequests = []
  page.on('request', (request) => {
    if (request.url().includes('/media/')) mediaRequests.push({ url: request.url(), at: Date.now(), method: request.method(), type: request.resourceType() })
  })
  await page.route('**/data/cases/*.json', async (route) => {
    await new Promise((resolveWait) => setTimeout(resolveWait, 3_000))
    await route.continue()
  })
  await ready(page)

  const initialCards = await page.locator('.case-card:not(.case-card-skeleton)').count()
  const domNodes = await page.locator('*').count()
  if (initialCards !== 36) throw new Error(`Expected 36 initial cards, received ${initialCards}`)
  if (domNodes > 2_000) throw new Error(`Initial DOM budget exceeded: ${domNodes}`)
  if (mediaRequests.length !== 0) throw new Error(`Media requested before click: ${mediaRequests[0]?.url}`)

  for (const position of [10, 30, 36]) {
    const opacity = await page.locator('.case-card').nth(position - 1).evaluate((element) => getComputedStyle(element).opacity)
    if (opacity !== '1') throw new Error(`Card ${position} is transparent (${opacity})`)
  }

  const mediaRequest = page.waitForRequest((request) => request.url().includes('/media/'), { timeout: 2_000 })
  const playerRequest = page.waitForRequest((request) => request.url().includes('/media/') && request.resourceType() === 'media', { timeout: 2_000 })
  await page.locator('.case-card .media').first().click()
  await mediaRequest
  await playerRequest
  const clickEpoch = await page.evaluate(() => performance.timeOrigin + window.__h3PerfClickAt)
  const mediaDelay = mediaRequests[0].at - clickEpoch
  const videoDelay = mediaRequests.find((request) => request.type === 'media').at - clickEpoch
  // Gate on the <video> element's own request. The app hands the browser a
  // src within ~10ms of the press; the remainder is Chrome's one-time media
  // pipeline start-up (~150ms cold, ~30ms warm), so allow 250ms here.
  if (videoDelay > 250) throw new Error(`Player request started after ${videoDelay.toFixed(1)}ms`)
  await page.locator('.detail-skeleton').waitFor()
  // Every media request must come from the <video> element itself. A fetch()
  // or XHR for the same file is a duplicate download (a no-cors fetch drops
  // the Range header and pulls the whole file).
  const nonPlayerMedia = mediaRequests.filter((request) => request.type !== 'media')
  if (nonPlayerMedia.length) throw new Error(`Non-player media request detected: ${nonPlayerMedia[0].type} ${nonPlayerMedia[0].url}`)
  await page.keyboard.press('Escape')
  const lingeringPlayers = await page.locator('video[src*="/media/"]').count()
  if (lingeringPlayers) throw new Error(`Player still attached after closing the dialog: ${lingeringPlayers}`)

  const search = page.getByPlaceholder('搜索案例、场景或创作者…')
  const searchIndexResponse = page.waitForResponse((response) => response.url().endsWith('/data/search-index.zh.json'))
  await search.focus()
  await searchIndexResponse
  const searchStarted = performance.now()
  await search.fill('时间冻结')
  await page.getByText('餐厅时间冻结与逆向复原').waitFor()
  const searchDelay = performance.now() - searchStarted
  if (searchDelay > 100) throw new Error(`Search response took ${searchDelay.toFixed(1)}ms`)
  await search.fill('')

  const loadButton = page.getByRole('button', { name: /加载更多案例/ })
  for (let count = 60; count <= 132; count += 24) {
    await loadButton.click()
    const actual = await page.locator('.case-card').count()
    if (actual !== count) throw new Error(`Expected ${count} cards after button load, received ${actual}`)
  }
  const card120Opacity = await page.locator('.case-card').nth(119).evaluate((element) => getComputedStyle(element).opacity)
  if (card120Opacity !== '1') throw new Error(`Card 120 is transparent (${card120Opacity})`)
  await loadButton.focus()
  if (!(await loadButton.evaluate((element) => element === document.activeElement))) throw new Error('Load-more button cannot receive keyboard focus.')
  if (!(await page.locator('.catalog-count[aria-live="polite"]').count())) throw new Error('Result count is missing aria-live.')
  console.log(JSON.stringify({ desktop: { initialCards, domNodes, mediaDelay, videoDelay, searchDelay } }))
  await context.close()
}

async function checkAutomaticLoading(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-updates-seen-through-v1', baseline)
  }, currentBaseline)
  const page = await context.newPage()
  await ready(page)
  await page.locator('.catalog-pagination').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => document.querySelectorAll('.case-card').length >= 60)
  const count = await page.locator('.case-card').count()
  if (count !== 60) throw new Error(`Automatic loading should add exactly 24 cards, received ${count}`)
  console.log(JSON.stringify({ automaticLoading: { count } }))
  await context.close()
}

async function checkCombinedLoading(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-updates-seen-through-v1', baseline)
  }, currentBaseline)
  const page = await context.newPage()
  await ready(page)
  await page.getByRole('button', { name: /加载更多案例/ }).click()
  await page.waitForTimeout(2_000)
  const count = await page.locator('.case-card').count()
  if (count !== 60) throw new Error(`Combined observer/button loading should add exactly 24 cards, received ${count}`)
  console.log(JSON.stringify({ combinedLoading: { count } }))
  await context.close()
}

async function checkMobile(browser) {
  const context = await browser.newContext({ ...devices['iPhone 13'] })
  await context.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-updates-seen-through-v1', baseline)
  }, currentBaseline)
  const page = await context.newPage()
  await ready(page)
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  if (dimensions.document > dimensions.viewport + 1) throw new Error(`Mobile horizontal overflow: ${JSON.stringify(dimensions)}`)
  if (await page.locator('.case-card').count() !== 36) throw new Error('Mobile initial card count is not 36.')
  console.log(JSON.stringify({ mobile: dimensions }))
  await context.close()
}

const browser = await chromium.launch({ headless: true })
try {
  await checkDesktop(browser)
  await checkAutomaticLoading(browser)
  await checkCombinedLoading(browser)
  await checkMobile(browser)
} finally {
  await browser.close()
}
