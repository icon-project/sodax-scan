// Usage: node report.js [dir-substring] ; prints numeric summaries of out/*/*.json (used to write baseline.md)
const fs = require('fs'), path = require('path')
const { arrival } = require('./analyze')
const OUT = path.join(__dirname, 'out')
const filter = process.argv[2] || ''
const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number)
const r1 = (x) => Math.round(x * 10) / 10
const r3 = (x) => Math.round(x * 1000) / 1000
function bez(p1x, p1y, p2x, p2y) { return (x) => { let lo = 0, hi = 1, t = x; for (let i = 0; i < 40; i++) { t = (lo + hi) / 2; const cx = 3 * (1 - t) ** 2 * t * p1x + 3 * (1 - t) * t * t * p2x + t ** 3; if (cx < x) lo = t; else hi = t } return 3 * (1 - t) ** 2 * t * p1y + 3 * (1 - t) * t * t * p2y + t ** 3 } }
const easeOut = bez(0.23, 1, 0.32, 1)
const std = bez(0.4, 0, 0.2, 1)
const crossing = (series, f) => { const x = series.find((s) => f(s.v)); return x ? r1(x.t) : null }

function perf(r, a0) {
    const fr = r.rec.frames
    const win = a0 == null ? fr : fr.filter((f) => f.t >= a0 - 50 && f.t <= a0 + 1500)
    const dts = win.map((f) => f.dt)
    const dropped = dts.filter((d) => d > 20).length
    const over33 = dts.filter((d) => d > 33.5).length
    const mean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1)
    const lt = (r.rec.longtasks || []).filter((l) => a0 == null || (l.t >= a0 - 50 && l.t <= a0 + 1500))
    const ls = (r.rec.shifts || []).filter((l) => a0 == null || (l.t >= a0 - 50 && l.t <= a0 + 1500))
    return { frames: dts.length, meanDt: r1(mean), maxDt: r1(Math.max(...dts)), dropped_gt20: dropped, gt33: over33, longtasks: lt.length, longtaskMax: lt.length ? r1(Math.max(...lt.map((l) => l.d))) : 0, cls: r3(ls.reduce((a, b) => a + b.v, 0)), shifts: ls.map((s) => [r1(s.t - (a0 || 0)), r3(s.v), JSON.stringify(s.src || [])]), noLongtask: r.rec.noLongtask, noLayoutShift: r.rec.noLayoutShift }
}
function firstMut(r, type) { const m = r.rec.mut.find((x) => x.type === type); return m ? m.t : null }

function analyzeProbe(r) {
    const scn = r.scn, P = r.rec.probes
    const a0 = arrival(scn, r.rec)
    const out = { scn, a0: a0 && r1(a0 - r.rec.t0), anims: r.rec.anims, film: r.film && r.film.size ? Math.round(r.film.size / 1024) + 'kB' : r.film }
    if (a0 == null) { out.error = 'no arrival'; return out }
    const rel = P.map((p) => ({ t: p.t - a0, v: p.v }))
    const win = rel.filter((p) => p.t >= -60 && p.t <= 1600)
    if (scn.startsWith('A')) {
        const mobile = r.vp === 'mobile'
        const pre = rel.filter((p) => p.t < 0).slice(-1)[0].v
        const oldTopId = pre[0][0]
        const tracks = win.map((p) => { const nr = p.v[0]; const old = p.v.find((x) => x[0] === oldTopId); return { t: r1(p.t), newId: nr[0], newTop: nr[1], op: nr[2], bg: mobile ? nr[7] : nr[3], tf: mobile ? nr[3] : null, gtr: mobile ? nr[4] : null, h: mobile ? nr[5] : null, mb: mobile ? nr[6] : null, oldTop: old ? old[1] : null } })
        const newRows = tracks.filter((x) => x.newId !== oldTopId)
        out.first = newRows[0]
        // how rows below move: oldTop series for first 8 frames after arrival
        out.oldTopSeries = tracks.filter((x) => x.t >= -20 && x.t < 400).map((x) => [x.t, x.oldTop])
        out.preOldTop = pre.find((x) => x[0] === oldTopId)[1]
        const ser = (k) => newRows.map((x) => ({ t: x.t, v: x[k] }))
        out.opacityT = { t10: crossing(ser('op'), (v) => v >= 0.1), t50: crossing(ser('op'), (v) => v >= 0.5), t90: crossing(ser('op'), (v) => v >= 0.9), t99: crossing(ser('op'), (v) => v >= 0.99) }
        const bgAt = (t) => { const x = rel.filter((p) => p.t >= t).slice(0, 1)[0]; return x ? (mobile ? x.v[0][7] : x.v[0][3]) : null }
        out.bg = [0, 100, 200, 400, 800, 1200, 1500].map((t) => [t, bgAt(t)])
        // model residual for opacity: opacity = easeOut(min(t/480,1)) measured from first new frame
        const s0 = newRows[0].t
        out.opacityResidual = r3(Math.max(...newRows.filter((x) => x.t - s0 < 700).map((x) => Math.abs(x.op - easeOut(Math.min((x.t - s0) / 480, 1))))))
        out.opacitySamples = newRows.filter((x) => x.t < 700).map((x) => [x.t, r3(x.op)]).slice(0, 14)
        if (mobile) out.mobileSamples = newRows.filter((x) => x.t < 420).map((x) => [x.t, x.h, x.op, x.tf, x.gtr, x.mb, x.newTop]).slice(0, 22)
        const ids = new Set(); P.forEach((p) => p.v.slice(0, 2).forEach((x) => ids.add(x[0])))
        out.perfWindowStart = a0
    }
    if (scn === 'B1' || scn === 'B2') {
        const base = scn === 'B2' ? P[0].v[0] : 0
        const final = Math.max(...rel.map((p) => p.v ? p.v[0] : 0))
        const ser = rel.filter((p) => p.t >= -60 && p.t < 1600 && p.v).map((p) => ({ t: p.t, v: p.v[0], op: p.v[1], tf: p.v[2] }))
        out.final = final; out.base = base
        const f = (x) => (x - base) / (final - base || 1)
        out.t = { t10: crossing(ser, (v) => f(v) >= 0.1), t50: crossing(ser, (v) => f(v) >= 0.5), t90: crossing(ser, (v) => f(v) >= 0.9), t100: crossing(ser, (v) => f(v) >= 1) }
        if (scn === 'B1') {
            const s0 = ser.find((x) => x.v > 0).t
            out.residual = r3(Math.max(...ser.filter((x) => x.t >= s0 && x.t - s0 <= 700).map((x) => Math.abs(f(x.v) - (1 - (1 - Math.min((x.t - s0) / 700, 1)) ** 3)))))
            out.valueSamples = ser.filter((x) => x.t < 900).map((x) => [r1(x.t), x.v, r3(x.op)]).filter((_, i) => i % 3 === 0)
            // time from navigation start to first non-zero
            out.navToFirstValue = r1(P.find((p) => p.v && p.v[0] > 0).t - r.rec.t0)
            out.zeroFrames = P.filter((p) => p.v && p.v[0] === 0).length
        } else {
            out.tickSamples = ser.filter((x) => x.t < 400).map((x) => [r1(x.t), x.v, r3(x.op), x.tf]).slice(0, 18)
        }
    }
    if (scn.startsWith('C')) {
        const ser = win.map((p) => p.v)
        out.series = win.filter((p) => p.t < 1500).filter((_, i) => i % 2 === 0).map((p) => [r1(p.t), r3(p.v.op), p.v.busy, p.v.n, (p.v.first || '').split('/').pop(), p.v.tops[0], p.v.h, p.v.skeleton ? 'skel' : '', 'sy=' + p.v.sy, 'sh=' + p.v.sh, 'nav=' + (p.v.nav && Math.round(p.v.nav))])
        const dim = rel.filter((p) => p.t >= -60), op = dim.map((p) => ({ t: p.t, v: p.v.op }))
        out.dimT = { t_below_0_99: crossing(op, (v) => v < 0.99), t_le_0_61: crossing(op, (v) => v <= 0.61), back_ge_0_99: (() => { const afterDim = op.filter((x) => x.t > 0); const x = afterDim.find((y, i) => i > 0 && y.v >= 0.99 && afterDim.slice(0, i).some((z) => z.v < 0.7)); return x ? r1(x.t) : null })() }
        const firstIds = rel.map((p) => (p.v.first || '')); const changes = []; firstIds.forEach((f, i) => { if (i && f !== firstIds[i - 1]) changes.push([r1(rel[i].t), f.split('/').pop()]) })
        out.firstRowChanges = changes
        const hs = rel.filter((p) => p.t > -60).map((p) => p.v.h); out.pageHeightMinMax = [Math.min(...hs), Math.max(...hs)]
        out.skeletonFrames = rel.filter((p) => p.v.skeleton).length
    }
    if (scn === 'D') {
        const ser = win.filter((p) => p.v).map((p) => ({ t: p.t, bg: rgb(p.v.bg), dot: rgb(p.v.dot), color: rgb(p.v.color), border: rgb(p.v.border), v: p.v }))
        const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
        const last = ser[ser.length - 1], first = ser[0]
        const prog = (k) => ser.map((s) => ({ t: s.t, v: dist(s[k], first[k]) / (dist(last[k], first[k]) || 1) }))
        out.from = first.v; out.to = last.v
        out.bgT = { t10: crossing(prog('bg'), (v) => v >= 0.1), t50: crossing(prog('bg'), (v) => v >= 0.5), t90: crossing(prog('bg'), (v) => v >= 0.9), t99: crossing(prog('bg'), (v) => v >= 0.99) }
        out.dotT = { t10: crossing(prog('dot'), (v) => v >= 0.1), t90: crossing(prog('dot'), (v) => v >= 0.9) }
        out.textColorT = { t10: crossing(prog('color'), (v) => v >= 0.1), t90: crossing(prog('color'), (v) => v >= 0.9) }
        out.bgSamples = prog('bg').filter((x) => x.t > -20 && x.t < 420).map((x) => [r1(x.t), r3(x.v)]).filter((_, i) => i % 2 === 0)
        out.rowDisturbed = win.some((p) => p.v.rowOp < 1 || p.v.rowAnim !== 'none')
        // model residual: tailwind default cubic-bezier(.4,0,.2,1) 300ms from first change frame
        const s0 = prog('bg').find((x) => x.v > 0.001)
        if (s0) out.residualVsStd300 = r3(Math.max(...prog('bg').filter((x) => x.t >= s0.t && x.t - s0.t < 350).map((x) => Math.abs(x.v - std(Math.min((x.t - s0.t) / 300, 1))))))
    }
    if (scn === 'E') {
        const ser = rel.filter((p) => p.t >= -400 && p.t < 1800 && p.v)
        out.press = ser.filter((p) => p.t < 0).map((p) => p.v.btnT).filter((v, i, a) => i === 0 || v !== a[i - 1]).slice(0, 12)
        out.svgSamples = ser.filter((p) => p.t >= -20 && p.t < 300).map((p) => [r1(p.t), r3(p.v.svgOp), p.v.svgT, p.v.svgColor, p.v.svgCls, r3(p.v.lblOp), p.v.lblW, p.v.btnLeft]).slice(0, 22)
        out.layoutBtnLeft = [Math.min(...ser.map((p) => p.v.btnLeft)), Math.max(...ser.map((p) => p.v.btnLeft))]
        out.lblWidths = [...new Set(ser.map((p) => p.v.lblW))]
        out.revert = ser.filter((p) => p.t > 1300).map((p) => [r1(p.t), r3(p.v.svgOp), p.v.svgT, p.v.lbl, r3(p.v.lblOp)]).filter((_, i) => i % 4 === 0).slice(0, 12)
        const op = ser.filter((p) => p.t >= 0).map((p) => ({ t: p.t, v: p.v.svgOp }))
        out.iconOpacityT = { t50: crossing(op, (v) => v >= 0.5), t99: crossing(op, (v) => v >= 0.99) }
    }
    if (scn === 'F') {
        const ser = P.map((p) => ({ t: p.t - a0, v: p.v[3] })).filter((p) => p.t > -100)
        out.row3 = ser.filter((_, i) => i % 2 === 0).slice(0, 40).map((p) => [r1(p.t), r3(p.v[0]), p.v[1], p.v[2], p.v[3]])
        const up = ser.filter((p) => p.t >= 0)
        out.beforeTransition = P[0].v[3]
        out.upT = { t10: crossing(up, (v) => v[0] >= 0.1), t90: crossing(up, (v) => v[0] >= 0.9) }
        const down = ser.filter((p) => p.t > 800); const peak = down.find((p) => p.v[0] >= 0.99)
        out.downT = { t_lt90: crossing(down, (v) => v[0] < 0.9), t_lt10: crossing(down, (v) => v[0] < 0.1) }
    }
    return out
}

for (const d of fs.readdirSync(OUT).filter((x) => fs.statSync(path.join(OUT, x)).isDirectory() && x.includes(filter))) {
    for (const f of fs.readdirSync(path.join(OUT, d)).sort()) {
        const r = JSON.parse(fs.readFileSync(path.join(OUT, d, f)))
        let a0 = null
        if (r.kind === 'perf') {
            const t = r.scn.startsWith('A') || r.scn.startsWith('C') ? firstMut(r, 'childList') : r.scn === 'D' ? firstMut(r, 'attributes') : null
            a0 = t
            console.log(`\n## ${d} ${r.scn} PERF`, JSON.stringify(perf(r, a0)))
        } else {
            console.log(`\n## ${d} ${r.scn} PROBE`)
            try { console.log(JSON.stringify(analyzeProbe(r))) } catch (e) { console.log('ANALYZE ERR', e.stack.split('\n').slice(0, 3).join(' | ')) }
        }
    }
}
