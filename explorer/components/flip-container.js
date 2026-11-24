'use client'
import { useLayoutEffect, useEffect, useRef } from 'react'
import { flipDeltas, flipTiming } from '@/lib/flip'

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function measure(root) {
    const map = new Map()
    root.querySelectorAll('[data-flip-id]').forEach((el) => {
        if (el.offsetParent === null) return // display:none (the other breakpoint's markup)
        map.set(el.getAttribute('data-flip-id'), el.offsetTop)
    })
    return map
}

// Wraps the live list and glides the rows below a freshly inserted row (FLIP:
// transform only, run before paint). Rows carry data-flip-id. `ids` is the
// ordered id list; `freshIds` the ids flagged as just arrived (useFreshIds).
// It only runs when a flagged id is newly inserted, so first load, page and
// filter changes (which reseed freshIds) never glide. Reduced motion: no glide.
export default function FlipContainer({ ids, freshIds, className, children }) {
    const ref = useRef(null)
    const idsKey = ids ? ids.join(',') : ''
    const before = useRef(null) // positions before the latest data change
    const after = useRef(null) // positions after the latest data change
    const lastKey = useRef(null)
    const handled = useRef(null)

    useIsoLayoutEffect(() => {
        const root = ref.current
        if (!root) return
        const cur = measure(root)
        if (lastKey.current !== idsKey) {
            before.current = after.current
            after.current = cur
            lastKey.current = idsKey
            handled.current = null
        }
        // freshIds arrives one (pre-paint) render after the data does.
        if (!freshIds || freshIds.size === 0 || handled.current === freshIds) return
        const deltas = flipDeltas(before.current, cur, new Set([...freshIds].map(String)))
        if (deltas.length === 0) return
        handled.current = freshIds
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
        const { duration, easing } = flipTiming(document.documentElement.dataset.motion)
        const byId = new Map()
        root.querySelectorAll('[data-flip-id]').forEach((el) => {
            if (el.offsetParent !== null) byId.set(el.getAttribute('data-flip-id'), el)
        })
        for (const { id, delta } of deltas) {
            const el = byId.get(id)
            if (!el?.animate) continue
            el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], { duration, easing })
        }
    }, [idsKey, freshIds])

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    )
}
