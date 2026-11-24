// Shared harness: browser launch, API interception, in-page recorders.
const { chromium, webkit } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE_URL || 'http://localhost:3100'
const HARNESS = __dirname
const FROZEN_DIR = path.join(HARNESS, 'frozen')
const OUT_DIR = path.join(HARNESS, 'out')
fs.mkdirSync(FROZEN_DIR, { recursive: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 375, height: 812 } }

// Fetch a real API response once, then always serve from disk.
async function frozen(name, url) {
    const f = path.join(FROZEN_DIR, name + '.json')
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'))
    const res = await fetch(url)
    const json = await res.json()
    fs.writeFileSync(f, JSON.stringify(json))
    return json
}

// state: { extra: [rows to prepend on page1 unfiltered], total, statusOverride: {id: status}, delay: ms for non-first-page }
function makeState(base) {
    const top = base.data[0]
    const maxId = Math.max(...base.data.map((r) => Number(r.id)))
    return {
        base,
        maxId,
        extra: [],
        total: 1125923,
        statusOverride: {},
        delayOther: 350,
        hits: 0,
        newRow(i) {
            return {
                ...top,
                id: maxId + 1 + i,
                status: 'pending',
                sn: String(900000 + i),
                created_at: String(Math.floor(Date.now() / 1000)),
                src_tx_hash: '0x' + (maxId + 1 + i).toString(16).padStart(64, 'a'),
                intent_tx_hash: null
            }
        },
        addRows(n) {
            this.extra = Array.from({ length: n }, (_, i) => this.newRow(n - 1 - i)) // newest first
            this.total += n
        }
    }
}

async function installRoutes(context, state) {
    await context.route(/\/api\/messages\?/, async (route) => {
        const url = new URL(route.request().url())
        const skip = url.searchParams.get('skip') || '0'
        const limit = url.searchParams.get('limit') || '20'
        const filtered = ['status', 'src_network', 'dest_network', 'action_type', 'kind'].some((k) => url.searchParams.get(k))
        const key = `msgs-skip${skip}-limit${limit}` + (filtered ? '-' + url.search.replace(/[^a-z0-9]/gi, '_') : '')
        const real = url.origin + '/api/messages' + url.search
        const body = JSON.parse(JSON.stringify(await frozen(key, real.startsWith('http://localhost') ? 'https://sodaxscan.com/api/messages' + url.search : real)))
        const isFirst = skip === '0' && !filtered
        if (isFirst) {
            state.hits++
            if (state.extra.length) body.data = [...state.extra, ...body.data].slice(0, Number(limit))
            body.data.forEach((r) => { if (state.statusOverride[r.id]) r.status = state.statusOverride[r.id] })
        } else if (state.delayOther) {
            await new Promise((r) => setTimeout(r, state.delayOther))
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
            body: JSON.stringify(body)
        })
    })
    await context.route(/\/statistics\/total_messages/, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
            body: JSON.stringify({ data: { total: state.total } })
        })
    )
}

// In-page recorder. window.__rec.start(probeFn) samples every rAF.
const INIT_SCRIPT = `
(() => {
  const R = window.__rec = { frames: [], probes: [], longtasks: [], shifts: [], anims: {}, mut: [], on: false, probeFn: null, t0: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (R.on) R.longtasks.push({ t: e.startTime, d: e.duration }) }).observe({ type: 'longtask', buffered: false }) } catch (e) { R.noLongtask = true }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (R.on) R.shifts.push({ t: e.startTime, v: e.value, hadInput: e.hadRecentInput, src: (e.sources||[]).map(x=>({n:x.node?(x.node.tagName+'.'+String(x.node.className).slice(0,40)):null,p:x.previousRect&&[Math.round(x.previousRect.x),Math.round(x.previousRect.y),Math.round(x.previousRect.width),Math.round(x.previousRect.height)],c:x.currentRect&&[Math.round(x.currentRect.x),Math.round(x.currentRect.y),Math.round(x.currentRect.width),Math.round(x.currentRect.height)]})) }) }).observe({ type: 'layout-shift', buffered: false }) } catch (e) { R.noLayoutShift = true }
  let last = 0;
  const loop = (now) => {
    if (R.on) {
      if (last) R.frames.push({ t: now, dt: now - last });
      if (R.probeFn) {
        try { R.probes.push({ t: now, v: R.probeFn() }) } catch (e) { R.probeErr = String(e) }
        if (R.withAnims) {
          for (const a of document.getAnimations()) {
            const eff = a.effect, tgt = eff && eff.target;
            const k = (a.animationName || a.transitionProperty || '?') + '|' + (tgt ? tgt.tagName + '.' + String(tgt.className).slice(0, 60) : '');
            if (!R.anims[k]) { const ct = eff.getComputedTiming(); R.anims[k] = { kind: a.constructor.name, name: a.animationName || a.transitionProperty, duration: ct.duration, easing: eff.getTiming().easing, delay: ct.delay, fill: ct.fill, props: eff.getKeyframes ? [...new Set(eff.getKeyframes().flatMap(f => Object.keys(f).filter(x => !['offset','computedOffset','easing','composite'].includes(x))))] : [], firstSeen: now } }
          }
        }
      }
    }
    last = now; requestAnimationFrame(loop)
  };
  requestAnimationFrame(loop);
  // mark arrival: first DOM mutation that adds a row / changes a pill class
  new MutationObserver(ms => { if (!R.on) return; for (const m of ms) { R.mut.push({ t: performance.now(), type: m.type, tgt: (m.target.tagName||'') }) } }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  R.start = (probeSrc, withAnims) => { R.frames = []; R.probes = []; R.longtasks = []; R.shifts = []; R.mut = []; R.anims = {}; R.noProbe = !probeSrc; R.probeFn = probeSrc ? eval('(' + probeSrc + ')') : null; R.withAnims = !!withAnims; R.t0 = performance.now(); R.on = true; return R.t0 };
  R.stop = () => { R.on = false; return { frames: R.frames, probes: R.probes, longtasks: R.longtasks, shifts: R.shifts, anims: R.anims, mut: R.mut, t0: R.t0, noLongtask: R.noLongtask, noLayoutShift: R.noLayoutShift, probeErr: R.probeErr, timeOrigin: performance.timeOrigin } };
  // stub clipboard so copy succeeds in every engine (headless permission differences)
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') }, configurable: true }) } catch (e) {}
})();
`

async function launch(browserName, viewportName, opts = {}) {
    const type = browserName === 'webkit' ? webkit : chromium
    const browser = await type.launch({ headless: true })
    const context = await browser.newContext({
        viewport: VIEWPORTS[viewportName],
        deviceScaleFactor: 1,
        reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
        hasTouch: viewportName === 'mobile' && browserName === 'chromium' ? false : false
    })
    await context.addInitScript(INIT_SCRIPT)
    return { browser, context }
}

module.exports = { BASE, HARNESS, OUT_DIR, VIEWPORTS, frozen, makeState, installRoutes, launch }
