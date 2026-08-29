/* global document, getComputedStyle, innerWidth, MutationObserver, window */
import { chromium, devices } from 'playwright'

const baseUrl = (process.env.PERF_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const currentBaseline = '9999-12-31T23:59:59.999Z'

async function dismissIntro(page) {
  const skip = page.getByRole('button', { name: /跳过开场|Skip intro/i })
  if (await skip.count()) await skip.evaluate((element) => element.click()).catch(() => {})
  await page.locator('.intro-splash').waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {})
}

async function ready(page, path = '/') {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await dismissIntro(page)
  await page.locator('.case-card:not(.case-card-skeleton)').first().waitFor()
}

async function checkDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-cases-seen-through-v2', baseline)
    localStorage.setItem('minimax-h3-tutorials-seen-through-v2', baseline)
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
  await page.evaluate(() => {
    window.__h3PerfVideoSrcAt = null
    const observer = new MutationObserver(() => {
      if (!document.querySelector('video[src*="/media/"]')) return
      window.__h3PerfVideoSrcAt = performance.now()
      observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
  })
  await page.locator('.case-card .media').first().click()
  await page.locator('video[src*="/media/"]').waitFor({ state: 'attached' })
  await mediaRequest
  await playerRequest
  const clickEpoch = await page.evaluate(() => performance.timeOrigin + window.__h3PerfClickAt)
  const playerAttachedEpoch = await page.evaluate(() => performance.timeOrigin + window.__h3PerfVideoSrcAt)
  const playerAttachDelay = playerAttachedEpoch - clickEpoch
  const mediaDelay = mediaRequests[0].at - clickEpoch
  const videoDelay = mediaRequests.find((request) => request.type === 'media').at - clickEpoch
  if (playerAttachDelay > 50) throw new Error(`Player source attached after ${playerAttachDelay.toFixed(1)}ms`)
  // Chromium's first media pipeline can add a cold-start delay after the app
  // has already attached src. Keep that browser-owned timing separate from
  // the strict 50ms application handoff budget.
  if (videoDelay > 350) throw new Error(`Browser media request started after ${videoDelay.toFixed(1)}ms`)
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
  await page.evaluate(() => {
    window.__h3SearchStartedAt = null
    window.__h3SearchRenderedAt = null
    const input = document.querySelector('.search-box input')
    input.addEventListener('input', () => {
      window.__h3SearchStartedAt = performance.now()
      const checkResult = () => {
        const rendered = [...document.querySelectorAll('.case-card')]
          .some((element) => element.textContent.includes('餐厅时间冻结与逆向复原'))
        if (!rendered) return false
        window.__h3SearchRenderedAt = performance.now()
        return true
      }
      const observer = new MutationObserver(() => {
        if (checkResult()) observer.disconnect()
      })
      observer.observe(document.querySelector('.case-grid'), { childList: true, subtree: true })
      if (checkResult()) observer.disconnect()
    }, { once: true })
  })
  await search.fill('时间冻结')
  await page.getByText('餐厅时间冻结与逆向复原').waitFor()
  await page.waitForFunction(() => window.__h3SearchRenderedAt !== null, null, { polling: 'raf' })
  const searchDelay = await page.evaluate(() => window.__h3SearchRenderedAt - window.__h3SearchStartedAt)
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
  console.log(JSON.stringify({ desktop: { initialCards, domNodes, playerAttachDelay, mediaDelay, videoDelay, searchDelay } }))
  await context.close()
}

async function checkAutomaticLoading(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript((baseline) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    localStorage.setItem('minimax-h3-cases-seen-through-v2', baseline)
    localStorage.setItem('minimax-h3-tutorials-seen-through-v2', baseline)
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
    localStorage.setItem('minimax-h3-cases-seen-through-v2', baseline)
    localStorage.setItem('minimax-h3-tutorials-seen-through-v2', baseline)
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
    localStorage.setItem('minimax-h3-cases-seen-through-v2', baseline)
    localStorage.setItem('minimax-h3-tutorials-seen-through-v2', baseline)
  }, currentBaseline)
  const page = await context.newPage()
  await ready(page)
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  if (dimensions.document > dimensions.viewport + 1) throw new Error(`Mobile horizontal overflow: ${JSON.stringify(dimensions)}`)
  if (await page.locator('.case-card').count() !== 36) throw new Error('Mobile initial card count is not 36.')
  console.log(JSON.stringify({ mobile: dimensions }))
  await context.close()
}

async function checkUpdateLifecycle(browser) {
  const response = await fetch(`${baseUrl}/data/catalog.json`)
  if (!response.ok) throw new Error(`Could not load the catalog for update lifecycle checks (${response.status})`)
  const catalog = await response.json()
  const latestCaseAt = catalog.cases.reduce(
    (latest, item) => Date.parse(item.addedAt) > Date.parse(latest) ? item.addedAt : latest,
    catalog.cases[0].addedAt,
  )
  const latestCaseDay = latestCaseAt.slice(0, 10)
  const priorCaseAt = catalog.cases
    .filter((item) => item.addedAt.slice(0, 10) < latestCaseDay)
    .reduce(
      (latest, item) => Date.parse(item.addedAt) > Date.parse(latest) ? item.addedAt : latest,
      '1970-01-01T00:00:00.000Z',
    )
  const latestTutorialAt = catalog.tutorials.reduce(
    (latest, item) => Date.parse(item.addedAt) > Date.parse(latest) ? item.addedAt : latest,
    catalog.tutorials[0].addedAt,
  )
  const expectedCount = catalog.cases.filter((item) => (
    Date.parse(item.addedAt) > Date.parse(priorCaseAt)
    && Date.parse(item.addedAt) <= Date.parse(latestCaseAt)
  )).length
  if (!expectedCount) throw new Error('Update lifecycle fixture did not produce any unseen cases.')

  // Keep the first case row below the fold so this scenario can prove that
  // viewing the update summary alone does not acknowledge the batch.
  const context = await browser.newContext({ viewport: { width: 1440, height: 600 } })
  await context.addInitScript(({ caseBaseline, tutorialBaseline }) => {
    localStorage.setItem('minimax-h3-language', 'zh')
    if (!localStorage.getItem('minimax-h3-cases-seen-through-v2')) {
      localStorage.setItem('minimax-h3-cases-seen-through-v2', caseBaseline)
    }
    if (!localStorage.getItem('minimax-h3-tutorials-seen-through-v2')) {
      localStorage.setItem('minimax-h3-tutorials-seen-through-v2', tutorialBaseline)
    }
  }, { caseBaseline: priorCaseAt, tutorialBaseline: latestTutorialAt })

  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await dismissIntro(page)
  await page.locator('.case-card:not(.case-card-skeleton)').first().waitFor()
  const activeAddedFilter = page.locator('.added-date-filter button[aria-pressed="true"]')
  await activeAddedFilter.filter({ hasText: '本次新增' }).waitFor()
  const initialCount = Number(await page.locator('.catalog-count span').textContent())
  if (initialCount !== expectedCount) {
    throw new Error(`Expected ${expectedCount} frozen unseen cases, received ${initialCount}`)
  }
  if (await page.evaluate(() => localStorage.getItem('minimax-h3-cases-seen-through-v2')) !== priorCaseAt) {
    throw new Error('Case baseline advanced before an unseen card entered the viewport.')
  }

  await page.locator('.update-visibility-sentinel').scrollIntoViewIfNeeded()
  await page.waitForFunction((latest) => (
    localStorage.getItem('minimax-h3-cases-seen-through-v2') === latest
  ), latestCaseAt)
  await page.locator('.update-read-status').filter({ hasText: '下次访问' }).waitFor()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await dismissIntro(page)
  await page.locator('.case-card:not(.case-card-skeleton)').first().waitFor()
  await activeAddedFilter.filter({ hasText: '本次新增' }).waitFor()
  const refreshedCount = Number(await page.locator('.catalog-count span').textContent())
  if (refreshedCount !== expectedCount) {
    throw new Error(`Same-tab refresh lost the frozen update window (${refreshedCount}/${expectedCount}).`)
  }

  await page.close()
  const nextVisit = await context.newPage()
  await nextVisit.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await dismissIntro(nextVisit)
  await nextVisit.locator('.case-card:not(.case-card-skeleton)').first().waitFor()
  await nextVisit.locator('.added-date-filter button[aria-pressed="true"]').filter({ hasText: '全部' }).waitFor()
  const unseenButton = nextVisit.locator('.added-date-filter button').filter({ hasText: '本次新增' })
  if (!(await unseenButton.isDisabled())) throw new Error('A new visit should disable an empty unseen filter.')
  if (await nextVisit.locator('.case-card:not(.case-card-skeleton)').count() !== 36) {
    throw new Error('A new up-to-date visit should return to the latest 36 cases in the complete library.')
  }

  console.log(JSON.stringify({ updateLifecycle: { expectedCount, initialCount, refreshedCount, nextVisit: 'all' } }))
  await context.close()
}

const browser = await chromium.launch({ headless: true })
try {
  await checkDesktop(browser)
  await checkAutomaticLoading(browser)
  await checkCombinedLoading(browser)
  await checkMobile(browser)
  await checkUpdateLifecycle(browser)
} finally {
  await browser.close()
}
