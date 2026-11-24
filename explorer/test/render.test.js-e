import { describe, it, expect } from 'vitest'
import Render from '../lib/render'
import helper from '../lib/helper'
import { depositSweepComplete, withdrawalReleased, legacyNonMpc, SolverMarketPlaceFill } from './fixtures'

// renderMessageStatus returns a React element (plain object); inspect its props
// directly without mounting a DOM.
const cls = (el) => el.props.className
const text = (el) => el.props.children
// Status pill children are [dot, label]; label is sentence-cased.
const label = (el) => el.props.children[1]

describe('renderMessageStatus (R4)', () => {
    it('renders the five legacy pills with brand-token colors', () => {
        expect(cls(Render.renderMessageStatus('failed'))).toContain('bg-error-base')
        expect(cls(Render.renderMessageStatus('rollbacked'))).toContain('bg-error-lighter')
        expect(cls(Render.renderMessageStatus('pending'))).toContain('border-cherry-grey')
        expect(cls(Render.renderMessageStatus('executed'))).toContain('bg-success-base')
        expect(cls(Render.renderMessageStatus('delivered'))).toContain('bg-light-cream')
    })

    it('executed (the MPC terminal status) renders the legacy executed pill', () => {
        const el = Render.renderMessageStatus('executed')
        expect(cls(el)).toContain('bg-success-base')
        expect(label(el)).toBe('Executed')
    })

    it('renders the one new MPC status pill (attested = cream-cherry)', () => {
        const el = Render.renderMessageStatus('attested')
        expect(cls(el)).toContain('bg-cream-cherry')
        expect(label(el)).toBe('Attested')
    })

    it('has a pill (non-fallback) for every STATUS_FILTERS entry — no drift', () => {
        for (const status of helper.STATUS_FILTERS) {
            const el = Render.renderMessageStatus(status)
            expect(cls(el)).not.toContain('bg-cream-white')
        }
    })

    it('removed status values (routed/hub-burned/minted) and legs (swept/released) fall through to the fallback', () => {
        for (const s of ['routed', 'hub-burned', 'minted', 'swept', 'released']) {
            expect(cls(Render.renderMessageStatus(s))).toContain('bg-cream-white')
        }
    })

    it('is case-insensitive on the attested pill', () => {
        expect(cls(Render.renderMessageStatus('ATTESTED'))).toContain('bg-cream-cherry')
        expect(cls(Render.renderMessageStatus('Attested'))).toContain('bg-cream-cherry')
    })

    it('AC-R13/R14 negative: a mismatched status literal renders the fallback, not the pill', () => {
        expect(cls(Render.renderMessageStatus('attestted'))).toContain('bg-cream-white')
        expect(cls(Render.renderMessageStatus('hub_burned'))).toContain('bg-cream-white')
    })

    it('never returns undefined — unknown status renders the fallback badge', () => {
        const el = Render.renderMessageStatus('some-unexpected-status')
        expect(el).toBeDefined()
        expect(cls(el)).toContain('bg-cream-white')
        expect(label(el)).toBe('Some-unexpected-status')
    })

    it('null/undefined status renders the fallback badge, not a blank pill', () => {
        for (const bad of [null, undefined, '']) {
            const el = Render.renderMessageStatus(bad)
            expect(el).toBeDefined()
            expect(cls(el)).toContain('bg-cream-white')
            expect(label(el)).toBe('Unknown')
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

describe('SolverMarketPlaceFill rows', () => {
    it('shows the SolverMarketPlaceFill badge instead of hub-only', () => {
        expect(text(Render.renderSerialNo(SolverMarketPlaceFill))).toBe('Marketplace')
    })

    it('is detected by action_type, not by chain', () => {
        expect(helper.isSolverMarketPlaceFill(SolverMarketPlaceFill)).toBe(true)
        expect(helper.isSolverMarketPlaceFill({ ...SolverMarketPlaceFill, action_type: 'IntentFilled' })).toBe(false)
        expect(helper.isSolverMarketPlaceFill(null)).toBe(false)
    })

    it('is offered in the action-type filter', () => {
        expect(helper.getMsgTypes()).toContain('SolverMarketPlaceFill')
    })

    it('source and dest columns show the leg chains (icon + name), no tx hash', () => {
        const fill = { ...SolverMarketPlaceFill, src_network: '15', dest_network: '728126428' }
        const meta = { urls: { tx: {} } }
        const [srcImg, srcName] = Render.renderSrcHashLink(fill, meta).props.children
        expect(srcImg.props.alt).toBe('')
        expect(srcName.props.children).toBe('near')
        const [destImg, destName] = Render.renderDestHashLink(fill, meta).props.children
        expect(destImg.props.alt).toBe('')
        expect(destName.props.children).toBe('tron')
    })

    it('non-fill rows keep the tx-hash source cell', () => {
        const el = Render.renderSrcHashLink(legacyNonMpc, { urls: { tx: {} } })
        expect(el.props.children[1].props.children.props['data-hash']).toBe(legacyNonMpc.src_tx_hash)
    })

    it('unknown chain renders a dash', () => {
        expect(Render.renderChain('999999').props.children).toBe('-')
    })
})

describe('renderRoute (desktop Route cell)', () => {
    const html = async (el) => (await import('react-dom/server')).renderToStaticMarkup(el)
    const meta = { urls: { tx: {} } }

    it('keeps both short tx hashes available for a relay row', async () => {
        const out = await html(Render.renderRoute(legacyNonMpc, meta))
        expect(out).toContain(`data-hash="${legacyNonMpc.src_tx_hash}"`)
        expect(out).toContain(`data-hash="${legacyNonMpc.dest_tx_hash}"`)
        expect(out).toContain('→')
    })

    it('shows chain names without a hash for SolverMarketPlaceFill rows', async () => {
        const out = await html(Render.renderRoute(SolverMarketPlaceFill, meta))
        expect(out).not.toContain('data-hash')
        expect(out).toContain('→')
    })
})

describe('route destination hash attribution', () => {
    const html = async (el) => (await import('react-dom/server')).renderToStaticMarkup(el)
    const meta = { urls: { tx: {} } }
    const hub = { ...legacyNonMpc, id: 20, sn: null, action_type: 'CancelIntent', src_network: '4', src_tx_hash: '0xhubsrc', dest_network: '6', dest_tx_hash: null }

    it('normal message: hash under each chain', async () => {
        const out = await html(Render.renderRoute(legacyNonMpc, meta))
        expect(out).toContain('data-hash="0xsrc_legacy"')
        expect(out).toContain('data-hash="0xdest_legacy"')
        expect(Render.routeDestHash(legacyNonMpc)).toBe('0xdest_legacy')
    })

    it('hub event (sn null): source hash is never shown under the dest chain', async () => {
        expect(Render.routeDestHash(hub)).toBeNull()
        const out = await html(Render.renderRoute(hub, meta))
        expect(out.match(/data-hash="0xhubsrc"/g)).toHaveLength(1)
        const mobile = await html(Render.renderDestHashLink(hub, meta))
        expect(mobile).not.toContain('0xhubsrc')
        expect(mobile).not.toContain('data-hash')
    })

    it('MPC message: no dest hash until one exists, never the source hash', async () => {
        const mpc = { ...legacyNonMpc, id: 21, sn: null, mpc_id: 'abc', dest_tx_hash: null, src_tx_hash: '0xmpcsrc' }
        expect(Render.routeDestHash(mpc)).toBeNull()
        const out = await html(Render.renderRoute(mpc, meta))
        expect(out.match(/data-hash="0xmpcsrc"/g)).toHaveLength(1)
    })

    it('rollback hash is still shown, but labelled as a source-chain rollback, never as the dest hash', async () => {
        const rb = { ...legacyNonMpc, rollback_tx_hash: '0xrollback', dest_tx_hash: null }
        expect(Render.routeDestHash(rb)).toBeNull()
        const out = await html(Render.renderRoute(rb, meta))
        expect(out.match(/data-hash="0xrollback"/g)).toHaveLength(1)
        expect(out).toMatch(/Rolled back on[^<]*:<\/span><span class="tx-hash" data-hash="0xrollback"/)
        const mobile = await html(Render.renderDestHashLink(rb, meta))
        expect(mobile.match(/data-hash="0xrollback"/g)).toHaveLength(1)
        expect(mobile).toContain('Rolled back on')
    })

    it('mobile dest leg strips 0x for bare-hash chains and labels unknown chains', async () => {
        const xrp = { ...legacyNonMpc, dest_network: '66', dest_tx_hash: '0xABCDEF0123456789ABCDEF' }
        const out = await html(Render.renderDestHashLink(xrp, meta))
        expect(out).toContain('data-hash="ABCDEF0123456789ABCDEF"')
        const unk = { ...legacyNonMpc, dest_network: '999999', dest_tx_hash: null }
        expect(await html(Render.renderDestHashLink(unk, meta))).toContain('Chain 999999')
    })

    it('unknown dest network still renders a leg, and keeps its own hash', async () => {
        const unk = { ...legacyNonMpc, dest_network: '999999', dest_tx_hash: '0xunknown' }
        const out = await html(Render.renderRoute(unk, meta))
        expect(out).toContain('Chain 999999')
        expect(out).toContain('data-hash="0xunknown"')
        const hubUnk = { ...hub, dest_network: '999999' }
        const out2 = await html(Render.renderRoute(hubUnk, meta))
        expect(out2).toContain('Chain 999999')
        expect(out2.match(/data-hash/g)).toHaveLength(1)
        expect(await html(Render.renderDestHashLink(hubUnk, meta))).not.toContain('data-hash')
    })

    it('bare-hash chains drop 0x in the route cell (matches detail page)', async () => {
        const xrp = { ...legacyNonMpc, src_network: '66', src_tx_hash: '0xABCDEF' }
        const out = await html(Render.renderRoute(xrp, meta))
        expect(out).toContain('data-hash="ABCDEF"')
        expect(out).not.toContain('0xABCDEF')
    })
})
