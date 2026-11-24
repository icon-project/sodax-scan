import { describe, it, expect } from 'vitest'
import { nextFreshState, MAX_FRESH_BURST, MAX_SEEN } from '../lib/fresh-ids'

const step = (prev, ids, opts = {}) => nextFreshState(prev, { key: 'k1', ids, ...opts })

describe('nextFreshState', () => {
    it('first load seeds and animates nothing', () => {
        const s = step(null, ['a', 'b', 'c'])
        expect(s.fresh).toEqual([])
        expect([...s.seen]).toEqual(['a', 'b', 'c'])
    })

    it('marks newly arrived ids on the same key', () => {
        const s1 = step(null, ['b', 'c'])
        const s2 = step(s1, ['a', 'b', 'c'])
        expect(s2.fresh).toEqual(['a'])
        const s3 = step(s2, ['a', 'b', 'c'])
        expect(s3.fresh).toEqual([])
    })

    it('a key change reseeds silently', () => {
        const s1 = step(null, ['b', 'c'])
        const s2 = nextFreshState(s1, { key: 'k2', ids: ['x', 'y'], page: 1 })
        expect(s2.fresh).toEqual([])
        expect(s2.key).toBe('k2')
        expect(nextFreshState(s2, { key: 'k2', ids: ['z', 'x', 'y'], page: 1 }).fresh).toEqual(['z'])
    })

    it('never animates on page > 1 but keeps tracking', () => {
        const s1 = step(null, ['b'], { page: 2 })
        const s2 = step(s1, ['a', 'b'], { page: 2 })
        expect(s2.fresh).toEqual([])
        expect(s2.seen.has('a')).toBe(true)
    })

    it('skips bursts larger than the cap but allows exactly the cap', () => {
        const s1 = step(null, ['z'])
        const ok = step(s1, ['a', 'b', 'c', 'd', 'e', 'z'])
        expect(MAX_FRESH_BURST).toBe(5)
        expect(ok.fresh).toHaveLength(5)
        const burst = step(s1, ['a', 'b', 'c', 'd', 'e', 'f', 'z'])
        expect(burst.fresh).toEqual([])
        expect(burst.seen.has('f')).toBe(true)
    })

    it('dedupes repeated ids and ignores null ids', () => {
        const s1 = step(null, ['a'])
        const s2 = step(s1, ['n', 'n', null, undefined, 'a'])
        expect(s2.fresh).toEqual(['n'])
    })

    it('does not mutate the previous state', () => {
        const s1 = step(null, ['a'])
        step(s1, ['b', 'a'])
        expect([...s1.seen]).toEqual(['a'])
    })

    it('tolerates missing ids', () => {
        expect(step(null, undefined).fresh).toEqual([])
    })
})

describe('nextFreshState — seen cap', () => {
    it('keeps at most MAX_SEEN ids and still detects a new arrival', () => {
        let st = nextFreshState(null, { key: 'k', ids: [] })
        for (let i = 0; i < MAX_SEEN + 50; i++) st = nextFreshState(st, { key: 'k', ids: [i] })
        expect(st.seen.size).toBeLessThanOrEqual(MAX_SEEN)
        expect(st.seen.has(MAX_SEEN + 49)).toBe(true)
        const next = nextFreshState(st, { key: 'k', ids: ['new'] })
        expect(next.fresh).toEqual(['new'])
    })
})
