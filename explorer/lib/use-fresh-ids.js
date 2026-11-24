'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextFreshState } from '@/lib/fresh-ids'

// Layout effect so the class lands before paint (no one-frame flash of the new
// row at full opacity); plain effect on the server to avoid the SSR warning.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export const FRESH_CLEAR_MS = 1500
const EMPTY = new Set()

// Returns a Set of ids that just arrived on the live list.
// `dataKey` must identify the query the CURRENT `ids` belong to (with SWR's
// keepPreviousData, stale rows still carry the previous key), and `currentKey`
// the query now requested: while they differ the rows are placeholders and are
// ignored. The set is cleared ~1.5s after the last arrival so re-renders never
// replay the animation.
export default function useFreshIds(ids, dataKey, currentKey, page) {
    const state = useRef(null)
    const timer = useRef(null)
    const [fresh, setFresh] = useState(EMPTY)

    useIsoLayoutEffect(() => {
        if (!ids || dataKey == null || dataKey !== currentKey) return
        const reseeded = !state.current || state.current.key !== dataKey
        const next = nextFreshState(state.current, { key: dataKey, ids, page })
        state.current = { key: next.key, seen: next.seen }
        if (reseeded) {
            clearTimeout(timer.current)
            timer.current = null
            setFresh(EMPTY)
        }
        if (next.fresh.length === 0) return
        setFresh((prev) => new Set([...prev, ...next.fresh]))
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            timer.current = null
            setFresh(EMPTY)
        }, FRESH_CLEAR_MS)
    }, [ids, dataKey, currentKey, page])

    useEffect(() => () => clearTimeout(timer.current), [])

    return fresh
}
