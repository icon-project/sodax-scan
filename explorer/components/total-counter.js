'use client'
import { useEffect, useRef, useState } from 'react'
import { changedMask } from '@/lib/digit-diff'

const COUNT_UP_MS = 700
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Animated total. First real value counts up from 0 (700ms, easeOutCubic);
// later increases tick only the digits that changed (unchanged digits keep their
// key and stay still). Reduced motion: set instantly.
// Styling (size, colour, tabular-nums) comes from the parent.
export default function TotalCounter({ value }) {
    const [display, setDisplay] = useState(0)
    const [tickFrom, setTickFrom] = useState(null) // previous text, set on an increase
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
        const prevText = last.current.toLocaleString('en-US')
        last.current = value
        setDisplay(value)
        if (increased && !prefersReducedMotion()) setTickFrom(prevText)
    }, [value])

    useEffect(() => () => cancelAnimationFrame(raf.current), [])

    const text = display.toLocaleString('en-US')
    const mask = changedMask(tickFrom, text)
    return (
        <>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
                {[...text].map((ch, i) => (
                    <span key={`${text.length - i}:${ch}`} className={mask[i] ? 'tick' : undefined}>
                        {ch}
                    </span>
                ))}
            </span>
        </>
    )
}
