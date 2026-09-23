import { describe, it, expect } from 'vitest'
import helper from '../lib/helper'
import {
    depositSweepComplete,
    depositMemoComplete,
    withdrawalReleased,
    transferReleased,
    depositRouted,
    depositAttested,
    withdrawalHubBurned,
    depositMintedPending,
    legacyNonMpc,
} from './fixtures'

describe('isMpcTransaction — chain-based detection (R7, ADR-002 revised)', () => {
    it('detects a deposit whose src+dest are an MPC chain', () => {
        expect(helper.isMpcTransaction(depositSweepComplete)).toBe(true)
        expect(helper.isMpcTransaction(depositMemoComplete)).toBe(true)
    })

    it('detects a withdrawal/transfer via dest even when src is Sonic 146 (legacy)', () => {
        expect(withdrawalReleased.src_network).toBe('146')
        expect(helper.isMpcTransaction(withdrawalReleased)).toBe(true)
        expect(transferReleased.src_network).toBe('146')
        expect(helper.isMpcTransaction(transferReleased)).toBe(true)
    })

    it('detects a COMPLETED MPC row (status=executed) — status cannot, chain can', () => {
        expect(depositSweepComplete.status).toBe('executed')
        expect(helper.isMpcTransaction(depositSweepComplete)).toBe(true)
    })

    it('is false for a legacy non-MPC row (neither chain in the MPC set)', () => {
        expect(helper.isMpcTransaction(legacyNonMpc)).toBe(false)
    })

    it('is null-safe', () => {
        expect(helper.isMpcTransaction(null)).toBe(false)
        expect(helper.isMpcTransaction({ src_network: null, dest_network: null })).toBe(false)
        expect(helper.isMpcTransaction({})).toBe(false)
    })

    it('MPC_CHAIN_IDS is exactly the five MPC chain ids (derived from CHAIN_MODE keys)', () => {
        expect([...helper.MPC_CHAIN_IDS].sort()).toEqual(['133', '48', '607', '66', '728126428'].sort())
    })
})

describe('getChainMode (R8)', () => {
    it('resolves sweep chains by numeric id', () => {
        expect(helper.getChainMode('48')).toBe('sweep') // monad
        expect(helper.getChainMode('133')).toBe('sweep') // zcash
    })

    it('resolves memo chains by numeric id', () => {
        expect(helper.getChainMode('607')).toBe('memo') // ton
        expect(helper.getChainMode('728126428')).toBe('memo') // tron
        expect(helper.getChainMode('66')).toBe('memo') // xrp
    })

    it('returns undefined for an unknown chain', () => {
        expect(helper.getChainMode('999999')).toBeUndefined()
        expect(helper.getChainMode(undefined)).toBeUndefined()
    })

    it('CHAIN_MODE is the single source and has exactly the five chains', () => {
        expect(helper.CHAIN_MODE).toEqual({
            monad: 'sweep',
            zcash: 'sweep',
            ton: 'memo',
            tron: 'memo',
            xrp: 'memo',
        })
    })
})

describe('STATUS_FILTERS — shared status vocabulary (R2b, §2.7)', () => {
    it('is exactly the six statuses in the contracted order (attested is the one new one)', () => {
        expect(helper.STATUS_FILTERS).toEqual(['pending', 'attested', 'delivered', 'executed', 'failed', 'rollbacked'])
    })

    it('no longer exposes an MPC_STATUSES symbol (removed in iteration 4)', () => {
        expect(helper.MPC_STATUSES).toBeUndefined()
    })
})

describe('deriveMpcSteps — kind-aware (R5, R6, ADR-006)', () => {
    it('deposit / sweep chain: Attested → Minted → Swept, terminal swept + all reached', () => {
        const { kind, mode, steps, terminalKey } = helper.deriveMpcSteps(depositSweepComplete)
        expect(kind).toBe('deposit')
        expect(mode).toBe('sweep')
        expect(terminalKey).toBe('swept')
        expect(steps.map((s) => s.key)).toEqual(['attested', 'minted', 'swept'])
        expect(steps.find((s) => s.key === 'swept').terminal).toBe(true)
        expect(steps.every((s) => s.reached)).toBe(true)
        expect(steps.find((s) => s.key === 'swept').network).toBe('133')
    })

    it('deposit / memo chain: Attested → Minted, terminal minted, no swept step', () => {
        const { kind, mode, steps, terminalKey } = helper.deriveMpcSteps(depositMemoComplete)
        expect(kind).toBe('deposit')
        expect(mode).toBe('memo')
        expect(terminalKey).toBe('minted')
        expect(steps.map((s) => s.key)).toEqual(['attested', 'minted'])
        expect(steps.find((s) => s.key === 'swept')).toBeUndefined()
        expect(steps.find((s) => s.key === 'minted').terminal).toBe(true)
    })

    it('withdrawal: Attested → Hub-burned → Released, terminal released', () => {
        const { kind, steps, terminalKey } = helper.deriveMpcSteps(withdrawalReleased)
        expect(kind).toBe('withdrawal')
        expect(terminalKey).toBe('released')
        expect(steps.map((s) => s.key)).toEqual(['attested', 'hub-burned', 'released'])
        expect(steps.find((s) => s.key === 'released').terminal).toBe(true)
        expect(steps.every((s) => s.reached)).toBe(true)
        expect(steps.find((s) => s.key === 'minted')).toBeUndefined()
        expect(steps.find((s) => s.key === 'swept')).toBeUndefined()
    })

    it('transfer: Attested → Released, terminal released (no hub-burned/minted)', () => {
        const { kind, steps, terminalKey } = helper.deriveMpcSteps(transferReleased)
        expect(kind).toBe('transfer')
        expect(terminalKey).toBe('released')
        expect(steps.map((s) => s.key)).toEqual(['attested', 'released'])
        expect(steps.find((s) => s.key === 'released').terminal).toBe(true)
        expect(steps.find((s) => s.key === 'hub-burned')).toBeUndefined()
    })

    it('routed deposit (memo chain xrp): all legs not-yet-reached, no error', () => {
        // depositRouted is on xrp (66, memo) → no swept step; terminal = minted.
        const { steps, terminalKey } = helper.deriveMpcSteps(depositRouted)
        expect(steps.map((s) => s.key)).toEqual(['attested', 'minted'])
        expect(steps.every((s) => !s.reached)).toBe(true)
        expect(terminalKey).toBe('minted')
        expect(steps.find((s) => s.key === 'minted').terminal).toBe(true)
    })

    it('minted-pending sweep deposit: attested+minted reached, swept pending + terminal', () => {
        const { steps, terminalKey } = helper.deriveMpcSteps(depositMintedPending)
        expect(terminalKey).toBe('swept')
        expect(steps.find((s) => s.key === 'attested').reached).toBe(true)
        expect(steps.find((s) => s.key === 'minted').reached).toBe(true)
        expect(steps.find((s) => s.key === 'swept').reached).toBe(false)
        expect(steps.find((s) => s.key === 'swept').terminal).toBe(true)
    })

    it('withdrawal in progress (hub-burned): released pending, no error', () => {
        const { steps } = helper.deriveMpcSteps(withdrawalHubBurned)
        expect(steps.find((s) => s.key === 'hub-burned').reached).toBe(true)
        expect(steps.find((s) => s.key === 'released').reached).toBe(false)
    })

    it('unknown-kind fallback: hub_burn present ⇒ withdrawal', () => {
        const row = { hub_burn_tx_hash: '0xburn', release_tx_hash: null, dest_network: '133' }
        expect(helper.deriveMpcSteps(row).kind).toBe('withdrawal')
    })

    it('unknown-kind fallback: release present (no hub_burn) ⇒ transfer', () => {
        const row = { hub_burn_tx_hash: null, release_tx_hash: '0xrel', dest_network: '48' }
        expect(helper.deriveMpcSteps(row).kind).toBe('transfer')
    })

    it('unknown-kind fallback: no hub_burn/release ⇒ deposit', () => {
        const row = { dest_network: '133', action_type: 'weird' }
        expect(helper.deriveMpcSteps(row).kind).toBe('deposit')
    })

    it('attested step always resolves to NEAR, for every kind and regardless of attested_network', () => {
        const nearId = helper.NETWORK_MAPPINGS.near
        for (const row of [depositSweepComplete, depositMemoComplete, withdrawalReleased, transferReleased]) {
            const step = helper.deriveMpcSteps(row).steps.find((s) => s.key === 'attested')
            expect(step.network).toBe(nearId)
        }
        // even when the row's attested_network column says something else, the step
        // is forced to NEAR (attestation always happens on NEAR).
        const spoofed = { ...withdrawalReleased, attested_network: '999999' }
        const step = helper.deriveMpcSteps(spoofed).steps.find((s) => s.key === 'attested')
        expect(step.network).toBe(nearId)
        expect(step.hash).toBe(withdrawalReleased.attested_tx_hash)
    })

    it('unknown deposit chain fallback: swept shown only if sweep reached', () => {
        const noSweep = { action_type: 'deposit', dest_network: '999999', mint_tx_hash: '0xm' }
        const a = helper.deriveMpcSteps(noSweep)
        expect(a.terminalKey).toBe('minted')
        expect(a.steps.find((s) => s.key === 'swept')).toBeUndefined()
        const withSweep = { action_type: 'deposit', dest_network: '999999', mint_tx_hash: '0xm', sweep_tx_hash: '0xs' }
        const b = helper.deriveMpcSteps(withSweep)
        expect(b.terminalKey).toBe('swept')
        expect(b.steps.find((s) => s.key === 'swept')).toBeDefined()
    })
})
