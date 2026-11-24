import { describe, it, expect, vi } from 'vitest'
import vm from 'node:vm'
import { STORAGE_KEY, THEME_COLORS, normalizePref, resolveTheme, readStoredPref, writeStoredPref, prefForKey, applyTheme } from '../lib/theme'
import { THEME_SCRIPT } from '../lib/theme-script'

function fakeStorage(initial = {}, { throws = false } = {}) {
    const data = { ...initial }
    const guard = () => {
        if (throws) throw new Error('blocked')
    }
    return {
        getItem: (k) => (guard(), k in data ? data[k] : null),
        setItem: (k, v) => (guard(), void (data[k] = String(v))),
        removeItem: (k) => (guard(), void delete data[k]),
        data
    }
}

function fakeRoot() {
    const classes = new Set()
    return {
        classes,
        dataset: {},
        style: {},
        classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) }
    }
}

describe('normalizePref', () => {
    it('keeps light/dark and treats everything else as system', () => {
        expect(normalizePref('light')).toBe('light')
        expect(normalizePref('dark')).toBe('dark')
        for (const v of ['system', '', null, undefined, 'blue', 'DARK']) expect(normalizePref(v)).toBe('system')
    })
})

describe('resolveTheme', () => {
    it('explicit prefs ignore the OS', () => {
        expect(resolveTheme('light', true)).toBe('light')
        expect(resolveTheme('dark', false)).toBe('dark')
    })
    it('system follows the OS', () => {
        expect(resolveTheme('system', true)).toBe('dark')
        expect(resolveTheme('system', false)).toBe('light')
        expect(resolveTheme(null, true)).toBe('dark')
    })
})

describe('storage', () => {
    it('a missing key is system', () => {
        expect(readStoredPref(fakeStorage())).toBe('system')
    })
    it('round-trips light and dark', () => {
        const s = fakeStorage()
        expect(writeStoredPref(s, 'dark')).toBe(true)
        expect(s.data[STORAGE_KEY]).toBe('dark')
        expect(readStoredPref(s)).toBe('dark')
        writeStoredPref(s, 'light')
        expect(readStoredPref(s)).toBe('light')
    })
    it('choosing system removes the key', () => {
        const s = fakeStorage({ [STORAGE_KEY]: 'dark' })
        expect(writeStoredPref(s, 'system')).toBe(true)
        expect(STORAGE_KEY in s.data).toBe(false)
    })
    it('garbage stored values read as system', () => {
        expect(readStoredPref(fakeStorage({ [STORAGE_KEY]: 'purple' }))).toBe('system')
    })
    it('never throws when storage is blocked', () => {
        const s = fakeStorage({}, { throws: true })
        expect(readStoredPref(s)).toBe('system')
        expect(writeStoredPref(s, 'dark')).toBe(false)
    })
})

describe('prefForKey (radiogroup keys)', () => {
    it('arrows wrap through light, dark, system', () => {
        expect(prefForKey('light', 'ArrowRight')).toBe('dark')
        expect(prefForKey('dark', 'ArrowDown')).toBe('system')
        expect(prefForKey('system', 'ArrowRight')).toBe('light')
        expect(prefForKey('light', 'ArrowLeft')).toBe('system')
        expect(prefForKey('system', 'ArrowUp')).toBe('dark')
    })
    it('Home/End jump, other keys are ignored', () => {
        expect(prefForKey('dark', 'Home')).toBe('light')
        expect(prefForKey('dark', 'End')).toBe('system')
        expect(prefForKey('dark', 'a')).toBeNull()
        expect(prefForKey('dark', 'Tab')).toBeNull()
    })
})

describe('applyTheme', () => {
    it('writes class, data-theme-pref, color-scheme and the theme-color meta', () => {
        const root = fakeRoot()
        const meta = { content: '', setAttribute: vi.fn((k, v) => (meta.content = v)) }
        expect(applyTheme(root, 'system', true, meta)).toBe('dark')
        expect(root.classes.has('dark')).toBe(true)
        expect(root.dataset.themePref).toBe('system')
        expect(root.style.colorScheme).toBe('dark')
        expect(meta.content).toBe(THEME_COLORS.dark)
        expect(applyTheme(root, 'light', true, meta)).toBe('light')
        expect(root.classes.has('dark')).toBe(false)
        expect(root.style.colorScheme).toBe('light')
        expect(meta.content).toBe(THEME_COLORS.light)
    })
})

// The inline script is a hand-minimised copy of readStoredPref + applyTheme:
// run it in a sandbox and require the same result as the real functions.
describe('THEME_SCRIPT parity with lib/theme.js', () => {
    function runScript(stored, systemDark, { storageThrows = false } = {}) {
        const root = fakeRoot()
        const meta = { content: THEME_COLORS.light, setAttribute: (k, v) => (meta.content = v) }
        const storage = fakeStorage(stored === null ? {} : { [STORAGE_KEY]: stored }, { throws: storageThrows })
        const ctx = {
            localStorage: storage,
            window: { matchMedia: () => ({ matches: systemDark }) },
            document: { documentElement: root, querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? meta : null) }
        }
        vm.runInNewContext(THEME_SCRIPT, ctx)
        return { dark: root.classes.has('dark'), pref: root.dataset.themePref, scheme: root.style.colorScheme, color: meta.content }
    }
    const cases = [
        [null, false],
        [null, true],
        ['light', true],
        ['dark', false],
        ['dark', true],
        ['purple', true]
    ]
    for (const [stored, systemDark] of cases) {
        it(`stored=${stored} systemDark=${systemDark}`, () => {
            const pref = readStoredPref(fakeStorage(stored === null ? {} : { [STORAGE_KEY]: stored }))
            const root = fakeRoot()
            const meta = { setAttribute: (k, v) => (meta.content = v) }
            const theme = applyTheme(root, pref, systemDark, meta)
            expect(runScript(stored, systemDark)).toEqual({ dark: theme === 'dark', pref: root.dataset.themePref, scheme: root.style.colorScheme, color: meta.content })
        })
    }
    it('falls back to system when storage throws', () => {
        expect(runScript('dark', true, { storageThrows: true })).toMatchObject({ pref: 'system', dark: true })
        expect(runScript('dark', false, { storageThrows: true })).toMatchObject({ pref: 'system', dark: false })
    })
})
