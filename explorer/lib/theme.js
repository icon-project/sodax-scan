// Theme logic shared by the inline no-flash script (lib/theme-script.js), the
// picker (components/theme-picker.js) and the tests. Everything here is pure or
// takes its environment as an argument, so it never touches globals directly.
//
// Preference: 'light' | 'dark' | 'system'. Stored in localStorage under
// STORAGE_KEY as 'light' or 'dark'; a missing key means 'system' (so first-time
// visitors and people who chose System store nothing).

export const STORAGE_KEY = 'sodax-scan-theme'
export const PREFS = ['light', 'dark', 'system']
export const DARK_QUERY = '(prefers-color-scheme: dark)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
// Header band colours (the browser chrome tint), kept in sync with globals.css.
export const THEME_COLORS = { light: '#F8F3F3', dark: '#1A1212' }
// Cross-fade window for a user-initiated switch (3.10 of the spec).
export const SWITCH_CLASS = 'theme-switching'
export const SWITCH_MS = 220

// Anything that is not 'light' or 'dark' is System.
export function normalizePref(value) {
    return value === 'light' || value === 'dark' ? value : 'system'
}

// `systemDark` is the current prefers-color-scheme: dark match.
export function resolveTheme(pref, systemDark) {
    const p = normalizePref(pref)
    return p === 'dark' || (p === 'system' && Boolean(systemDark)) ? 'dark' : 'light'
}

// Storage access can throw (private mode, blocked site data): fall back to System.
export function readStoredPref(storage) {
    try {
        return normalizePref(storage.getItem(STORAGE_KEY))
    } catch {
        return 'system'
    }
}

// System removes the key. Returns false when storage is unavailable (the choice
// then only lasts for the current page).
export function writeStoredPref(storage, pref) {
    try {
        const p = normalizePref(pref)
        if (p === 'system') storage.removeItem(STORAGE_KEY)
        else storage.setItem(STORAGE_KEY, p)
        return true
    } catch {
        return false
    }
}

// Radiogroup keyboard model: arrows move and select (wrapping), Home/End jump.
// Returns the pref to move to, or null when the key is not handled.
export function prefForKey(current, key) {
    const i = Math.max(0, PREFS.indexOf(normalizePref(current)))
    const last = PREFS.length - 1
    switch (key) {
        case 'ArrowLeft':
        case 'ArrowUp':
            return PREFS[i === 0 ? last : i - 1]
        case 'ArrowRight':
        case 'ArrowDown':
            return PREFS[i === last ? 0 : i + 1]
        case 'Home':
            return PREFS[0]
        case 'End':
            return PREFS[last]
        default:
            return null
    }
}

// Writes the resolved theme onto <html> (+ the theme-color meta). `root` is the
// document element, `meta` the <meta name="theme-color"> element or null.
export function applyTheme(root, pref, systemDark, meta = null) {
    const p = normalizePref(pref)
    const theme = resolveTheme(p, systemDark)
    const dark = theme === 'dark'
    root.classList.toggle('dark', dark)
    root.dataset.themePref = p
    root.style.colorScheme = theme
    if (meta) meta.setAttribute('content', THEME_COLORS[theme])
    return theme
}
