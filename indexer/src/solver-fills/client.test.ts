import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import axios, { AxiosError, type AxiosResponse } from 'axios';
import { type ClientConfig, FillsResponseError, fetchTradesPage, parseTradesPage } from './client';

// Shaped like a backend response. Fields the parser must drop are kept so the
// tests prove they never reach the returned object.
const nearTrade = {
  id: 1162517,
  ts: '2026-10-13T01:42:16.910000+00:00',
  book: 'majors',
  asset_in: 'USDT',
  asset_out: 'TRX',
  amount_in: 251.102248,
  amount_out: 762.435184,
  price_in_usd: 1.0,
  price_out_usd: 0.3293424980120743,
  notional_usd: 251.102248,
  realised_usd: -0.00006,
  in_venue: 'near:tron',
  out_venue: 'near:tron',
  tx_hash: 'ChvfP2pUJtw33sS7ib8wzu3VxYHFtDYK5ax9MJnCJGj8',
  order_id: 0,
};
const lifiTrade = {
  ...nearTrade,
  id: 1162511,
  ts: '2026-10-13T01:39:47+00:00',
  asset_in: 'USDC',
  asset_out: 'USDC',
  amount_in: 3999,
  amount_out: 3998.921586,
  notional_usd: 4003.2560497145096,
  in_venue: 'lifi:eth',
  out_venue: 'lifi:arb',
  tx_hash: '0xa47465900a857f99a8a955dcc928b3e201b1cabb00d12c40e81b50ff1a2be8e6',
};
const krakenTrade = {
  ...nearTrade,
  id: 1162505,
  book: 'soda',
  in_venue: 'kraken:spot',
  out_venue: 'kraken:spot',
  tx_hash: 'TPNP4A-SJ4QR-C5COD7',
};
const hubTrade = { ...nearTrade, id: 1162500, in_venue: 'sodax:sonic', out_venue: 'sodax:sonic' };

const page = (trades: unknown[], extra: Record<string, unknown> = {}) => ({
  trades,
  next_cursor: 1162500,
  has_more: true,
  ...extra,
});

describe('parseTradesPage', () => {
  it('keeps NEAR and LI.FI trades with only the fields the poller needs', () => {
    expect(parseTradesPage(page([nearTrade, lifiTrade]))).toEqual({
      trades: [
        {
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
        },
        {
          id: 1162511,
          venue: 'lifi',
          timestamp: '2026-10-13T01:39:47+00:00',
          txHash: '0xa47465900a857f99a8a955dcc928b3e201b1cabb00d12c40e81b50ff1a2be8e6',
          assetIn: 'USDC',
          assetOut: 'USDC',
          amountIn: 3999,
          amountOut: 3998.921586,
          chainIn: 'eth',
          chainOut: 'arb',
          notionalUsd: 4003.2560497145096,
        },
      ],
      skipped: [],
      newestId: 1162517,
      oldestId: 1162511,
      hasMore: true,
      nextCursor: 1162500,
    });
  });

  it('drops Kraken and hub trades but still counts them in the page id range', () => {
    const p = parseTradesPage(page([nearTrade, krakenTrade, hubTrade]));
    expect(p.trades.map(t => t.id)).toEqual([1162517]);
    expect(p.skipped).toEqual([]);
    expect(p.newestId).toBe(1162517);
    expect(p.oldestId).toBe(1162500);
  });

  it('returns null ids for an empty page', () => {
    const p = parseTradesPage(page([], { has_more: false, next_cursor: null }));
    expect(p).toEqual({ trades: [], skipped: [], newestId: null, oldestId: null, hasMore: false, nextCursor: null });
  });

  it('skips a trade with a bad field, names the field, and keeps parsing others', () => {
    const p = parseTradesPage(page([{ ...nearTrade, amount_out: 'x' }, lifiTrade]));
    expect(p.skipped).toEqual([{ id: 1162517, reason: 'amount_out must be a finite number' }]);
    expect(p.trades.map(t => t.id)).toEqual([1162511]);
    expect(p.newestId).toBe(1162517);
  });

  it('skips a trade with an unparseable ts or malformed venue', () => {
    const p = parseTradesPage(
      page([
        { ...nearTrade, ts: 'yesterday' },
        { ...lifiTrade, out_venue: 'lifi' },
      ]),
    );
    expect(p.skipped).toEqual([
      { id: 1162517, reason: 'ts must be an ISO timestamp' },
      { id: 1162511, reason: 'out_venue "lifi" is not "<family>:<chain>"' },
    ]);
  });

  it('accepts a null notional_usd and rejects a non-numeric one', () => {
    expect(parseTradesPage(page([{ ...nearTrade, notional_usd: null }])).trades[0].notionalUsd).toBeNull();
    expect(parseTradesPage(page([{ ...nearTrade, notional_usd: '1' }])).skipped[0].reason).toBe(
      'notional_usd must be a finite number or null',
    );
  });

  it('rejects the page when a trade id is missing, since the cursor depends on it', () => {
    expect(() => parseTradesPage(page([{ ...nearTrade, id: undefined }]))).toThrow(
      'trades[0].id must be a positive integer',
    );
  });

  it('rejects a page that is not newest-first by id', () => {
    expect(() => parseTradesPage(page([lifiTrade, nearTrade]))).toThrow(
      'trades must be newest-first by id, got 1162517 after 1162511',
    );
  });

  it('rejects bad envelopes', () => {
    expect(() => parseTradesPage(null)).toThrow(FillsResponseError);
    expect(() => parseTradesPage(page([], { has_more: 'yes' }))).toThrow('has_more must be a boolean');
    expect(() => parseTradesPage(page([], { next_cursor: 'abc' }))).toThrow(
      'next_cursor must be a positive integer or null',
    );
    expect(() => parseTradesPage({ has_more: false, next_cursor: null })).toThrow('trades must be an array');
  });
});

describe('fetchTradesPage', () => {
  const cfg: ClientConfig = { baseUrl: 'https://backend.example/v1/a/', pageSize: 100, timeoutMs: 15_000 };
  let getSpy: ReturnType<typeof spyOn> | undefined;
  afterEach(() => getSpy?.mockRestore());

  it('requests the trades endpoint with limit, and before_id only when given', async () => {
    getSpy = spyOn(axios, 'get').mockResolvedValue({ data: page([nearTrade]) });
    await fetchTradesPage(cfg, {});
    await fetchTradesPage(cfg, { beforeId: 1162500 });
    expect(getSpy.mock.calls).toEqual([
      ['https://backend.example/v1/a/v1/mm/quoter/trades', { params: { limit: 100 }, timeout: 15_000 }],
      [
        'https://backend.example/v1/a/v1/mm/quoter/trades',
        { params: { limit: 100, before_id: 1162500 }, timeout: 15_000 },
      ],
    ]);
  });

  it('wraps an axios error into FillsResponseError naming the status and before_id', async () => {
    const err = new AxiosError('boom', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 503 } as AxiosResponse);
    getSpy = spyOn(axios, 'get').mockRejectedValue(err);
    await expect(fetchTradesPage(cfg, { beforeId: 7 })).rejects.toThrow(
      'GET /v1/mm/quoter/trades before_id=7 failed (503)',
    );
  });

  it('reports "no response" when the request never got one', async () => {
    getSpy = spyOn(axios, 'get').mockRejectedValue(new AxiosError('timeout', 'ECONNABORTED'));
    await expect(fetchTradesPage(cfg, {})).rejects.toThrow('before_id=none failed (no response, ECONNABORTED)');
  });

  it('rethrows a non-axios error unchanged', async () => {
    const boom = new TypeError('bad');
    getSpy = spyOn(axios, 'get').mockRejectedValue(boom);
    await expect(fetchTradesPage(cfg, {})).rejects.toBe(boom);
  });
});
