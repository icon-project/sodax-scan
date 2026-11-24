// one-off: does transform on a display:table-row element work (needed for a FLIP push-down)? chromium + webkit
const { launch, frozen, makeState, installRoutes, BASE } = require('./lib')
;(async () => {
  for (const b of ['chromium', 'webkit']) {
    const { browser, context } = await launch(b, 'desktop')
    try {
      const st = makeState(await frozen('msgs-skip0-limit20', 'https://sodaxscan.com/api/messages?skip=0&limit=20'))
      await installRoutes(context, st)
      const page = await context.newPage()
      await page.goto(BASE + '/'); await page.waitForSelector('a.table-row'); await page.waitForTimeout(1500)
      const r = await page.evaluate(async () => {
        const rows = [...document.querySelectorAll('a.table-row')].slice(0, 5)
        const base = rows.map((x) => x.getBoundingClientRect().top)
        const anims = rows.map((x) => x.animate([{ transform: 'translateY(-52px)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.23,1,0.32,1)' }))
        await new Promise((r) => setTimeout(r, 80))
        const mid = rows.map((x, i) => Math.round((x.getBoundingClientRect().top - base[i]) * 10) / 10)
        const cellMid = rows.map((x) => getComputedStyle(x).transform)
        return { mid, cellMid: cellMid[0] }
      })
      console.log(b, JSON.stringify(r))
    } finally { await context.close(); await browser.close() }
  }
})()
