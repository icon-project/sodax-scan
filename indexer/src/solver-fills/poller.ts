import type { MarketTrade, SkippedTrade, TradesPage, TradesQuery } from './client';
import type { FillMapResult, SolverMarketPlaceFillRow } from './format';

export interface PollerDeps {
  fetchPage(q: TradesQuery): Promise<TradesPage>;
  toRow(trade: MarketTrade): FillMapResult;
  insertFill(row: SolverMarketPlaceFillRow): Promise<boolean>;
  readCursor(): Promise<number | null>;
  writeCursor(lastId: number): Promise<void>;
  log: Pick<Console, 'log' | 'warn' | 'error'>;
}

export function createPoller(deps: PollerDeps): { runOnce(): Promise<void> } {
  const warnedReasons = new Set<string>();

  function warnOnce(reason: string, message: string) {
    if (warnedReasons.has(reason)) return;
    warnedReasons.add(reason);
    deps.log.warn(`solver-fills: ${message}`);
  }

  // The backend pages newest-first by id (before_id) and ignores `from`, so
  // finding everything newer than the cursor means walking back until a page
  // reaches it.
  async function collectSince(
    lastId: number,
    first: TradesPage,
  ): Promise<{ trades: MarketTrade[]; skipped: SkippedTrade[] }> {
    const trades: MarketTrade[] = [];
    const skipped: SkippedTrade[] = [];
    let page = first;
    let beforeId: number | null = null;
    for (;;) {
      trades.push(...page.trades.filter(t => t.id > lastId));
      skipped.push(...page.skipped.filter(s => s.id > lastId));
      if (page.oldestId === null || page.oldestId <= lastId || !page.hasMore) return { trades, skipped };
      if (page.nextCursor === null) throw new Error('solver-fills: has_more is true but next_cursor is null');
      if (beforeId !== null && page.nextCursor >= beforeId) {
        throw new Error(`solver-fills: next_cursor ${page.nextCursor} did not move back from before_id ${beforeId}`);
      }
      beforeId = page.nextCursor;
      page = await deps.fetchPage({ beforeId });
    }
  }

  async function runOnce(): Promise<void> {
    const lastId = await deps.readCursor();
    const first = await deps.fetchPage({});
    if (first.newestId === null) return;

    // First run: start after the newest trade; nothing older is imported.
    if (lastId === null) {
      await deps.writeCursor(first.newestId);
      deps.log.log(`solver-fills: no cursor, starting after trade ${first.newestId}`);
      return;
    }
    if (first.newestId < lastId) {
      warnOnce(
        'cursor-ahead',
        `saved cursor ${lastId} is ahead of the newest trade ${first.newestId}, waiting for the backend to pass it`,
      );
      return;
    }
    if (first.newestId === lastId) return;

    const { trades, skipped } = await collectSince(lastId, first);
    let wrote = 0;
    let skippedExisting = 0;
    let unmapped = skipped.length;
    let failures = 0;
    for (const s of skipped) {
      // Skipped, not retried: the backend will send the same malformed shape
      // again, and retrying would pin the cursor forever.
      warnOnce(s.reason, `skipping trade ${s.id}: ${s.reason}`);
    }
    for (const trade of trades.sort((a, b) => a.id - b.id)) {
      const mapped = deps.toRow(trade);
      if (!mapped.ok) {
        // Skipped, not retried: an unknown chain stays unknown until
        // configs.ts changes, and retrying would pin the cursor forever.
        unmapped++;
        warnOnce(mapped.reason, `skipping trade ${trade.id}: ${mapped.reason}`);
        continue;
      }
      try {
        if (await deps.insertFill(mapped.row)) wrote++;
        else skippedExisting++;
      } catch (err) {
        failures++;
        deps.log.error(`solver-fills: insert failed for trade ${trade.id} (${trade.txHash}):`, err);
      }
    }
    if (wrote > 0 || unmapped > 0) {
      deps.log.log(`solver-fills: wrote=${wrote} skipped_existing=${skippedExisting} unmapped=${unmapped}`);
    }
    // Inserts are idempotent, so the whole range replays safely next tick.
    if (failures > 0) {
      throw new Error(
        `solver-fills: ${failures}/${trades.length} trade(s) failed, not advancing cursor past ${lastId}`,
      );
    }
    await deps.writeCursor(first.newestId);
  }

  return { runOnce };
}
