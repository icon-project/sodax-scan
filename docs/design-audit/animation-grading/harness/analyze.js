// arrival(scn, rec): performance.now() timestamp of the visible change we measure from (null if not found)
function arrival(scn, rec) {
    const P = rec.probes
    if (!P.length) return null
    const first = P[0].v
    if (scn.startsWith('A')) { // first frame where the first row id differs
        const id0 = first && first[0] && first[0][0]
        const f = P.find((p) => p.v && p.v[0] && p.v[0][0] !== id0)
        return f ? f.t : null
    }
    if (scn === 'B1' || scn === 'B2') {
        const base = scn === 'B2' ? first[0] : 0
        const f = P.find((p) => p.v && p.v[0] > base)
        return f ? f.t : null
    }
    if (scn.startsWith('C')) { const f = P.find((p) => p.v && p.v.busy === 'true'); return f ? f.t : null }
    if (scn === 'D') { const t0 = first && first.txt; const f = P.find((p) => p.v && p.v.txt !== t0); return f ? f.t : null }
    if (scn === 'E') { const f = P.find((p) => p.v && p.v.lbl === 'Copied'); return f ? f.t : null }
    if (scn === 'F') { const f = P.find((p) => p.v && p.v.some((r) => r[0] > 0)); return f ? f.t : null }
    return null
}
module.exports = { arrival }
