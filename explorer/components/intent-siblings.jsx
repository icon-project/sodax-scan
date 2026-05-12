'use client'

import { useEffect, useState } from 'react'
import MessageList from './message-list'

const POLL_INTERVAL_MS = 30_000
const YOUNG_WINDOW_MS = 5 * 60_000

/**
 * Renders the "Related intent messages" section on a message detail page.
 *
 * Behavior:
 *   - Always renders a heading + either the sibling list or an empty placeholder.
 *   - If the parent message is younger than 5 minutes (based on its created_at),
 *     silently re-fetches the sibling list every 30s in case the indexer has
 *     picked up newly-arrived siblings. Stops polling once the 5-minute window
 *     closes for the parent message.
 *   - Shows a small status line ("Last checked Xs ago • next check in Ys")
 *     while polling is active.
 */
export default function IntentSiblings({
    initialSiblings,
    meta,
    intentTxHash,
    currentMessageId,
    parentCreatedAtSec,
}) {
    const [siblings, setSiblings] = useState(initialSiblings ?? [])
    // `now` is bumped every second so the status line counters re-render.
    const [now, setNow] = useState(() => Date.now())
    const [lastCheckedAt, setLastCheckedAt] = useState(null)
    const [nextCheckAt, setNextCheckAt] = useState(null)

    const createdAtMs = (parentCreatedAtSec ?? 0) * 1000
    const isYoung = createdAtMs > 0 && now - createdAtMs < YOUNG_WINDOW_MS

    useEffect(() => {
        // Only set up polling if the message is currently within the young window.
        // We re-evaluate on each tick and stop ourselves once the window closes.
        if (!intentTxHash || createdAtMs === 0) return

        let cancelled = false

        async function fetchSiblings() {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BASE_API_URL}/search?value=${intentTxHash}`,
                    { cache: 'no-store' },
                )
                if (!res.ok) return
                const json = await res.json()
                if (cancelled) return
                const filtered = (json.data || []).filter((m) => m.id !== currentMessageId)
                setSiblings(filtered)
                setLastCheckedAt(Date.now())
            } catch {
                // Silent: keep prior state if a refresh fails.
            }
        }

        function scheduleNext() {
            if (cancelled) return
            if (Date.now() - createdAtMs >= YOUNG_WINDOW_MS) {
                setNextCheckAt(null)
                return
            }
            setNextCheckAt(Date.now() + POLL_INTERVAL_MS)
            timeoutId = setTimeout(async () => {
                await fetchSiblings()
                scheduleNext()
            }, POLL_INTERVAL_MS)
        }

        let timeoutId
        if (Date.now() - createdAtMs < YOUNG_WINDOW_MS) {
            scheduleNext()
        }

        return () => {
            cancelled = true
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [intentTxHash, currentMessageId, createdAtMs])

    // Ticker for the status-line counters.
    useEffect(() => {
        if (!isYoung) return
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [isYoung])

    const lastCheckedSecAgo = lastCheckedAt ? Math.max(0, Math.floor((now - lastCheckedAt) / 1000)) : null
    const nextCheckInSec = nextCheckAt ? Math.max(0, Math.ceil((nextCheckAt - now) / 1000)) : null

    return (
        <div className="mt-8">
            <h2 className="px-2 xl:px-6 py-3 text-xl font-medium uppercase bg-gray-50">
                Related intent messages{siblings.length > 0 ? ` (${siblings.length})` : ''}
            </h2>
            {siblings.length > 0 ? (
                <MessageList data={siblings} meta={meta} />
            ) : (
                <div className="px-2 xl:px-6 py-6 bg-white border-b text-sm text-gray-600">
                    No related intent messages yet.
                </div>
            )}
            {isYoung && (
                <div className="px-2 xl:px-6 py-2 text-xs text-gray-500">
                    {lastCheckedSecAgo !== null
                        ? `Last checked ${lastCheckedSecAgo}s ago`
                        : 'Watching for new siblings'}
                    {nextCheckInSec !== null ? ` • next check in ${nextCheckInSec}s` : ''}
                </div>
            )}
        </div>
    )
}
