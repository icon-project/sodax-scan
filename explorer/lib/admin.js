// Server-only admin auth helpers. NEVER import this from a client component:
// it reads ADMIN_SECRET, which must stay out of the browser bundle.
//
// Auth model: a single shared password (ADMIN_SECRET, server env only). On a
// correct password we hand out a short-lived signed cookie. The cookie is a
// stateless HMAC token — `${expiry}.${hmac(secret, expiry)}` — so the server
// can verify it without any session store, and it can't be forged without the
// secret. No secret or hash is ever shipped to the client.
import crypto from 'crypto'

export const COOKIE_NAME = 'sodax_debug'
export const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
export const COOKIE_MAX_AGE = TTL_MS / 1000 // seconds, for cookie maxAge

function secret() {
    const s = process.env.ADMIN_SECRET
    if (!s) throw new Error('ADMIN_SECRET is not set — /debugmode is disabled')
    return s
}

// Constant-time password comparison. Hashing both sides to a fixed 32 bytes
// first sidesteps timingSafeEqual's equal-length requirement and avoids leaking
// the secret's length via a thrown error.
export function checkPassword(pw) {
    if (typeof pw !== 'string' || pw.length === 0) return false
    let expected
    try {
        expected = secret()
    } catch {
        return false
    }
    const a = crypto.createHash('sha256').update(pw).digest()
    const b = crypto.createHash('sha256').update(expected).digest()
    return crypto.timingSafeEqual(a, b)
}

function sign(value) {
    return crypto.createHmac('sha256', secret()).update(value).digest('base64url')
}

export function makeToken() {
    const exp = String(Date.now() + TTL_MS)
    return `${exp}.${sign(exp)}`
}

export function verifyToken(token) {
    if (typeof token !== 'string') return false
    const dot = token.indexOf('.')
    if (dot <= 0) return false
    const exp = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    let expected
    try {
        expected = sign(exp)
    } catch {
        return false
    }
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    if (!crypto.timingSafeEqual(a, b)) return false
    return Date.now() < Number(exp)
}
