import { describe, it, expect, mock } from 'bun:test';
import { createPoller, type PollerDeps } from './poller';
import type { FillsPage, SolverFill } from './client';
import type { FillMapResult, SolverFillRow } from './format';

const fill = (ts: string, hash: string): SolverFill => ({
  timestamp: ts,
  intentHash: hash,
  receivedLegs: [{ label: 'TRX (Tron)', amount: 1 }],
  paidLegs: [{ label: 'USDT (Tron)', amount: 1 }],
  usdPaid: '1',
  unpricedLegs: 0,
});

const rowFor = (f: SolverFill): SolverFillRow => ({
  intentHash: f.intentHash, srcChainId: '1', dstChainId: '1', timestamp: 0, actionDetail: 'x', amountUsd: null,
});

function makeDeps(pages: FillsPage[], overrides: Partial<PollerDeps> = {}) {
  const queue = [...pages];
  const cursorWrites: string[] = [];
  const queries: unknown[] = [];
  const deps: PollerDeps = {
    fetchPage: mock(async (q) => {
      queries.push(q);
      return queue.shift() ?? { fills: [], skipped: [], lastTimestamp: null, hasMore: false, nextCursor: null };
    }),
    toRow: (f): FillMapResult => ({ ok: true, row: rowFor(f) }),
    insertFill: mock(async () => true),
    readCursor: async () => null,
    writeCursor: mock(async (ts: string) => { cursorWrites.push(ts); }),
    startFrom: '2026-10-01T00:00:00Z',
    log: { log: () => {}, warn: mock(() => {}), error: () => {} },
    ...overrides,
  };
  return { deps, cursorWrites, queries };
}

describe('solver-fills poller', () => {
  it('starts from startFrom when there is no cursor, and records the last fill time', async () => {
    const { deps, cursorWrites, queries } = makeDeps([
      { fills: [fill('2026-10-01T00:01:00Z', 'a'), fill('2026-10-01T00:02:00Z', 'b')], skipped: [], lastTimestamp: '2026-10-01T00:02:00Z', hasMore: false, nextCursor: null },
    ]);
    await createPoller(deps).runOnce();
    expect(queries).toEqual([{ from: '2026-10-01T00:00:00Z', cursor: undefined }]);
    expect(deps.insertFill).toHaveBeenCalledTimes(2);
    expect(cursorWrites).toEqual(['2026-10-01T00:02:00Z']);
  });

  it('resumes from the saved cursor exactly, in the backend format', async () => {
    const { deps, queries } = makeDeps([], { readCursor: async () => '2026-10-05T07:39:25.177740+00:00' });
    await createPoller(deps).runOnce();
    expect(queries).toEqual([{ from: '2026-10-05T07:39:25.177740+00:00', cursor: undefined }]);
  });

  it('does not move the saved cursor backwards: a page ending before it is not written, a later page past it is', async () => {
    const { deps, cursorWrites, queries } = makeDeps(
      [
        { fills: [fill('2026-10-05T07:30:00.000Z', 'a')], skipped: [], lastTimestamp: '2026-10-05T07:30:00.000Z', hasMore: true, nextCursor: 'c1' },
        { fills: [fill('2026-10-05T07:45:00.000Z', 'b')], skipped: [], lastTimestamp: '2026-10-05T07:45:00.000Z', hasMore: false, nextCursor: null },
      ],
      { readCursor: async () => '2026-10-05T07:39:25.177740+00:00' },
    );
    await createPoller(deps).runOnce();
    expect(queries).toEqual([
      { from: '2026-10-05T07:39:25.177740+00:00', cursor: undefined },
      { from: '2026-10-05T07:39:25.177740+00:00', cursor: 'c1' },
    ]);
    expect(cursorWrites).toEqual(['2026-10-05T07:45:00.000Z']);
  });

  it('skips fills at the cursor timestamp that an earlier tick already processed', async () => {
    const ts = '2026-10-05T09:58:26.123456+00:00';
    const { deps } = makeDeps([
      { fills: [fill(ts, 'a')], skipped: [], lastTimestamp: ts, hasMore: false, nextCursor: null },
      { fills: [fill(ts, 'a'), fill(ts, 'late'), fill('2026-10-05T09:59:00.000000+00:00', 'b')], skipped: [], lastTimestamp: '2026-10-05T09:59:00.000000+00:00', hasMore: false, nextCursor: null },
    ]);
    const poller = createPoller(deps);
    await poller.runOnce();
    await poller.runOnce();
    const inserted = (deps.insertFill as ReturnType<typeof mock>).mock.calls.map(([r]) => (r as SolverFillRow).intentHash);
    expect(inserted).toEqual(['a', 'late', 'b']);
  });

  it('throws without fetching when the saved cursor is not a valid timestamp', async () => {
    const { deps, queries } = makeDeps([], { readCursor: async () => 'not-a-timestamp' });
    await expect(createPoller(deps).runOnce()).rejects.toThrow(/saved cursor "not-a-timestamp" is not a valid timestamp/);
    expect(queries).toEqual([]);
  });

  it('follows next_cursor until has_more is false, saving after each page', async () => {
    const { deps, cursorWrites, queries } = makeDeps([
      { fills: [fill('2026-10-01T00:01:00Z', 'a')], skipped: [], lastTimestamp: '2026-10-01T00:01:00Z', hasMore: true, nextCursor: 'c1' },
      { fills: [fill('2026-10-01T00:02:00Z', 'b')], skipped: [], lastTimestamp: '2026-10-01T00:02:00Z', hasMore: false, nextCursor: null },
    ]);
    await createPoller(deps).runOnce();
    expect(queries).toEqual([
      { from: '2026-10-01T00:00:00Z', cursor: undefined },
      { from: '2026-10-01T00:00:00Z', cursor: 'c1' },
    ]);
    expect(cursorWrites).toEqual(['2026-10-01T00:01:00Z', '2026-10-01T00:02:00Z']);
  });

  it('stops pagination if the backend returns the same next_cursor twice', async () => {
    const { deps, cursorWrites } = makeDeps([
      { fills: [fill('2026-10-01T00:01:00Z', 'a')], skipped: [], lastTimestamp: '2026-10-01T00:01:00Z', hasMore: true, nextCursor: 'c1' },
      { fills: [fill('2026-10-01T00:02:00Z', 'b')], skipped: [], lastTimestamp: '2026-10-01T00:02:00Z', hasMore: true, nextCursor: 'c1' },
    ]);
    await expect(createPoller(deps).runOnce()).rejects.toThrow(/same next_cursor twice/);
    expect(cursorWrites).toEqual(['2026-10-01T00:01:00Z', '2026-10-01T00:02:00Z']);
  });

  it('leaves the cursor alone on an empty page', async () => {
    const { deps, cursorWrites } = makeDeps([{ fills: [], skipped: [], lastTimestamp: null, hasMore: false, nextCursor: null }]);
    await createPoller(deps).runOnce();
    expect(cursorWrites).toEqual([]);
  });

  it('does not write the cursor when lastTimestamp is unparseable, even with no high-water mark yet', async () => {
    const { deps, cursorWrites } = makeDeps([
      { fills: [fill('2026-10-01T00:01:00Z', 'a')], skipped: [], lastTimestamp: 'not-a-timestamp', hasMore: false, nextCursor: null },
    ]);
    await createPoller(deps).runOnce();
    expect(cursorWrites).toEqual([]);
  });

  it('does not advance the cursor when an insert fails, and throws', async () => {
    const { deps, cursorWrites } = makeDeps(
      [{ fills: [fill('2026-10-01T00:01:00Z', 'a'), fill('2026-10-01T00:02:00Z', 'b')], skipped: [], lastTimestamp: '2026-10-01T00:02:00Z', hasMore: false, nextCursor: null }],
      { insertFill: mock(async (r: SolverFillRow) => { if (r.intentHash === 'b') throw new Error('db down'); return true; }) },
    );
    await expect(createPoller(deps).runOnce()).rejects.toThrow(/1\/2 fill\(s\) failed/);
    expect(cursorWrites).toEqual([]);
  });

  it('skips unmappable fills, warns once per reason, and still advances', async () => {
    const { deps, cursorWrites } = makeDeps(
      [
        { fills: [fill('2026-10-01T00:01:00Z', 'a'), fill('2026-10-01T00:02:00Z', 'b')], skipped: [], lastTimestamp: '2026-10-01T00:02:00Z', hasMore: true, nextCursor: 'c1' },
        { fills: [fill('2026-10-01T00:03:00Z', 'c')], skipped: [], lastTimestamp: '2026-10-01T00:03:00Z', hasMore: false, nextCursor: null },
      ],
      { toRow: (): FillMapResult => ({ ok: false, reason: 'unknown chain "Dogecoin"' }) },
    );
    await createPoller(deps).runOnce();
    expect(deps.insertFill).not.toHaveBeenCalled();
    expect(deps.log.warn).toHaveBeenCalledTimes(1);
    expect((deps.log.warn as any).mock.calls[0][0]).toContain('skipping fill a:');
    expect(cursorWrites).toEqual(['2026-10-01T00:02:00Z', '2026-10-01T00:03:00Z']);
  });

  it('warns once per reason for fills the client skipped as malformed, even across pages, and still advances the cursor', async () => {
    const { deps, cursorWrites } = makeDeps([
      {
        fills: [fill('2026-10-01T00:01:00Z', 'a')],
        skipped: [{ intentHash: 'bad-1', reason: 'paid_legs[0].amount must be a finite number' }],
        lastTimestamp: '2026-10-01T00:01:00Z',
        hasMore: true,
        nextCursor: 'c1',
      },
      {
        fills: [fill('2026-10-01T00:02:00Z', 'b')],
        skipped: [{ intentHash: 'bad-2', reason: 'paid_legs[0].amount must be a finite number' }],
        lastTimestamp: '2026-10-01T00:02:00Z',
        hasMore: false,
        nextCursor: null,
      },
    ]);
    await createPoller(deps).runOnce();
    expect(deps.log.warn).toHaveBeenCalledTimes(1);
    expect((deps.log.warn as any).mock.calls[0][0]).toContain('bad-1');
    expect(cursorWrites).toEqual(['2026-10-01T00:01:00Z', '2026-10-01T00:02:00Z']);
  });

  it('formats a skipped fill with no intent_hash as <no intent_hash>', async () => {
    const { deps } = makeDeps([
      {
        fills: [fill('2026-10-01T00:01:00Z', 'a')],
        skipped: [{ intentHash: null, reason: 'intent_hash must be a non-empty string' }],
        lastTimestamp: '2026-10-01T00:01:00Z',
        hasMore: false,
        nextCursor: null,
      },
    ]);
    await createPoller(deps).runOnce();
    expect(deps.log.warn).toHaveBeenCalledTimes(1);
    expect((deps.log.warn as any).mock.calls[0][0]).toContain('<no intent_hash>');
  });

  it('propagates fetch errors without touching the cursor', async () => {
    const { deps, cursorWrites } = makeDeps([], { fetchPage: async () => { throw new Error('502'); } });
    await expect(createPoller(deps).runOnce()).rejects.toThrow('502');
    expect(cursorWrites).toEqual([]);
  });
});
