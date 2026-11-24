// one-off: why does scrollY jump on page change? logs scroll events + document height changes
const { launch, frozen, makeState, installRoutes, BASE } = require('./lib')
;(async () => {
  const { browser, context } = await launch('chromium', 'desktop')
  try {
    const st = makeState(await frozen('msgs-skip0-limit20', 'https://sodaxscan.com/api/messages?skip=0&limit=20'))
    await installRoutes(context, st)
    const page = await context.newPage()
    await page.goto(BASE + '/'); await page.waitForSelector('a.table-row'); await page.waitForTimeout(2500)
    await page.evaluate(() => { window.__log = []; const L = (k) => window.__log.push([Math.round(performance.now()), k, Math.round(scrollY), document.scrollingElement.scrollHeight, document.querySelectorAll('a.table-row').length, !!document.querySelector('.animate-pulse')]);
      addEventListener('scroll', () => L('scroll')); new ResizeObserver(() => L('resize')).observe(document.body);
      new MutationObserver(() => L('mut')).observe(document.body, { childList: true, subtree: true }) })
    if (process.env.NOANCHOR) await page.addStyleTag({ content: '*{overflow-anchor:none!important}' })
    if (process.env.WRAP) await page.addStyleTag({ content: '[aria-busy]{overflow-anchor:none}' })
    if (process.env.LOCK) await page.evaluate(() => { const w = document.querySelector('[aria-busy]'); w.style.minHeight = w.getBoundingClientRect().height + 'px' })
    await page.locator('nav[aria-label="Pagination"] button[aria-label*="ext"]').first().click()
    await page.waitForTimeout(1200)
    const log = await page.evaluate(() => window.__log)
    console.log(log.slice(0, 60).map((x) => x.join(' ')).join('\n'))
  } finally { await context.close(); await browser.close() }
})()
