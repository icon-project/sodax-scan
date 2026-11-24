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
        <span className="relative inline-flex items-center shrink-0">
            <button
                type="button"
                onClick={copy}
                aria-label={label}
                className="inline-flex items-center justify-center w-8 h-8 max-md:w-11 max-md:h-11 rounded-small text-fg-muted [transition:transform_100ms_ease-out,color_150ms_ease-out,background-color_150ms_ease-out] active:scale-95 hover:bg-hover hover:text-fg active:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
            >
                {copied ? <CheckIcon width={18} height={18} className="icon-pop text-trend-up" aria-hidden="true" /> : <ClipboardDocumentIcon width={18} height={18} aria-hidden="true" />}
            </button>
            {/* Out of flow (absolute) so showing it never moves the button or re-wraps the hash.
                Stays mounted and fades out on revert (150ms). Visual only; the sr-only
                live region below carries the announcement. */}
            <span
                aria-hidden="true"
                className={`absolute right-0 bottom-full mb-1 z-10 rounded-small bg-espresso px-2 py-1 text-xs text-white whitespace-nowrap pointer-events-none transition-opacity duration-150 ease-out ${copied ? 'opacity-100' : 'opacity-0'}`}
            >
                Copied
            </span>
            <span role="status" aria-live="polite" className="sr-only">
                {copied ? 'Copied' : ''}
            </span>
        </span>
    )
}
