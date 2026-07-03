'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import Render from '@/lib/render'

// Seconds to wait after a re-submit before re-checking on-chain status, and how
// many times to auto-recheck while still pending before backing off. A
// re-submit triggers a real on-chain transaction, so the first result won't be
// instant — we count down visibly, then poll the public message endpoint.
const RECHECK_SECONDS = 20
const MAX_ATTEMPTS = 6

const AdminDetailContext = createContext(null)
export const useAdminDetail = () => useContext(AdminDetailContext)

export function AdminDetailProvider({ initialStatus, messageId, chainId, txHash, children }) {
    const [status, setStatus] = useState(initialStatus)
    const [phase, setPhase] = useState('idle') // idle | submitting | countdown | checking
    const [secondsLeft, setSecondsLeft] = useState(0)
    const [error, setError] = useState('')
    const attemptsRef = useRef(0)

    const isPending = typeof status === 'string' && status.toLowerCase() === 'pending'

    function startCountdown() {
        attemptsRef.current += 1
        setSecondsLeft(RECHECK_SECONDS)
        setPhase('countdown')
    }

    async function checkStatus() {
        setPhase('checking')
        let newStatus
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_API_URL}/messages/${messageId}`, { cache: 'no-store' })
            const json = await res.json()
            newStatus = json?.data?.[0]?.status
            if (newStatus) setStatus(newStatus)
        } catch {
            // Treat a failed check as "still pending" and let the loop retry.
        }
        const stillPending = !newStatus || newStatus.toLowerCase() === 'pending'
        if (!stillPending || attemptsRef.current >= MAX_ATTEMPTS) {
            setPhase('idle')
            return
        }
        startCountdown()
    }

    async function startResubmit() {
        setError('')
        setPhase('submitting')
        try {
            const res = await fetch('/api/admin/resubmit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chain_id: chainId, tx_hash: txHash })
            })
            if (!res.ok) {
                setError(res.status === 401 ? 'Session expired — re-enter debug mode.' : 'Re-submit failed. Try again.')
                setPhase('idle')
                return
            }
        } catch {
            setError('Re-submit failed. Try again.')
            setPhase('idle')
            return
        }
        attemptsRef.current = 0
        startCountdown()
    }

    // Countdown ticker. When it reaches zero, run the status check.
    useEffect(() => {
        if (phase !== 'countdown') return
        if (secondsLeft <= 0) {
            checkStatus()
            return
        }
        const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, secondsLeft])

    const value = { status, phase, secondsLeft, error, isPending, startResubmit, attempts: attemptsRef.current, maxAttempts: MAX_ATTEMPTS }
    return <AdminDetailContext.Provider value={value}>{children}</AdminDetailContext.Provider>
}

// Prominent re-submit banner (detail page). Hides itself once the message is no
// longer pending.
export function ResubmitBanner() {
    const ctx = useAdminDetail()
    if (!ctx || !ctx.isPending) return null
    const { phase, startResubmit, error, attempts, maxAttempts } = ctx
    const busy = phase !== 'idle'
    const exhausted = attempts >= maxAttempts && phase === 'idle'

    return (
        <div className="mb-3 flex items-center justify-between gap-4 bg-soda-clicked border border-soda rounded-xl px-4 py-3">
            <div className="text-sm text-espresso">
                <span className="font-semibold">This message is pending.</span>{' '}
                {exhausted ? 'Still pending after several checks — you can re-submit again.' : 'Re-submit its source transaction to the relay.'}
                {error ? <span className="block text-cherry mt-1">{error}</span> : null}
            </div>
            <button
                onClick={startResubmit}
                disabled={busy}
                className="shrink-0 uppercase text-sm font-medium tracking-wide rounded-full px-5 py-2.5 transition-colors disabled:opacity-60 bg-soda hover:bg-soda-bright text-espresso"
            >
                {busy ? 'Working…' : 'Re-submit to relay'}
            </button>
        </div>
    )
}

// Status cell content: the pill, plus live countdown/checking feedback while a
// re-submit is being verified on-chain.
export function DetailStatus() {
    const ctx = useAdminDetail()
    if (!ctx) return null
    const { status, phase, secondsLeft } = ctx
    return (
        <div>
            {Render.renderMessageStatus(status)}
            {phase === 'submitting' && <div className="text-xs text-clay-dark mt-1">Submitting to relay…</div>}
            {phase === 'countdown' && <div className="text-xs text-clay-dark mt-1">Re-checking on-chain status in {secondsLeft}s…</div>}
            {phase === 'checking' && <div className="text-xs text-clay-dark mt-1">Checking on-chain status…</div>}
        </div>
    )
}
