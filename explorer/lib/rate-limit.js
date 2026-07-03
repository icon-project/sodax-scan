// Best-effort in-memory fixed-window rate limiter. Note: on serverless hosts
// (Netlify functions) memory isn't shared across instances, so this is a
// speed-bump, not a hard guarantee. It's here to blunt casual abuse of the
// admin routes; the relay itself is the thing that needs real protection.
const buckets = new Map()

export function rateLimit(key, { max = 10, windowMs = 60_000 } = {}) {
    const now = Date.now()
    const entry = buckets.get(key)
    if (!entry || now > entry.reset) {
        buckets.set(key, { count: 1, reset: now + windowMs })
        return true
    }
    if (entry.count >= max) return false
    entry.count += 1
    return true
}

export function clientIp(request) {
    const fwd = request.headers.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0].trim()
    return request.headers.get('x-real-ip') || 'unknown'
}
