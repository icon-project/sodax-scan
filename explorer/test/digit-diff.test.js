import { describe, it, expect } from 'vitest'
import { changedMask } from '../lib/digit-diff'

const marked = (prev, next) => changedMask(prev, next).map((c, i) => (c ? next[i] : '_')).join('')

describe('changedMask', () => {
    it('flags only the last digit on +1', () => {
        expect(marked('1,125,923', '1,125,924')).toBe('________4')
    })
    it('flags carried digits but not the separators between them', () => {
        expect(marked('1,125,999', '1,126,002')).toBe('____6_002')
    })
    it('aligns from the right when the number grows', () => {
        expect(marked('99,999', '100,000')).toBe('100_000')
        expect(changedMask('999', '1,000')).toEqual([true, true, true, true, true])
    })
    it('flags nothing when unchanged or without a previous value', () => {
        expect(changedMask('12', '12')).toEqual([false, false])
        expect(changedMask(null, '12')).toEqual([false, false])
    })
})
