import { describe, it, expect } from 'vitest'
import timeAgo from '../lib/time-ago'

const ago = (msBack) => timeAgo(Date.now() - msBack)

describe('timeAgo grammar', () => {
    it('uses the singular for exactly one unit', () => {
        expect(ago(1000 * 60)).toBe('1 minute')
        expect(ago(1000 * 60 * 60)).toBe('1 hour')
        expect(ago(1000 * 60 * 60 * 24)).toBe('1 day')
        expect(ago(1000)).toMatch(/^1 second$/)
    })

    it('uses the plural otherwise', () => {
        expect(ago(1000 * 60 * 5)).toBe('5 minutes')
        expect(ago(1000 * 60 * 60 * 3)).toBe('3 hours')
        expect(ago(1000 * 60 * 60 * 24 * 2)).toBe('2 days')
        expect(ago(1000 * 30)).toBe('30 seconds')
    })

    it('returns an empty string for a missing date', () => {
        expect(timeAgo(0)).toBe('')
        expect(timeAgo(undefined)).toBe('')
    })
})
