'use client'
import { useEffect, useRef, useState } from 'react'
import { prefForKey } from '@/lib/theme'
import { choosePref, readPref, watchTheme } from '@/lib/theme-client'

// Light / Dark / System segmented pill (docs/design-audit/dark-mode-spec.md 3).
// The thumb position and the active icon colour are pure CSS on
// html[data-theme-pref] (set by the inline head script), so they are right at
// first paint with no JS; React state only drives aria-checked / roving tabindex
// after mount. Styles live in globals.css (.tp-*).

const ICON_PROPS = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false }

function SunIcon({ className }) {
    return (
        <svg {...ICON_PROPS} className={className}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41" />
        </svg>
    )
}

function MoonIcon({ className }) {
    return (
        <svg {...ICON_PROPS} className={className}>
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
    )
}

function MonitorIcon({ className }) {
    return (
        <svg {...ICON_PROPS} className={className}>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8 M12 16v4" />
        </svg>
    )
}

const OPTIONS = [
    { value: 'light', label: 'Light', Icon: SunIcon },
    { value: 'dark', label: 'Dark', Icon: MoonIcon },
    { value: 'system', label: 'System', Icon: MonitorIcon }
]

export default function ThemePicker() {
    // Server and first client render: System (matches the CSS default). The real
    // preference is read after mount, so there is no hydration mismatch.
    const [pref, setPref] = useState('system')
    const [popped, setPopped] = useState(null)
    const buttons = useRef({})

    useEffect(() => {
        setPref(readPref())
        return watchTheme(setPref)
    }, [])

    function select(value, { focus = false } = {}) {
        setPref(choosePref(value))
        setPopped(value)
        if (focus) buttons.current[value]?.focus()
    }

    function onKeyDown(e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return
        const next = prefForKey(pref, e.key)
        if (!next) return
        e.preventDefault()
        select(next, { focus: true })
    }

    return (
        <div className="tp-root" role="radiogroup" aria-label="Theme" onKeyDown={onKeyDown}>
            <span className="tp-thumb" aria-hidden="true" />
            {OPTIONS.map(({ value, label, Icon }) => {
                const checked = pref === value
                return (
                    <button
                        key={value}
                        ref={(el) => (buttons.current[value] = el)}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={label}
                        title={label}
                        tabIndex={checked ? 0 : -1}
                        data-value={value}
                        className="tp-seg"
                        onClick={() => select(value)}
                    >
                        <Icon className={`tp-icon${popped === value ? ' icon-pop' : ''}${popped === value && value === 'dark' ? ' tp-moon-in' : ''}`} />
                    </button>
                )
            })}
        </div>
    )
}
