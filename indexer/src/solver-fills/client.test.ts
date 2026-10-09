import { describe, it, expect, afterEach, spyOn } from 'bun:test';
import axios, { AxiosError } from 'axios';
import { parseFillsPage, fetchFillsPage, FillsResponseError, type ClientConfig, type FillsQuery } from './client';

// Shaped like a backend response. Fields the parser must drop are kept so the
// test proves they never reach the returned object.
const samplePage = {
  accounts: ['solver-a.near'],
  hours: 24,
  from: '2026-10-04T07:39:35.629776+00:00',
  to: null,
  order: 'asc',
  count: 1,
  has_more: true,
  next_cursor: 'cursor-page-2',
  indexed_through: { block_height: 1000, block_timestamp: '2026-10-05T07:39:29.350614+00:00', cursor_updated_at: '2026-10-05T07:39:35.200652+00:00', lag_seconds: 0.4 },
  fills: [
    {
      timestamp: '2026-10-05T07:39:25.177740+00:00',
      intent_hash: 'IntentHashAAAA1111',
      account_id: 'solver-a.near',
      block_height: 1001,
      receipt_id: 'receipt-0001',
      diff: { 'nep141:token-a': '398673860' },
      direction: 'TRX (Tron) → USDT (Tron)',
      received_legs: [{ token_id: 'nep141:token-a', label: 'TRX (Tron)', amount: 398.67386 }],
      paid_legs: [{ token_id: 'nep141:token-b', label: 'USDT (Tron)', amount: 133.761844 }],
      fees_collected: { 'nep141:token-b': '134' },
      referral: null,
      usd_received: '133.582589438747559315036',
      usd_paid: '133.761844',
      unpriced_legs: 0,
    },
  ],
};

describe('parseFillsPage', () => {
  it('keeps only the fields the poller needs', () => {
    const page = parseFillsPage(samplePage);
    expect(page).toEqual({
      hasMore: true,
      nextCursor: samplePage.next_cursor,
      skipped: [],
      lastTimestamp: '2026-10-05T07:39:25.177740+00:00',
      fills: [
        {
          timestamp: '2026-10-05T07:39:25.177740+00:00',
          intentHash: 'IntentHashAAAA1111',
          receivedLegs: [{ label: 'TRX (Tron)', amount: 398.67386 }],
          paidLegs: [{ label: 'USDT (Tron)', amount: 133.761844 }],
          usdPaid: '133.761844',
          unpricedLegs: 0,
        },
      ],
    });
    expect(JSON.stringify(page)).not.toContain('solver-a');
    expect(JSON.stringify(page)).not.toContain('receipt');
  });

  it('accepts a null next_cursor on the last page', () => {
    const page = parseFillsPage({ ...samplePage, has_more: false, next_cursor: null, fills: [] });
    expect(page).toEqual({ hasMore: false, nextCursor: null, fills: [], skipped: [], lastTimestamp: null });
  });

  it('rejects a page not ordered ascending, which would move the cursor backwards', () => {
    expect(() => parseFillsPage({ ...samplePage, order: 'desc' })).toThrow(FillsResponseError);
  });

  it('rejects a non-object body', () => {
    expect(() => parseFillsPage('<html>')).toThrow(FillsResponseError);
  });

  it('skips a fill with a missing intent_hash, names the field, and keeps parsing other fills', () => {
    const bad = { ...samplePage, fills: [{ ...samplePage.fills[0], intent_hash: '' }, samplePage.fills[0]] };
    const page = parseFillsPage(bad);
    expect(page.skipped).toEqual([{ intentHash: null, reason: 'intent_hash must be a non-empty string' }]);
    expect(page.fills).toHaveLength(1);
  });

  it('skips a fill with a non-numeric leg amount, names the field, and keeps parsing other fills', () => {
    const bad = {
      ...samplePage,
      fills: [{ ...samplePage.fills[0], paid_legs: [{ label: 'USDT (Tron)', amount: '1' }] }, samplePage.fills[0]],
    };
    const page = parseFillsPage(bad);
    expect(page.skipped).toEqual([{ intentHash: 'IntentHashAAAA1111', reason: 'paid_legs[0].amount must be a finite number' }]);
    expect(page.fills).toHaveLength(1);
  });

  it('derives lastTimestamp from the raw last fill even when that fill is skipped', () => {
    const badLast = {
      ...samplePage.fills[0],
      timestamp: '2026-10-06T00:00:00.000Z',
      paid_legs: [{ label: 'USDT (Tron)', amount: 'x' }],
    };
    const page = parseFillsPage({ ...samplePage, fills: [samplePage.fills[0], badLast] });
    expect(page.lastTimestamp).toBe('2026-10-06T00:00:00.000Z');
    expect(page.skipped).toHaveLength(1);
    expect(page.fills).toHaveLength(1);
  });

  it('skips a fill with an unparseable timestamp, and lastTimestamp falls back to the last successfully parsed fill', () => {
    const badLast = { ...samplePage.fills[0], timestamp: 'garbage' };
    const page = parseFillsPage({ ...samplePage, fills: [samplePage.fills[0], badLast] });
    expect(page.skipped).toEqual([{ intentHash: 'IntentHashAAAA1111', reason: 'timestamp must be an ISO timestamp' }]);
    expect(page.fills).toHaveLength(1);
    expect(page.lastTimestamp).toBe(samplePage.fills[0].timestamp);
  });

  it('skips every fill and returns a null lastTimestamp when all raw fills have a bad timestamp', () => {
    const bad = {
      ...samplePage,
      fills: [
        { ...samplePage.fills[0], timestamp: 'garbage' },
        { ...samplePage.fills[0], intent_hash: 'IntentHashBBBB2222', timestamp: '2026' },
      ],
    };
    const page = parseFillsPage(bad);
    expect(page.fills).toHaveLength(0);
    expect(page.skipped).toHaveLength(2);
    expect(page.lastTimestamp).toBeNull();
  });

  it('falls back to the last successfully parsed fill when the raw last fill has no timestamp', () => {
    const badLast = { ...samplePage.fills[0], timestamp: undefined };
    const page = parseFillsPage({ ...samplePage, fills: [samplePage.fills[0], badLast] });
    expect(page.skipped).toEqual([{ intentHash: 'IntentHashAAAA1111', reason: 'timestamp must be an ISO timestamp' }]);
    expect(page.lastTimestamp).toBe(samplePage.fills[0].timestamp);
  });
});

describe('fetchFillsPage', () => {
  const cfg: ClientConfig = {
    baseUrl: 'https://x.test',
    accounts: ['acct-1.near', 'acct-2.near'],
    pageSize: 50,
    timeoutMs: 5000,
  };
  const q: FillsQuery = { from: '2026-10-04T07:39:35.629776+00:00' };

  afterEach(() => {
    (axios.get as any).mockRestore?.();
  });

  it('requests the fills endpoint with order, from, comma-joined accounts, limit and timeout', async () => {
    const getSpy = spyOn(axios, 'get').mockResolvedValue({ data: samplePage });

    const page = await fetchFillsPage(cfg, q);

    expect(getSpy).toHaveBeenCalledWith('https://x.test/v1/intents/near/fills', {
      params: {
        order: 'asc',
        from: q.from,
        accounts: 'acct-1.near,acct-2.near',
        limit: cfg.pageSize,
      },
      timeout: cfg.timeoutMs,
    });
    expect(page).toEqual(parseFillsPage(samplePage));
  });

  it('includes cursor only when q.cursor is set', async () => {
    const getSpy = spyOn(axios, 'get').mockResolvedValue({ data: samplePage });

    await fetchFillsPage(cfg, q);
    expect(getSpy.mock.calls[0][1].params).not.toHaveProperty('cursor');

    await fetchFillsPage(cfg, { ...q, cursor: 'abc123' });
    expect(getSpy.mock.calls[1][1].params).toMatchObject({ cursor: 'abc123' });
  });

  it('strips trailing slashes from baseUrl', async () => {
    const getSpy = spyOn(axios, 'get').mockResolvedValue({ data: samplePage });

    await fetchFillsPage({ ...cfg, baseUrl: 'https://x.test//' }, q);

    expect(getSpy.mock.calls[0][0]).toBe('https://x.test/v1/intents/near/fills');
  });

  it('wraps an axios error with a response into FillsResponseError naming the status and from, without the response body', async () => {
    const axiosErr = new AxiosError(
      'Request failed with status code 502',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      { status: 502, statusText: 'Bad Gateway', data: { error: 'solver-a.near upstream down' }, headers: {}, config: {} as any },
    );
    spyOn(axios, 'get').mockRejectedValue(axiosErr);

    const err = await fetchFillsPage(cfg, q).catch((e) => e);
    expect(err).toBeInstanceOf(FillsResponseError);
    expect(err.message).toContain('502');
    expect(err.message).toContain(`from=${q.from}`);
    expect(err.message).not.toContain('solver-a');
  });

  it('wraps an axios error with no response into FillsResponseError containing "no response"', async () => {
    const axiosErr = new AxiosError('timeout of 5000ms exceeded', 'ECONNABORTED');
    spyOn(axios, 'get').mockRejectedValue(axiosErr);

    await expect(fetchFillsPage(cfg, q)).rejects.toThrow(FillsResponseError);
    await expect(fetchFillsPage(cfg, q)).rejects.toThrow(/failed \(no response, ECONNABORTED\)/);
  });

  it('rethrows a non-axios error unchanged', async () => {
    const plainErr = new Error('boom');
    spyOn(axios, 'get').mockRejectedValue(plainErr);

    await expect(fetchFillsPage(cfg, q)).rejects.toBe(plainErr);
  });
});
