// Short-lived cache for expensive read queries (full-table counts). Every
// explorer tab and the indexer poll the same endpoints every few seconds, so
// sharing one result per key for `ttlMs` turns N concurrent polls into one DB
// round trip. The promise itself is stored, so callers arriving while the
// query is still running share it instead of starting their own.
const createQueryCache = ({ ttlMs, maxEntries, now = Date.now }) => {
    if (!(ttlMs > 0)) throw new Error(`createQueryCache: ttlMs must be > 0, got ${ttlMs}`)
    if (!(maxEntries > 0)) throw new Error(`createQueryCache: maxEntries must be > 0, got ${maxEntries}`)

    const entries = new Map()

    // Keys come from user-supplied filters, so the map must stay bounded.
    // Expired entries go first; if it is still full, the oldest insertions go.
    const makeRoom = () => {
        const t = now()
        for (const [key, entry] of entries) {
            if (entry.expiresAt <= t) entries.delete(key)
        }
        while (entries.size >= maxEntries) {
            entries.delete(entries.keys().next().value)
        }
    }

    const get = (key, load) => {
        const hit = entries.get(key)
        if (hit && hit.expiresAt > now()) return hit.promise
        if (hit) entries.delete(key)
        if (entries.size >= maxEntries) makeRoom()

        const promise = load()
        entries.set(key, { promise, expiresAt: now() + ttlMs })
        // A failed query must not be served to later callers for the rest of
        // the TTL. The caller still receives the rejection via `promise`.
        promise.catch(() => {
            if (entries.get(key)?.promise === promise) entries.delete(key)
        })
        return promise
    }

    return { get, size: () => entries.size }
}

module.exports = { createQueryCache }
