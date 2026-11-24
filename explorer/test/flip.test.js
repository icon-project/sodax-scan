import { describe, it, expect } from 'vitest'
import { flipDeltas, flipTiming } from '../lib/flip'

const m = (o) => new Map(Object.entries(o))

describe('flipDeltas', () => {
    it('glides existing rows by the inserted height', () => {
        const prev = m({ a: 0, b: 52 })
        const next = m({ n: 0, a: 52, b: 104 })
        expect(flipDeltas(prev, next, new Set(['n']))).toEqual([
            { id: 'a', delta: -52 },
            { id: 'b', delta: -52 }
        ])
    })
    it('handles several inserted rows with one shift', () => {
        const prev = m({ a: 0 })
        const next = m({ x: 0, y: 52, z: 104, a: 156 })
        expect(flipDeltas(prev, next, new Set(['x', 'y', 'z']))).toEqual([{ id: 'a', delta: -156 }])
    })
    it('does nothing without fresh ids (first load, page change)', () => {
        expect(flipDeltas(null, m({ a: 0 }), new Set(['a']))).toEqual([])
        expect(flipDeltas(m({ a: 0 }), m({ b: 0 }), new Set())).toEqual([])
    })
    it('does nothing when the fresh ids are not newly inserted', () => {
        expect(flipDeltas(m({ a: 0, b: 52 }), m({ a: 52, b: 104 }), new Set(['zzz']))).toEqual([])
    })
    it('ignores a wholesale replacement', () => {
        expect(flipDeltas(m({ a: 0 }), m({ n: 0 }), new Set(['n']))).toEqual([])
    })
    it('skips rows that did not move', () => {
        expect(flipDeltas(m({ a: 0, b: 52 }), m({ n: 0, a: 0, b: 104 }), new Set(['n']))).toEqual([{ id: 'b', delta: -52 }])
    })
})

describe('flipTiming', () => {
    it('a is 320ms, b is 420ms with a softer curve', () => {
        expect(flipTiming('a').duration).toBe(320)
        expect(flipTiming(undefined).duration).toBe(320)
        expect(flipTiming('b')).toEqual({ duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' })
    })
})
