const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.addInitScript(() => localStorage.setItem('sodax-scan-theme', 'light'))
    await page.goto('http://localhost:3100/', { waitUntil: 'networkidle' })
    const res = await page.evaluate(async () => {
      const th = document.querySelector('.tp-thumb')
      const xs = []
      let run = true
      const loop = () => { if (!run) return; xs.push(Math.round(th.getBoundingClientRect().left * 10) / 10); requestAnimationFrame(loop) }
      requestAnimationFrame(loop)
      await new Promise(r => setTimeout(r, 100))
      document.querySelector('[role=radio][aria-label=Dark]').click()
      await new Promise(r => setTimeout(r, 500))
      run = false
      const uniq = xs.filter((v, i) => i === 0 || v !== xs[i - 1])
      const hdr = document.querySelector('header').getBoundingClientRect().height
      return { frames: xs.length, distinctPositions: uniq.length, path: uniq, dark: document.documentElement.classList.contains('dark'), headerH: hdr }
    })
    console.log(JSON.stringify(res))
    // header height in light at mobile too
    await page.setViewportSize({ width: 375, height: 812 })
    await page.evaluate(() => { localStorage.setItem('sodax-scan-theme', 'light') })
    await page.reload({ waitUntil: 'networkidle' })
    console.log(JSON.stringify({ mobileHeaderH: await page.evaluate(() => document.querySelector('header').getBoundingClientRect().height) }))
  } finally { await browser.close() }
})()
