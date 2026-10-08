import { describe, it, expect } from 'vitest'
import Render from '../lib/render'
import helper from '../lib/helper'
import { depositSweepComplete, withdrawalReleased, legacyNonMpc } from './fixtures'

// renderMessageStatus returns a React element (plain object); inspect its props
// directly without mounting a DOM.
const cls = (el) => el.props.className
const text = (el) => el.props.children

describe('renderMessageStatus (R4)', () => {
    it('renders the five legacy pills with unchanged colors', () => {
        expect(cls(Render.renderMessageStatus('failed'))).toContain('bg-cherry')
        expect(cls(Render.renderMessageStatus('rollbacked'))).toContain('bg-soda-bright')
        expect(cls(Render.renderMessageStatus('pending'))).toContain('bg-cherry-grey')
        expect(cls(Render.renderMessageStatus('executed'))).toContain('bg-green-200')
        expect(cls(Render.renderMessageStatus('delivered'))).toContain('bg-blue-200')
    })

    it('executed (the MPC terminal status) renders the legacy executed pill', () => {
        const el = Render.renderMessageStatus('executed')
        expect(cls(el)).toContain('bg-green-200')
        expect(text(el)).toBe('executed')
    })

    it('renders the one new MPC status pill (attested = amber)', () => {
        const el = Render.renderMessageStatus('attested')
        expect(cls(el)).toContain('bg-amber-200')
        expect(text(el)).toBe('attested')
    })

    it('has a pill (non-fallback) for every STATUS_FILTERS entry — no drift', () => {
        for (const status of helper.STATUS_FILTERS) {
            const el = Render.renderMessageStatus(status)
            expect(cls(el)).not.toContain('bg-gray-200')
        }
    })

    it('removed status values (routed/hub-burned/minted) and legs (swept/released) fall through to the fallback', () => {
        for (const s of ['routed', 'hub-burned', 'minted', 'swept', 'released']) {
            expect(cls(Render.renderMessageStatus(s))).toContain('bg-gray-200')
        }
    })

    it('is case-insensitive on the attested pill', () => {
        expect(cls(Render.renderMessageStatus('ATTESTED'))).toContain('bg-amber-200')
        expect(cls(Render.renderMessageStatus('Attested'))).toContain('bg-amber-200')
    })

    it('AC-R13/R14 negative: a mismatched status literal renders the fallback, not the pill', () => {
        expect(cls(Render.renderMessageStatus('attestted'))).toContain('bg-gray-200')
        expect(cls(Render.renderMessageStatus('hub_burned'))).toContain('bg-gray-200')
    })

    it('never returns undefined — unknown status renders the fallback badge', () => {
        const el = Render.renderMessageStatus('some-unexpected-status')
        expect(el).toBeDefined()
        expect(cls(el)).toContain('bg-gray-200')
        expect(text(el)).toBe('some-unexpected-status')
    })

    it('null/undefined status renders the fallback badge, not a blank pill', () => {
        for (const bad of [null, undefined, '']) {
            const el = Render.renderMessageStatus(bad)
            expect(el).toBeDefined()
            expect(cls(el)).toContain('bg-gray-200')
            expect(text(el)).toBe('unknown')
        }
    })
})

describe('renderSerialNo — list/detail MPC marker (list-view indicator)', () => {
    it('an MPC list row exposes the MPC marker', () => {
        // completed MPC row: status=executed, sn null, dest on an MPC chain
        expect(helper.isMpcTransaction(depositSweepComplete)).toBe(true)
        const el = Render.renderSerialNo(depositSweepComplete)
        expect(text(el)).toBe('MPC')
    })

    it('a withdrawal (src Sonic 146, dest MPC) also shows the MPC marker', () => {
        const el = Render.renderSerialNo(withdrawalReleased)
        expect(text(el)).toBe('MPC')
    })

    it('a legacy row does NOT show the MPC marker (sn shown as-is)', () => {
        expect(helper.isMpcTransaction(legacyNonMpc)).toBe(false)
        // legacyNonMpc.sn = 42 → returned verbatim, not a badge
        expect(Render.renderSerialNo(legacyNonMpc)).toBe(legacyNonMpc.sn)
    })

    it('a legacy row with NULL sn keeps the hub-only badge (unchanged)', () => {
        const el = Render.renderSerialNo({ ...legacyNonMpc, sn: null })
        expect(text(el)).toBe('hub-only')
    })
})

describe('renderHashLink — bare-hash chains (xrp 66, cardano 1815)', () => {
    // Full-mode element tree: <div>[networkImg, <div>[<Link href><span data-hash/></Link>, copy]</div>]</div>
    const linkOf = (el) => el.props.children[1].props.children[0]
    const hash = '0x2661173783960521631227e416e1c3173375031d84a2558700ba2963f06a981e'
    const bare = hash.slice(2)

    it('strips 0x from the cardanoscan link and displayed hash', () => {
        const link = linkOf(Render.renderHashLink('https://cardanoscan.io/transaction/', '1815', hash, true))
        expect(link.props.href).toBe(`https://cardanoscan.io/transaction/${bare}`)
        expect(link.props.children.props['data-hash']).toBe(bare)
    })

    it('keeps the xrpscan bare-hash behaviour', () => {
        const link = linkOf(Render.renderHashLink('https://xrpscan.com/tx/', '66', hash, true))
        expect(link.props.href).toBe(`https://xrpscan.com/tx/${bare}`)
    })

    it('leaves 0x on non-bare-hash chains', () => {
        const link = linkOf(Render.renderHashLink('https://sonicscan.org/tx/', '146', hash, true))
        expect(link.props.href).toBe(`https://sonicscan.org/tx/${hash}`)
    })
})
