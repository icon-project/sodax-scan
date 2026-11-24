import { describe, it, expect } from 'vitest'
import actionLabel from '../lib/action-label'

describe('actionLabel', () => {
    it('uses curated labels for known action types', () => {
        expect(actionLabel('SolverMarketPlaceFill')).toBe('Solver fill')
        expect(actionLabel('IntentFilled')).toBe('Intent filled')
        expect(actionLabel('CreateIntent')).toBe('Create intent')
        expect(actionLabel('CancelIntent')).toBe('Cancel intent')
        expect(actionLabel('SendMsg')).toBe('Send message')
    })

    it('capitalises single-word and lowercase legacy values', () => {
        expect(actionLabel('Deposit')).toBe('Deposit')
        expect(actionLabel('withdrawal')).toBe('Withdrawal')
    })

    it('falls back to sentence case for unknown camelCase / snake_case', () => {
        expect(actionLabel('SomeNewActionType')).toBe('Some new action type')
        expect(actionLabel('bridge_out')).toBe('Bridge out')
        expect(actionLabel('ABCThing')).toBe('ABC thing')
    })

    it('preserves runs of capitals as acronyms', () => {
        expect(actionLabel('NFTMint')).toBe('NFT mint')
        expect(actionLabel('MintNFT')).toBe('Mint NFT')
        expect(actionLabel('SwapUSDCForETH')).toBe('Swap USDC for ETH')
        expect(actionLabel('BRIDGE_OUT')).toBe('Bridge out')
    })

    it('returns an empty string for missing values', () => {
        expect(actionLabel(null)).toBe('')
        expect(actionLabel(undefined)).toBe('')
        expect(actionLabel('  ')).toBe('')
    })
})
