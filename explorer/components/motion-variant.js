'use client'
import { useEffect } from 'react'

// TEMPORARY: A/B toggle for choosing the new-row motion variant. Reads
// ?motion=a|b once on the client and sets <html data-motion>; CSS
// (app/globals.css) and the FLIP glide (lib/flip.js) key off it. Default a.
// Remove this component (and the b rules) once a variant is chosen.
export default function MotionVariant() {
    useEffect(() => {
        const v = new URLSearchParams(window.location.search).get('motion')
        document.documentElement.dataset.motion = v === 'b' ? 'b' : 'a'
    }, [])
    return null
}
