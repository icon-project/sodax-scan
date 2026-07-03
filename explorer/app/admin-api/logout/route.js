import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0
    })
    return res
}
