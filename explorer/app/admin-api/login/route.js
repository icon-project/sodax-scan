import { NextResponse } from 'next/server'
import { checkPassword, makeToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
    const ip = clientIp(request)
    // Throttle guessing: 5 attempts / minute / IP.
    if (!rateLimit(`login:${ip}`, { max: 5, windowMs: 60_000 })) {
        return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    let body
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    }

    if (!checkPassword(body?.password)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, makeToken(), {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE
    })
    return res
}
