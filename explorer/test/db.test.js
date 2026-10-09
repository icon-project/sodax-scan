import { describe, it, expect } from 'vitest'
import db from '../../api/db.js'
import helper from '../lib/helper'

// buildWhereSql builds parameterised WHERE fragments. The status predicate is
// case-insensitive (ADR-005 / B1) so a mis-cased stored status still filters.
describe('buildWhereSql (R2, ADR-005)', () => {
    it('emits a case-insensitive status predicate and passes the value through', () => {
        const { conditions, values } = db.buildWhereSql('attested')
        expect(conditions).toEqual(['LOWER(status) = LOWER($1)'])
        expect(values).toEqual(['attested'])
    })

    it('passes each filter status straight through (6 statuses, no allowlist)', () => {
        for (const s of ['pending', 'attested', 'delivered', 'executed', 'failed', 'rollbacked']) {
            const { conditions, values } = db.buildWhereSql(s)
            expect(conditions[0]).toBe('LOWER(status) = LOWER($1)')
            expect(values[0]).toBe(s)
        }
    })

    it('keeps a mis-cased status intact for the LOWER() comparison', () => {
        const { values } = db.buildWhereSql('Attested')
        expect(values[0]).toBe('Attested')
    })

    it('DETAIL_FIELDS exposes all 10 MPC leg columns + action_type', () => {
        for (const col of [
            'attested_tx_hash', 'attested_network', 'hub_burn_tx_hash', 'hub_burn_network',
            'mint_tx_hash', 'mint_network', 'sweep_tx_hash', 'sweep_network',
            'release_tx_hash', 'release_network', 'action_type',
        ]) {
            expect(db.DETAIL_FIELDS).toContain(col)
        }
    })

    it('increments bind indexes correctly with additional filters', () => {
        const { conditions, values } = db.buildWhereSql('minted', '48', '607')
        expect(conditions[0]).toBe('LOWER(status) = LOWER($1)')
        expect(conditions[1]).toBe('src_network = any(string_to_array($2,\',\'))')
        expect(conditions[2]).toBe('dest_network = any(string_to_array($3,\',\'))')
        expect(values).toEqual(['minted', '48', '607'])
    })

    it('returns no status condition when status is falsy', () => {
        const { conditions } = db.buildWhereSql(undefined)
        expect(conditions).toEqual([])
    })
})

// kind mirrors the list's Serial-No badge precedence: MPC, then solver fill,
// then hub-only (sn NULL), else relay.
describe('buildWhereSql kind filter', () => {
    const kindWhere = (kind) => db.buildWhereSql(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, kind)

    it('maps each kind to its static predicate without adding a bind value', () => {
        expect(kindWhere('mpc')).toEqual({ conditions: ["COALESCE(mpc_id, '') <> ''"], values: [] })
        expect(kindWhere('solver')).toEqual({
            conditions: ["(COALESCE(mpc_id, '') = '' AND action_type = 'SolverFill')"],
            values: [],
        })
        expect(kindWhere('hub')).toEqual({
            conditions: ["(COALESCE(mpc_id, '') = '' AND action_type IS DISTINCT FROM 'SolverFill' AND sn IS NULL)"],
            values: [],
        })
        expect(kindWhere('relay')).toEqual({
            conditions: ["(COALESCE(mpc_id, '') = '' AND action_type IS DISTINCT FROM 'SolverFill' AND sn IS NOT NULL)"],
            values: [],
        })
    })

    it('adds no condition when kind is empty', () => {
        expect(kindWhere('')).toEqual({ conditions: [], values: [] })
        expect(kindWhere(undefined)).toEqual({ conditions: [], values: [] })
    })

    it('accepts every kind the explorer dropdown offers', () => {
        for (const { value } of helper.MESSAGE_KINDS) {
            expect(kindWhere(value).conditions).toHaveLength(1)
        }
    })

    it('rejects an unknown kind with the allowed values', () => {
        expect(() => kindWhere('bridge')).toThrow('Unknown kind "bridge". Use one of: relay, mpc, hub, solver')
    })

    it('keeps bind indexes aligned when combined with bound filters', () => {
        const { conditions, values } = db.buildWhereSql('executed', '146', undefined, undefined, undefined, undefined, undefined, 'Swap', undefined, 'relay')
        expect(conditions).toEqual([
            'LOWER(status) = LOWER($1)',
            "src_network = any(string_to_array($2,','))",
            "action_type = any(string_to_array($3,','))",
            "(COALESCE(mpc_id, '') = '' AND action_type IS DISTINCT FROM 'SolverFill' AND sn IS NOT NULL)",
        ])
        expect(values).toEqual(['executed', '146', 'Swap'])
    })
})
