import { describe, expect, it, mock } from 'bun:test';
import type { MarketTrade, SkippedTrade, TradesPage, TradesQuery } from './client';
import type { FillMapResult, SolverMarketPlaceFillRow } from './format';
import { createPoller, type PollerDeps } from './poller';

const trade = (id: number): MarketTrade => ({
  id,
  timestamp: '2026-10-13T01:00:00Z',
  txHash: `h${id}`,
  assetIn: 'USDT',
  assetOut: 'TRX',
  amountIn: 1,
  amountOut: 1,
  chainIn: 'tron',
  chainOut: 'tron',
  notionalUsd: 1,
});

// Builds a newest-first page from ids. Ids listed in `dropped` are on the raw
// page (they count for newestId/oldestId) but not returned, like Kraken trades.
function pageOf(
  ids: number[],
  opts: { hasMore?: boolean; dropped?: number[]; skipped?: SkippedTrade[] } = {},
): TradesPage {
  const dropped = new Set(opts.dropped ?? []);
  const skippedIds = new Set((opts.skipped ?? []).map(s => s.id));
  const hasMore = opts.hasMore ?? false;
  return {
    trades: ids.filter(id => !dropped.has(id) && !skippedIds.has(id)).map(trade),
    skipped: opts.skipped ?? [],
    newestId: ids.length > 0 ? ids[0] : null,
    oldestId: ids.length > 0 ? ids[ids.length - 1] : null,
    hasMore,
    nextCursor: hasMore ? ids[ids.length - 1] : null,
  };
}

const rowFor = (t: MarketTrade): SolverMarketPlaceFillRow => ({
  intentHash: t.txHash,
  srcChainId: '1',
  dstChainId: '1',
  timestamp: 0,
  actionDetail: 'x',
  amountUsd: null,
});

const firstArg = (fn: unknown) => (fn as ReturnType<typeof mock>).mock.calls[0][0];

function makeDeps(pages: TradesPage[], cursor: number | null, overrides: Partial<PollerDeps> = {}) {
  const queue = [...pages];
  const cursorWrites: number[] = [];
  const queries: TradesQuery[] = [];
  const deps: PollerDeps = {
    fetchPage: mock(async (q: TradesQuery) => {
      queries.push(q);
      return queue.shift() ?? pageOf([]);
    }),
    toRow: (t): FillMapResult => ({ ok: true, row: rowFor(t) }),
    insertFill: mock(async () => true),
    readCursor: async () => cursor,
    writeCursor: mock(async (id: number) => {
      cursorWrites.push(id);
    }),
    log: { log: mock(() => {}), warn: mock(() => {}), error: () => {} },
    ...overrides,
  };
  const inserted = () =>
    (deps.insertFill as ReturnType<typeof mock>).mock.calls.map(([r]) => (r as SolverMarketPlaceFillRow).intentHash);
  return { deps, cursorWrites, queries, inserted };
}

describe('solver-fills poller', () => {
  it('on first run saves the newest id and imports nothing', async () => {
    const { deps, cursorWrites, queries } = makeDeps([pageOf([105, 104, 103], { hasMore: true })], null);
    await createPoller(deps).runOnce();
    expect(queries).toEqual([{}]);
    expect(deps.insertFill).not.toHaveBeenCalled();
    expect(cursorWrites).toEqual([105]);
  });

  it('inserts only trades newer than the cursor, oldest first, and advances to the newest id', async () => {
    const { deps, cursorWrites, inserted } = makeDeps([pageOf([105, 104, 103, 102], { hasMore: true })], 103);
    await createPoller(deps).runOnce();
    expect(inserted()).toEqual(['h104', 'h105']);
    expect(cursorWrites).toEqual([105]);
  });

  it('walks back with before_id until a page reaches the cursor', async () => {
    const { deps, cursorWrites, queries, inserted } = makeDeps(
      [
        pageOf([110, 109], { hasMore: true }),
        pageOf([108, 107], { hasMore: true }),
        pageOf([106, 105], { hasMore: true }),
      ],
      106,
    );
    await createPoller(deps).runOnce();
    expect(queries).toEqual([{}, { beforeId: 109 }, { beforeId: 107 }]);
    expect(inserted()).toEqual(['h107', 'h108', 'h109', 'h110']);
    expect(cursorWrites).toEqual([110]);
  });

  it('stops walking when has_more is false', async () => {
    const { deps, queries, inserted } = makeDeps([pageOf([110, 109])], 50);
    await createPoller(deps).runOnce();
    expect(queries).toEqual([{}]);
    expect(inserted()).toEqual(['h109', 'h110']);
  });

  it('advances past trades from dropped venues even when no trade is inserted', async () => {
    const { deps, cursorWrites } = makeDeps([pageOf([105, 104, 103], { dropped: [105, 104] })], 103);
    await createPoller(deps).runOnce();
    expect(deps.insertFill).not.toHaveBeenCalled();
    expect(cursorWrites).toEqual([105]);
  });

  it('does nothing when there is no new trade', async () => {
    const { deps, cursorWrites } = makeDeps([pageOf([105, 104])], 105);
    await createPoller(deps).runOnce();
    expect(deps.insertFill).not.toHaveBeenCalled();
    expect(cursorWrites).toEqual([]);
  });

  it('does nothing on an empty feed', async () => {
    const { deps, cursorWrites } = makeDeps([pageOf([])], null);
    await createPoller(deps).runOnce();
    expect(cursorWrites).toEqual([]);
  });

  it('warns once and keeps the cursor when it is ahead of the newest trade', async () => {
    const { deps, cursorWrites } = makeDeps([pageOf([100]), pageOf([100])], 200);
    const poller = createPoller(deps);
    await poller.runOnce();
    await poller.runOnce();
    expect(deps.log.warn).toHaveBeenCalledTimes(1);
    expect(firstArg(deps.log.warn)).toContain('saved cursor 200 is ahead of the newest trade 100');
    expect(cursorWrites).toEqual([]);
  });

  it('does not advance the cursor when an insert fails, and throws', async () => {
    const { deps, cursorWrites } = makeDeps([pageOf([105, 104, 103])], 103, {
      insertFill: mock(async (r: SolverMarketPlaceFillRow) => {
        if (r.intentHash === 'h105') throw new Error('db down');
        return true;
      }),
    });
    await expect(createPoller(deps).runOnce()).rejects.toThrow('1/2 trade(s) failed, not advancing cursor past 103');
    expect(cursorWrites).toEqual([]);
  });

  it('skips unmappable trades, warns once per reason, and still advances', async () => {
    const { deps, cursorWrites } = makeDeps([pageOf([105, 104, 103])], 103, {
      toRow: (): FillMapResult => ({ ok: false, reason: 'unknown chain "doge"' }),
    });
    await createPoller(deps).runOnce();
    expect(deps.insertFill).not.toHaveBeenCalled();
    expect(deps.log.warn).toHaveBeenCalledTimes(1);
    expect(firstArg(deps.log.warn)).toBe('solver-fills: skipping trade 104: unknown chain "doge"');
    expect(cursorWrites).toEqual([105]);
  });

  it('warns once per reason for trades the client skipped as malformed, ignoring ones at or below the cursor', async () => {
    const reason = 'amount_out must be a finite number';
    const { deps, cursorWrites, inserted } = makeDeps(
      [
        pageOf([106, 105, 104, 103], {
          skipped: [
            { id: 106, reason },
            { id: 105, reason },
            { id: 103, reason },
          ],
        }),
      ],
      103,
    );
    await createPoller(deps).runOnce();
    expect(inserted()).toEqual(['h104']);
    expect(deps.log.warn).toHaveBeenCalledTimes(1);
    expect(firstArg(deps.log.warn)).toContain('skipping trade 106');
    expect(firstArg(deps.log.log)).toBe('solver-fills: wrote=1 skipped_existing=0 unmapped=2');
    expect(cursorWrites).toEqual([106]);
  });

  it('throws when has_more is true but next_cursor is null', async () => {
    const broken = { ...pageOf([110, 109], { hasMore: true }), nextCursor: null };
    const { deps, cursorWrites } = makeDeps([broken], 100);
    await expect(createPoller(deps).runOnce()).rejects.toThrow('has_more is true but next_cursor is null');
    expect(cursorWrites).toEqual([]);
  });

  it('throws when next_cursor does not move back', async () => {
    const { deps, cursorWrites } = makeDeps(
      [pageOf([110, 109], { hasMore: true }), pageOf([110, 109], { hasMore: true })],
      100,
    );
    await expect(createPoller(deps).runOnce()).rejects.toThrow('next_cursor 109 did not move back from before_id 109');
    expect(cursorWrites).toEqual([]);
  });

  it('propagates fetch errors without touching the cursor', async () => {
    const { deps, cursorWrites } = makeDeps([], 100, {
      fetchPage: async () => {
        throw new Error('502');
      },
    });
    await expect(createPoller(deps).runOnce()).rejects.toThrow('502');
    expect(cursorWrites).toEqual([]);
  });
});
