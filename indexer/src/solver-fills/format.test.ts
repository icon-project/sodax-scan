import { describe, it, expect } from 'bun:test';
import { fillToRow, isoToUnixSeconds } from './format';
import type { SolverFill } from './client';

// A subset of configs.ts chain ids. Passed in so this test never imports
// configs.ts, which requires RPC env vars and is mocked by main.mpc.test.ts.
const CHAINS = { tron: '728126428', near: '15', arbitrum: '23', avax: '6', bsc: '4' };

const trxToUsdt: SolverFill = {
  timestamp: '2026-10-05T07:39:25.177740+00:00',
  intentHash: 'IntentHashAAAA1111',
  receivedLegs: [{ label: 'TRX (Tron)', amount: 398.67386 }],
  paidLegs: [{ label: 'USDT (Tron)', amount: 133.761844 }],
  usdPaid: '133.761844',
  unpricedLegs: 0,
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

describe('fillToRow', () => {
  it('maps a same-chain fill', () => {
    expect(fillToRow(trxToUsdt, CHAINS)).toEqual({
      ok: true,
      row: {
        intentHash: 'IntentHashAAAA1111',
        srcChainId: '728126428',
        dstChainId: '728126428',
        timestamp: Date.UTC(2026, 9, 5, 7, 39, 25) / 1000,
        actionDetail: 'SolverFill 398.67386 TRX(tron) -> 133.761844 USDT(tron)',
        amountUsd: '133.761844',
      },
    });
  });

  it('maps a cross-chain fill with a NEAR-native leg', () => {
    const r = fillToRow(
      { ...trxToUsdt, receivedLegs: [{ label: 'USDT (NEAR)', amount: 20.18196 }], paidLegs: [{ label: 'USDT (Arbitrum)', amount: 20.180152 }] },
      CHAINS,
    );
    expect(r.ok && r.row.srcChainId).toBe('15');
    expect(r.ok && r.row.dstChainId).toBe('23');
    expect(r.ok && r.row.actionDetail).toBe('SolverFill 20.18196 USDT(near) -> 20.180152 USDT(arbitrum)');
  });

  it('resolves display-name aliases', () => {
    const r = fillToRow(
      { ...trxToUsdt, receivedLegs: [{ label: 'AVAX (Avalanche)', amount: 1 }], paidLegs: [{ label: 'BNB (BNB Chain)', amount: 2 }] },
      CHAINS,
    );
    expect(r.ok && r.row.actionDetail).toBe('SolverFill 1 AVAX(avax) -> 2 BNB(bsc)');
  });

  it('joins multi-leg sides with +, networks from the first leg', () => {
    const r = fillToRow(
      { ...trxToUsdt, paidLegs: [{ label: 'USDT (Tron)', amount: 100 }, { label: 'USDT (Arbitrum)', amount: 33.5 }] },
      CHAINS,
    );
    expect(r.ok && r.row.actionDetail).toBe('SolverFill 398.67386 TRX(tron) -> 100 USDT(tron) + 33.5 USDT(arbitrum)');
    expect(r.ok && r.row.dstChainId).toBe('728126428');
  });

  it('nulls the USD amount when any leg is unpriced', () => {
    const r = fillToRow({ ...trxToUsdt, unpricedLegs: 1 }, CHAINS);
    expect(r.ok && r.row.amountUsd).toBeNull();
  });

  it('nulls the USD amount when usd_paid is null', () => {
    const r = fillToRow({ ...trxToUsdt, usdPaid: null }, CHAINS);
    expect(r.ok && r.row.amountUsd).toBeNull();
  });

  it('rejects an unknown chain with a stable reason', () => {
    const r = fillToRow({ ...trxToUsdt, paidLegs: [{ label: 'DOGE (Dogecoin)', amount: 5 }] }, CHAINS);
    expect(r).toEqual({ ok: false, reason: 'unknown chain "Dogecoin"' });
  });

  it('rejects a label without a (Chain) suffix', () => {
    const r = fillToRow({ ...trxToUsdt, paidLegs: [{ label: 'USDT', amount: 5 }] }, CHAINS);
    expect(r).toEqual({ ok: false, reason: 'unparseable leg label "USDT"' });
  });

  it('rejects a side with no legs', () => {
    const r = fillToRow({ ...trxToUsdt, receivedLegs: [] }, CHAINS);
    expect(r).toEqual({ ok: false, reason: 'fill has an empty leg side' });
  });

  it('rejects an unparseable timestamp', () => {
    const r = fillToRow({ ...trxToUsdt, timestamp: 'yesterday' }, CHAINS);
    expect(r).toEqual({ ok: false, reason: 'unparseable timestamp "yesterday"' });
  });
});
