'use client'
import { useEffect, useRef, useState } from 'react'

const COUNT_UP_MS = 700
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Animated total. First real value counts up from 0 (700ms, easeOutCubic);
// later increases land with a small keyed "tick". Reduced motion: set instantly.
// Styling (size, colour, tabular-nums) comes from the parent.
export default function TotalCounter({ value }) {
    const [display, setDisplay] = useState(0)
    const [tick, setTick] = useState(0)
    const first = useRef(true)
    const last = useRef(0)
    const raf = useRef(null)

    useEffect(() => {
        if (typeof value !== 'number') return
        cancelAnimationFrame(raf.current)
        if (first.current) {
            first.current = false
            last.current = value
            if (prefersReducedMotion() || value === 0) {
                setDisplay(value)
                return
            }
            const start = performance.now()
            const frame = (now) => {
                const t = Math.min((now - start) / COUNT_UP_MS, 1)
                setDisplay(Math.round(value * easeOutCubic(t)))
                if (t < 1) raf.current = requestAnimationFrame(frame)
            }
            raf.current = requestAnimationFrame(frame)
            return
        }
        const increased = value > last.current
        last.current = value
        setDisplay(value)
        if (increased && !prefersReducedMotion()) setTick((n) => n + 1)
    }, [value])

    useEffect(() => () => cancelAnimationFrame(raf.current), [])

    return (
        <span key={tick} className={tick ? 'tick' : undefined}>
            {display.toLocaleString('en-US')}
        </span>
    )
}
