// Register before the first navigation: production checks must not become visitors.
export async function createUntrackedContext(browser, options) {
  const context = await browser.newContext(options)
  await context.addInitScript(() => {
    try {
      localStorage.setItem('umami.disabled', '1')
    } catch {
      // Opaque documents have no localStorage; the script reruns on navigation.
    }
  })
  return context
}
