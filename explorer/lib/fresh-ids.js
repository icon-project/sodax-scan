// Pure "which ids just arrived" logic for the live list (no React, unit-tested).
//
// State is `{ key, seen: Set }`. `key` identifies the query the ids belong to
// (filters + page + page size). The first call and every key change SEED the
// seen set and report nothing fresh, so loading or switching a view never
// animates. Within the same key, ids not seen before are fresh, unless the
// view is not page 1 (new rows there only slid over from page 1) or too many
// arrived at once (tab was hidden, bulk catch-up).

export const MAX_FRESH_BURST = 5

function uniqueIds(ids) {
    return Array.from(new Set((ids || []).filter((id) => id !== undefined && id !== null)))
}

export function nextFreshState(prev, { key, ids, page = 1, max = MAX_FRESH_BURST }) {
    const all = uniqueIds(ids)
    if (!prev || prev.key !== key) {
        return { key, seen: new Set(all), fresh: [] }
    }
    const added = all.filter((id) => !prev.seen.has(id))
    const seen = new Set(prev.seen)
    all.forEach((id) => seen.add(id))
    const animate = page === 1 && added.length > 0 && added.length <= max
    return { key, seen, fresh: animate ? added : [] }
}
