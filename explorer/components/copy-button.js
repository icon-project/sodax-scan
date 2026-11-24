'use client'
import { useEffect, useRef, useState } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'

// Copies `value` to the clipboard. 32px hit area (44px on touch widths), clay-dark
// icon that darkens on hover, pressed state, brand focus ring and a brief
// "Copied" confirmation announced politely to screen readers.
export default function CopyButton({ value, label = 'Copy hash' }) {
    const [copied, setCopied] = useState(false)
    const timer = useRef(null)

    useEffect(() => () => clearTimeout(timer.current), [])

    async function copy() {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setCopied(false), 1500)
        } catch {
            // Clipboard unavailable (insecure context / permission): stay silent.
        }
    }

    return (
        <span className="inline-flex items-center shrink-0">
            <button
                type="button"
                onClick={copy}
                aria-label={label}
                className="inline-flex items-center justify-center w-8 h-8 max-md:w-11 max-md:h-11 rounded-small text-clay-dark transition-colors duration-150 hover:bg-almost-white hover:text-espresso active:bg-cream-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cherry-soda"
            >
                {copied ? <CheckIcon width={18} height={18} className="text-success-dark" aria-hidden="true" /> : <ClipboardDocumentIcon width={18} height={18} aria-hidden="true" />}
            </button>
            <span role="status" aria-live="polite" className={copied ? 'text-xs text-espresso ml-1' : 'sr-only'}>
                {copied ? 'Copied' : ''}
            </span>
        </span>
    )
}
