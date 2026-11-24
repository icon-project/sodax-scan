// FLIP helpers for the live list (pure; the DOM work lives in components/flip-container.js).

// Glide timing for rows displaced by a new row.
export const FLIP_TIMING = { duration: 320, easing: 'cubic-bezier(.23,1,.32,1)' }

// prev / next: Map(id -> top offset in px) before and after the DOM update.
// fresh: Set of ids flagged as just arrived.
// Returns [{ id, delta }] (delta = prevTop - nextTop, the translateY to start
// from) for rows that existed before and moved. Returns [] unless a genuinely
// new row (absent from prev, present in next and flagged fresh) was inserted,
// so first loads, page changes and filter changes never glide.
export function flipDeltas(prev, next, fresh) {
    if (!prev || !next || !fresh || fresh.size === 0) return []
    const inserted = new Set()
    for (const id of next.keys()) if (!prev.has(id)) inserted.add(id)
    let hasFresh = false
    for (const id of inserted) if (fresh.has(id)) hasFresh = true
    if (!hasFresh) return []
    // A wholesale replacement (nothing survived) is a page/filter change, not an insert.
    let survivors = 0
    const out = []
    for (const [id, top] of next) {
        if (!prev.has(id)) continue
        survivors++
        const delta = prev.get(id) - top
        if (Math.abs(delta) >= 0.5) out.push({ id, delta })
    }
    return survivors === 0 ? [] : out
}
