import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/admin'
import { submitTx } from '@/lib/relay'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
    // Gate on the admin session cookie first — no valid session, no relay call.
    const token = cookies().get(COOKIE_NAME)?.value
    if (!verifyToken(token)) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const ip = clientIp(request)
    if (!rateLimit(`resubmit:${ip}`, { max: 20, windowMs: 60_000 })) {
        return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    let body
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    }

    const chainId = body?.chain_id
    const txHash = body?.tx_hash
    // Light validation — chain id is numeric-ish, hash is a bounded token.
    if (!chainId || !txHash || typeof txHash !== 'string' || txHash.length > 200 || !/^[a-zA-Z0-9]+$/.test(String(chainId))) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    }

    let result
    try {
        result = await submitTx(chainId, txHash)
    } catch (e) {
        // Relay unreachable / network error — surface a clean gateway error
        // instead of a 500 stack trace.
        return NextResponse.json({ ok: false, error: 'relay_unreachable' }, { status: 502 })
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
