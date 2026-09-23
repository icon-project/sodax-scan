import { describe, it, expect } from 'vitest'
import db from '../../api/db.js'

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
