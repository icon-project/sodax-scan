// Usage: node run.js [--browser chromium|webkit|all] [--vp desktop|mobile|all] [--only A1,A3,B1,B2,C1,C2,D,E,F] [--rm] [--nofilm]
// Writes raw JSON to ./out/<browser>-<vp>[-rm]/<scn>.json and filmstrips to the docs dir.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { BASE, HARNESS, OUT_DIR, VIEWPORTS, frozen, makeState, installRoutes, launch } = require('./lib')

const DOCS = process.env.DOCS_DIR || '/Users/david/Github/sodax-scan/docs/design-audit/animation-grading'
const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
fs.mkdirSync(DOCS, { recursive: true })

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const flag = (k) => args.includes('--' + k)
const browsers = arg('browser', 'all') === 'all' ? ['chromium', 'webkit'] : [arg('browser')]
const vps = arg('vp', 'all') === 'all' ? ['desktop', 'mobile'] : [arg('vp')]
const only = arg('only', 'A1,A3,B1,B2,C1,C2,D,E,F').split(',')
const RM = flag('rm')
const FILM = !flag('nofilm')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const idOf = "(h) => h.split('/').pop()"

// ---------- probes (strings evaluated in page, per rAF) ----------
const ROWS_D = `Array.from(document.querySelectorAll('a.table-row'))`
const ROWS_M = `Array.from(document.querySelectorAll('ul.list-none > li'))`
const probes = {
    rowsDesktop: `() => { const rows = ${ROWS_D}; return rows.slice(0, 9).map(r => { const cs = getComputedStyle(r); return [r.getAttribute('href').split('/').pop(), Math.round(r.getBoundingClientRect().top * 100) / 100, +cs.opacity, cs.backgroundColor] }) }`,
    rowsMobile: `() => { const rows = ${ROWS_M}; return rows.slice(0, 6).map(r => { const cs = getComputedStyle(r), a = r.firstElementChild, ca = getComputedStyle(a), b = r.getBoundingClientRect(); return [a.getAttribute('href').split('/').pop(), Math.round(b.top * 100) / 100, +cs.opacity, cs.transform, cs.gridTemplateRows, Math.round(b.height * 100) / 100, cs.marginBottom, ca.backgroundColor] }) }`,
    counter: (vp) => `() => { const el = document.querySelector('${vp === 'desktop' ? '.text-5xl' : '.text-2xl.text-soda-bright'}'); if (!el) return null; const s = el.firstElementChild || el, cs = getComputedStyle(s); return [parseInt((s.textContent || '0').replace(/,/g, '')) || 0, +cs.opacity, cs.transform, s.className] }`,
    list: (vp) => `() => { const w = document.querySelector('[aria-busy]'); const rows = ${vp === 'desktop' ? ROWS_D : ROWS_M}; const ws = getComputedStyle(w); return { op: +ws.opacity, busy: w.getAttribute('aria-busy'), pe: ws.pointerEvents, n: rows.length, first: (rows[0] && (rows[0].getAttribute('href') || rows[0].firstElementChild.getAttribute('href'))) || null, tops: rows.slice(0, 4).map(r => Math.round(r.getBoundingClientRect().top * 100) / 100), h: Math.round(w.getBoundingClientRect().height), skeleton: !!document.querySelector('.animate-pulse'), sy: Math.round(scrollY), sh: document.scrollingElement.scrollHeight, nav: (document.querySelector('nav[aria-label=Pagination]')||{getBoundingClientRect:()=>({top:null})}).getBoundingClientRect().top } }`,
    pill: (id, vp) => `() => { const a = document.querySelector('${vp === 'desktop' ? 'a.table-row' : 'ul.list-none a'}[href="/messages/${id}"]'); const p = a && a.querySelector('span.rounded-full'); if (!p) return null; const cs = getComputedStyle(p), d = getComputedStyle(p.firstElementChild); const row = vp => getComputedStyle(${vp === 'desktop' ? 'a' : 'a.parentElement'}); return { txt: p.textContent, bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, dot: d.backgroundColor, dotBorder: d.borderTopColor, rowOp: +getComputedStyle(${vp === 'desktop' ? 'a' : 'a.parentElement'}).opacity, rowBg: getComputedStyle(a).backgroundColor, rowAnim: getComputedStyle(a).animationName } }`,
    copy: `() => { const b = document.querySelector('button[aria-label^="Copy"]'); if (!b) return null; const cs = getComputedStyle(b), s = b.querySelector('svg'), ss = getComputedStyle(s), st = b.parentElement.querySelector('[role=status]'), sc = getComputedStyle(st); return { btnT: cs.transform, btnBg: cs.backgroundColor, btnColor: cs.color, svgOp: +ss.opacity, svgT: ss.transform, svgColor: ss.color, svgCls: s.getAttribute('class'), lbl: st.textContent, lblOp: +sc.opacity, lblW: Math.round(st.getBoundingClientRect().width * 10) / 10, btnLeft: Math.round(b.getBoundingClientRect().left * 10) / 10 } }`,
    hover: `() => { const rows = ${ROWS_D}; return rows.slice(0, 6).map(r => { const c = r.firstElementChild, b = getComputedStyle(c, '::before'), cs = getComputedStyle(r); return [+b.opacity, cs.backgroundColor, b.transitionDuration, cs.transitionDuration] }) }`
}

// ---------- scenarios ----------
// each: setup(page, ctx), trigger(page, ctx) -> after recorder started; probe: string; ms: record duration; film: {clip fn, times}
async function settleLoad(page, vp, ms = 2700) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(vp === 'desktop' ? 'a.table-row' : 'ul.list-none > li', { timeout: 20000 })
    await wait(ms)
}
const clipRows = (vp, rowsAfter) => async (page) => {
    const b = await page.evaluate(([vp]) => {
        if (vp === 'desktop') { const t = document.querySelector('.table-row-group').getBoundingClientRect(); const h = document.querySelector('.table-header-group').getBoundingClientRect(); return { x: t.left, y: h.top, w: t.width, h: h.height + 52 * 8 } }
        const u = document.querySelector('ul.list-none').getBoundingClientRect(); return { x: u.left - 8, y: u.top - 8, w: u.width + 16, h: 460 }
    }, [vp])
    return b
}
const scenarios = {
    A1: { desc: 'new row arrives (1)', setup: async (p, c) => settleLoad(p, c.vp), trigger: async (p, c) => c.state.addRows(1), probe: (vp) => (vp === 'desktop' ? probes.rowsDesktop : probes.rowsMobile), ms: 4800, anims: true, clip: (vp) => clipRows(vp), times: [-60, 0, 40, 80, 120, 160, 240, 320, 480, 720, 1000, 1400] },
    A3: { desc: 'three rows arrive', setup: async (p, c) => settleLoad(p, c.vp), trigger: async (p, c) => c.state.addRows(3), probe: (vp) => (vp === 'desktop' ? probes.rowsDesktop : probes.rowsMobile), ms: 4800, anims: true, clip: (vp) => clipRows(vp), times: [-60, 0, 40, 80, 120, 160, 240, 320, 480, 720, 1000, 1400] },
    B1: { desc: 'counter first load', autostart: true, setup: async () => {}, trigger: async (p, c) => { await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }) }, probe: (vp) => probes.counter(vp), ms: 3000, anims: true, noClipWait: true, clip: (vp) => async (p) => p.evaluate(([vp]) => { const e = document.querySelector(vp === 'desktop' ? '.text-5xl' : '.text-2xl.text-soda-bright').getBoundingClientRect(); return { x: e.left - 220, y: e.top - 30, w: 300, h: e.height + 60 } }, [vp]), times: 'dense', t0mode: 'counter' },
    B2: { desc: 'counter increment', setup: async (p, c) => settleLoad(p, c.vp, 3500), trigger: async (p, c) => { c.state.total += 3 }, probe: (vp) => probes.counter(vp), ms: 4200, anims: true, clip: (vp) => async (p) => p.evaluate(([vp]) => { const e = document.querySelector(vp === 'desktop' ? '.text-5xl' : '.text-2xl.text-soda-bright').getBoundingClientRect(); return { x: e.left - 150, y: e.top - 20, w: 300, h: e.height + 40 } }, [vp]), times: [-40, 0, 30, 60, 90, 120, 160, 200, 260, 340], t0mode: 'counter' },
    C1: { desc: 'page change (dim+swap)', setup: async (p, c) => settleLoad(p, c.vp), trigger: async (p, c) => { await p.locator('nav[aria-label="Pagination"] button[aria-label*="ext"]').first().click() }, probe: (vp) => probes.list(vp), ms: 2600, anims: true, clip: (vp) => clipRows(vp), times: [-40, 0, 60, 120, 180, 240, 320, 400, 480, 560, 640, 800], t0mode: 'click' },
    C2: { desc: 'rapid double page change (interrupt)', setup: async (p, c) => settleLoad(p, c.vp), trigger: async (p, c) => { const b = p.locator('nav[aria-label="Pagination"] button[aria-label*="ext"]').first(); await b.click(); await wait(120); await b.click() }, probe: (vp) => probes.list(vp), ms: 3000, anims: true, clip: (vp) => clipRows(vp), times: [-40, 0, 80, 160, 240, 320, 400, 480, 560, 640, 800, 1000], t0mode: 'click' },
    D: { desc: 'status pending -> executed', pre: (c) => { c.targetId = c.state.base.data[2].id; c.state.statusOverride[c.targetId] = 'pending' }, setup: async (p, c) => settleLoad(p, c.vp), trigger: async (p, c) => { c.state.statusOverride[c.targetId] = 'executed' }, probe: (vp, c) => probes.pill(c.targetId, vp), ms: 4500, anims: true, clip: (vp, c) => async (p) => p.evaluate(([id, vp]) => { const a = document.querySelector((vp === 'desktop' ? 'a.table-row' : 'ul.list-none a') + '[href="/messages/' + id + '"]'); const r = a.getBoundingClientRect(); return vp === 'desktop' ? { x: r.left, y: r.top - 4, w: 320, h: 60 } : { x: r.left - 4, y: r.top - 4, w: 260, h: 64 } }, [c.targetId, vp]), times: [-40, 0, 40, 80, 120, 160, 200, 260, 320, 400], t0mode: 'pill' },
    E: { desc: 'copy button click', setup: async (p, c) => { const row = c.state.base.data.find((r) => r.intent_tx_hash) || c.state.base.data[0]; await p.goto(BASE + '/messages/' + row.id, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('button[aria-label^="Copy"]', { timeout: 20000 }); await wait(800) }, trigger: async (p, c) => { const b = await p.locator('button[aria-label^="Copy"]').first().boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await wait(300); await p.mouse.down(); await wait(180); await p.mouse.up() }, probe: () => probes.copy, ms: 2600, anims: true, direct: true, clip: () => async (p) => { const b = await p.locator('button[aria-label^="Copy"]').first().boundingBox(); return { x: b.x - 40, y: b.y - 14, w: 200, h: b.height + 28 } }, times: [-40, 0, 40, 80, 120, 160, 200, 260, 400, 1400, 1560, 1700], t0mode: 'copy' },
    F: { desc: 'row hover accent bar', desktopOnly: true, setup: async (p, c) => settleLoad(p, c.vp, 1500), trigger: async (p, c) => { const r = await p.locator('a.table-row').nth(3).boundingBox(); await p.mouse.move(r.x + 400, r.y + 26); await wait(900); await p.mouse.move(3, 3); await wait(700) }, probe: () => probes.hover, ms: 2200, anims: true, clip: () => async (p) => { const r = await p.locator('a.table-row').nth(3).boundingBox(); return { x: r.x, y: r.y - 52, w: 460, h: 156 } }, times: [-40, 0, 30, 60, 90, 120, 150, 200, 300, 940, 980, 1020, 1060, 1100, 1180], t0mode: 'hover' }
}

function runFilm({ frames, clip, times, t0, label, outPng, tmp }) {
    // frames: [{ts, data}] sorted. pick latest frame <= t0 + time
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true })
    const picks = times.map((t) => { let best = frames[0]; for (const f of frames) if (f.ts <= t0 + t) best = f; return { t, f: best } })
    picks.forEach((p, i) => {
        const src = path.join(tmp, `src${i}.jpg`); fs.writeFileSync(src, p.f.data)
        const dst = path.join(tmp, `t${String(i).padStart(2, '0')}.png`)
        const c = { x: Math.max(0, Math.round(clip.x)), y: Math.max(0, Math.round(clip.y)), w: Math.round(clip.w), h: Math.round(clip.h) }
        const sign = p.t >= 0 ? '+' : '-'
        const vf = `crop=${c.w}:${c.h}:${c.x}:${c.y},pad=iw+6:ih+22:3:20:color=0xdddddd,drawtext=fontfile=${FONT}:text='${sign}${Math.abs(Math.round(p.t))}ms':x=6:y=3:fontsize=15:fontcolor=black`
        execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src, '-vf', vf, dst])
    })
    const n = picks.length
    const cols = Math.min(n, Number(process.env.FILM_COLS) || (clip.w > 600 ? 3 : n > 8 ? 6 : 5))
    const rows = Math.ceil(n / cols)
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, 't%02d.png'), '-vf', `tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', '-update', '1', outPng])
    return fs.statSync(outPng).size
}

async function runOne(browserName, vp, scnName, kind) {
    const scn = scenarios[scnName]
    const { browser, context } = await launch(browserName, vp, { reducedMotion: RM })
    const ctx = { vp }
    try {
        const base = await frozen('msgs-skip0-limit20', 'https://sodaxscan.com/api/messages?skip=0&limit=20')
        ctx.state = makeState(JSON.parse(JSON.stringify(base)))
        await installRoutes(context, ctx.state)
        if (scn.pre) scn.pre(ctx)
        const page = await context.newPage()
        const probeSrc = kind === 'perf' ? null : scn.probe(vp, ctx)
        if (scn.autostart) await context.addInitScript(`window.__rec.start(${JSON.stringify(probeSrc)}, ${kind !== 'perf'})`)
        await scn.setup(page, ctx)
        let clip = null
        const frames = []
        const film = FILM && kind === 'probe' && !RM && browserName === 'chromium' || (FILM && kind === 'probe' && !RM && browserName === 'webkit')
        if (film && !scn.noClipWait) clip = await scn.clip(vp, ctx)(page)
        if (film) await page.screencast.start({ onFrame: (f) => frames.push({ ts: f.timestamp, data: f.data }), size: VIEWPORTS[vp], quality: 90 })
        let tTrigger
        if (!scn.autostart) await page.evaluate(([src, an]) => window.__rec.start(src, an), [probeSrc, kind !== 'perf'])
        tTrigger = Date.now()
        await scn.trigger(page, ctx)
        if (scn.autostart && film) { try { clip = await scn.clip(vp, ctx)(page) } catch (e) {} }
        await wait(scn.ms)
        if (film && scn.noClipWait && !clip) clip = await scn.clip(vp, ctx)(page)
        const rec = await page.evaluate(() => window.__rec.stop())
        if (film) await page.screencast.stop()
        const epoch0 = rec.timeOrigin
        const result = { browser: browserName, vp, scn: scnName, kind, rm: RM, tTriggerEpoch: tTrigger, rec, clip, pollHits: ctx.state.hits }
        const dir = path.join(OUT_DIR, `${browserName}-${vp}${RM ? '-rm' : ''}`); fs.mkdirSync(dir, { recursive: true })
        let filmInfo = null
        if (film && frames.length && clip) {
            // t0 for film: computed by analyze step in-process (shared function)
            const { arrival } = require('./analyze')
            const aT = arrival(scnName, rec) // performance.now ms
            const times = scn.times === 'dense' ? [-0, 60, 120, 200, 280, 360, 440, 520, 600, 700, 800, 1000] : scn.times
            if (aT != null) {
                const t0 = epoch0 + aT
                const png = path.join(DOCS, `${scnName}-${browserName}-${vp}.png`)
                const size = runFilm({ frames, clip, times, t0, label: scnName, outPng: png, tmp: path.join(HARNESS, 'tmp', `${browserName}-${vp}-${scnName}`) })
                filmInfo = { png, size, frames: frames.length, t0, nFrames: frames.length }
            } else filmInfo = { error: 'no arrival detected', frames: frames.length }
        }
        result.film = filmInfo
        fs.writeFileSync(path.join(dir, `${scnName}.${kind}.json`), JSON.stringify(result))
        return result
    } finally {
        await context.close().catch(() => {})
        await browser.close().catch(() => {})
    }
}

;(async () => {
    for (const b of browsers) for (const vp of vps) for (const s of only) {
        const scn = scenarios[s]
        if (scn.desktopOnly && vp !== 'desktop') continue
        for (const kind of RM ? ['probe'] : ['perf', 'probe']) {
            try {
                const r = await runOne(b, vp, s, kind)
                console.log(`${b} ${vp} ${s} ${kind}${RM ? ' rm' : ''}: frames=${r.rec.frames.length} probes=${r.rec.probes.length} film=${r.film ? (r.film.size ? Math.round(r.film.size / 1024) + 'kB' : r.film.error) : '-'}${r.rec.probeErr ? ' ERR ' + r.rec.probeErr : ''}`)
            } catch (e) { console.log(`${b} ${vp} ${s} ${kind} FAILED: ${e.message.split('\n')[0]}`) }
        }
    }
})()
