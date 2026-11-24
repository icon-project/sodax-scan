// Browser-side theme runtime, used by the picker. The first paint is handled by
// the inline script (lib/theme-script.js); this module only reacts to changes.
import { STORAGE_KEY, DARK_QUERY, REDUCED_MOTION_QUERY, SWITCH_CLASS, SWITCH_MS, applyTheme, normalizePref, readStoredPref, writeStoredPref } from './theme'

function themeMeta() {
    return document.querySelector('meta[name="theme-color"]')
}

function safeStorage() {
    try {
        return window.localStorage
    } catch {
        return null
    }
}

export function currentPref() {
    return normalizePref(document.documentElement.dataset.themePref)
}

export function readPref() {
    const storage = safeStorage()
    return storage ? readStoredPref(storage) : currentPref()
}

// Apply a preference to <html>. With `animate` the change is a short colour
// cross-fade (class on <html> for SWITCH_MS, applied on the next frame); never
// under prefers-reduced-motion, and callers pass animate:false for the initial
// sync so the first paint stays final.
export function applyPref(pref, { animate = false } = {}) {
    const root = document.documentElement
    const systemDark = window.matchMedia(DARK_QUERY).matches
    const apply = () => applyTheme(root, pref, systemDark, themeMeta())
    if (!animate || window.matchMedia(REDUCED_MOTION_QUERY).matches) return apply()
    root.classList.add(SWITCH_CLASS)
    requestAnimationFrame(apply)
    clearTimeout(applyPref.timer)
    applyPref.timer = setTimeout(() => root.classList.remove(SWITCH_CLASS), SWITCH_MS)
}

// User picked a preference: persist (System removes the key) and cross-fade.
export function choosePref(pref) {
    const p = normalizePref(pref)
    const storage = safeStorage()
    if (storage) writeStoredPref(storage, p)
    applyPref(p, { animate: true })
    return p
}

// Live listeners: follow the OS while the preference is System (cross-fade, it is
// a visible switch), and mirror a change made in another tab. `onPref` receives
// the new preference when another tab changes it. Returns a cleanup function.
export function watchTheme(onPref) {
    const mq = window.matchMedia(DARK_QUERY)
    const onSystemChange = () => {
        if (currentPref() === 'system') applyPref('system', { animate: true })
    }
    const onStorage = (e) => {
        if (e.key !== null && e.key !== STORAGE_KEY) return
        const p = readPref()
        applyPref(p)
        onPref(p)
    }
    // Safari < 14 only has addListener.
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange)
    else mq.addListener(onSystemChange)
    window.addEventListener('storage', onStorage)
    return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', onSystemChange)
        else mq.removeListener(onSystemChange)
        window.removeEventListener('storage', onStorage)
    }
}
