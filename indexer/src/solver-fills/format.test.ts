import { describe, expect, it } from 'bun:test';
import type { MarketTrade } from './client';
import { isoToUnixSeconds, tradeToRow } from './format';

// A subset of configs.ts chain ids. Passed in so this test never imports
// configs.ts, which requires RPC env vars and is mocked by main.mpc.test.ts.
const CHAINS = {
  tron: '728126428',
  near: '15',
  arbitrum: '23',
  avax: '6',
  bsc: '4',
  ethereum: '1',
  optimism: '10',
  polygon: '137',
  solana: '1399811149',
  zcash: '133',
  robinhood: '46630',
  bitcoin: '627463',
};

const usdtToTrx: MarketTrade = {
  id: 1162517,
  venue: 'near',
  timestamp: '2026-10-13T01:42:16.910000+00:00',
  txHash: 'ChvfP2pUJtw33sS7ib8wzu3VxYHFtDYK5ax9MJnCJGj8',
  assetIn: 'USDT',
  assetOut: 'TRX',
  amountIn: 251.102248,
  amountOut: 762.435184,
  chainIn: 'tron',
  chainOut: 'tron',
  notionalUsd: 251.102248,
};

describe('isoToUnixSeconds', () => {
  it('parses microsecond ISO timestamps', () => {
    expect(isoToUnixSeconds('2026-10-05T07:39:25.177740+00:00')).toBe(Date.UTC(2026, 9, 5, 7, 39, 25) / 1000);
  });
  it('parses a Z-suffixed microsecond timestamp', () => {
    expect(isoToUnixSeconds('2026-10-05T07:39:25.177740Z')).toBe(Date.UTC(2026, 9, 5, 7, 39, 25) / 1000);
  });
  it('returns NaN for garbage', () => {
    expect(Number.isNaN(isoToUnixSeconds('not a date'))).toBe(true);
  });
  it('returns NaN for a bare year or day count, which Date.parse would otherwise accept', () => {
    expect(Number.isNaN(isoToUnixSeconds('1'))).toBe(true);
    expect(Number.isNaN(isoToUnixSeconds('2026'))).toBe(true);
  });
  it('returns NaN for a non-ISO date string, which Date.parse would otherwise accept', () => {
    expect(Number.isNaN(isoToUnixSeconds('Oct 5 2026'))).toBe(true);
  });
});

describe('tradeToRow', () => {
  it('maps a same-chain NEAR trade, keyed by its intent hash', () => {
    expect(tradeToRow(usdtToTrx, CHAINS)).toEqual({
      ok: true,
      row: {
        intentHash: 'ChvfP2pUJtw33sS7ib8wzu3VxYHFtDYK5ax9MJnCJGj8',
        srcChainId: '728126428',
        dstChainId: '728126428',
        timestamp: Date.UTC(2026, 9, 13, 1, 42, 16) / 1000,
        actionDetail: 'SolverMarketPlaceFill 251.102248 USDT(tron) -> 762.435184 TRX(tron) via near.intents',
        amountUsd: '251.102248',
      },
    });
  });

  it('maps a cross-chain LI.FI trade through the venue aliases', () => {
    const r = tradeToRow(
      {
        ...usdtToTrx,
        venue: 'lifi',
        assetIn: 'USDC',
        assetOut: 'USDC',
        amountIn: 3999,
        amountOut: 3998.921586,
        chainIn: 'eth',
        chainOut: 'arb',
      },
      CHAINS,
    );
    expect(r.ok && r.row.srcChainId).toBe('1');
    expect(r.ok && r.row.dstChainId).toBe('23');
    expect(r.ok && r.row.actionDetail).toBe(
      'SolverMarketPlaceFill 3999 USDC(ethereum) -> 3998.921586 USDC(arbitrum) via lifi.intents',
    );
  });

  it('resolves every aliased and direct venue suffix seen on the feed', () => {
    for (const [suffix, name] of [
      ['eth', 'ethereum'],
      ['arb', 'arbitrum'],
      ['op', 'optimism'],
      ['pol', 'polygon'],
      ['sol', 'solana'],
      ['zec', 'zcash'],
      ['near', 'near'],
      ['tron', 'tron'],
      ['avax', 'avax'],
      ['bsc', 'bsc'],
      ['robinhood', 'robinhood'],
    ]) {
      const r = tradeToRow({ ...usdtToTrx, chainIn: suffix }, CHAINS);
      expect(r.ok && r.row.actionDetail).toContain(`USDT(${name})`);
    }
  });

  it('writes amounts in plain decimal, never exponent notation', () => {
    const r = tradeToRow({ ...usdtToTrx, amountIn: 1e-7, notionalUsd: 1e21 }, CHAINS);
    expect(r.ok && r.row.actionDetail).toContain('0.0000001 USDT');
    expect(r.ok && r.row.amountUsd).toBe('1000000000000000000000');
  });

  it('nulls the USD amount when notional_usd is null', () => {
    const r = tradeToRow({ ...usdtToTrx, notionalUsd: null }, CHAINS);
    expect(r.ok && r.row.amountUsd).toBeNull();
  });

  it('labels BTC held on NEAR with its origin chain, bitcoin, on either side', () => {
    const toUsdt = tradeToRow(
      { ...usdtToTrx, assetIn: 'BTC', chainIn: 'near', chainOut: 'eth', assetOut: 'USDT' },
      CHAINS,
    );
    expect(toUsdt.ok && toUsdt.row.srcChainId).toBe('627463');
    expect(toUsdt.ok && toUsdt.row.actionDetail).toContain('BTC(bitcoin) ->');
    const toBtc = tradeToRow({ ...usdtToTrx, assetOut: 'BTC', chainOut: 'near' }, CHAINS);
    expect(toBtc.ok && toBtc.row.dstChainId).toBe('627463');
  });

  it('keeps other NEAR-held assets on near', () => {
    const r = tradeToRow({ ...usdtToTrx, assetIn: 'USDC', chainIn: 'near' }, CHAINS);
    expect(r.ok && r.row.srcChainId).toBe('15');
  });

  it('rejects an unknown chain with a stable reason', () => {
    expect(tradeToRow({ ...usdtToTrx, chainOut: 'doge' }, CHAINS)).toEqual({
      ok: false,
      reason: 'unknown chain "doge"',
    });
  });
});
