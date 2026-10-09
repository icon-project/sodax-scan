import { parseIsoMs, type FillsPage, type FillsQuery, type SolverFill } from './client';
import type { FillMapResult, SolverFillRow } from './format';

export interface PollerDeps {
  fetchPage(q: FillsQuery): Promise<FillsPage>;
  toRow(fill: SolverFill): FillMapResult;
  insertFill(row: SolverFillRow): Promise<boolean>;
  readCursor(): Promise<string | null>;
  writeCursor(lastTimestamp: string): Promise<void>;
  /** ISO timestamp used when no cursor file exists. */
  startFrom: string;
  log: Pick<Console, 'log' | 'warn' | 'error'>;
}

export function createPoller(deps: PollerDeps): { runOnce(): Promise<void> } {
  const warnedReasons = new Set<string>();
  // Fills already processed at the cursor's exact timestamp. `from` is
  // inclusive, so the backend returns them again on every tick; skipping them
  // here keeps repeat ticks quiet. In memory only: after a restart the first
  // tick refetches them once and the insert's NOT EXISTS guard drops them.
  let boundary: { timestamp: string; hashes: Set<string> } | null = null;

  function rememberBoundary(cursorTs: string, fills: SolverFill[]) {
    if (boundary?.timestamp !== cursorTs) boundary = { timestamp: cursorTs, hashes: new Set() };
    for (const f of fills) if (f.timestamp === cursorTs) boundary.hashes.add(f.intentHash);
  }

  function warnOnce(reason: string, intentHash: string | null) {
    if (warnedReasons.has(reason)) return;
    warnedReasons.add(reason);
    deps.log.warn(`solver-fills: skipping fill ${intentHash ?? '<no intent_hash>'}: ${reason}`);
  }

  async function processPage(page: FillsPage): Promise<void> {
    let wrote = 0;
    let skippedExisting = 0;
    let unmapped = 0;
    let failures = 0;
    for (const skipped of page.skipped) {
      // Skipped, not retried: the backend will send the same malformed shape
      // again, and retrying would pin the cursor forever.
      unmapped++;
      warnOnce(skipped.reason, skipped.intentHash);
    }
    for (const fill of page.fills) {
      if (boundary && fill.timestamp === boundary.timestamp && boundary.hashes.has(fill.intentHash)) {
        skippedExisting++;
        continue;
      }
      const mapped = deps.toRow(fill);
      if (!mapped.ok) {
        // Skipped, not retried: an unknown chain stays unknown until
        // configs.ts changes, and retrying would pin the cursor forever.
        unmapped++;
        warnOnce(mapped.reason, fill.intentHash);
        continue;
      }
      try {
        console.log(mapped.row)
        if (await deps.insertFill(mapped.row)) wrote++;
        else skippedExisting++;
      } catch (err) {
        failures++;
        deps.log.error(`solver-fills: insert failed for fill ${fill.intentHash}:`, err);
      }
    }
    if (wrote > 0 || unmapped > 0) {
      deps.log.log(`solver-fills: wrote=${wrote} skipped_existing=${skippedExisting} unmapped=${unmapped}`);
    }
    // Inserts are idempotent, so the whole page replays safely next tick.
    if (failures > 0) {
      throw new Error(`solver-fills: ${failures}/${page.fills.length} fill(s) failed, not advancing cursor`);
    }
  }

  async function runOnce(): Promise<void> {
    const savedCursor = await deps.readCursor();
    // `from` is inclusive: fills at the saved cursor's timestamp come back
    // each tick and are dropped via `boundary`.
    let from: string;
    let cursorTs = savedCursor;
    // Tracks the newest cursor written so far, so a page that ends at or
    // before it never rewrites the cursor or moves it backwards. Starts at
    // the saved cursor's time, or unbounded (null) on a first run.
    let highWaterMs: number | null = null;
    if (savedCursor === null) {
      from = deps.startFrom;
    } else {
      const ms = parseIsoMs(savedCursor);
      if (Number.isNaN(ms)) {
        throw new Error(`solver-fills: saved cursor "${savedCursor}" is not a valid timestamp`);
      }
      from = savedCursor;
      highWaterMs = ms;
    }
    let cursor: string | undefined;
    for (;;) {
      const page = await deps.fetchPage({ from, cursor });
      await processPage(page);
      // Pages are validated as order=asc, so lastTimestamp (from the raw
      // page) is the newest, even when the last fill itself was skipped.
      if (page.lastTimestamp !== null) {
        const tsMs = parseIsoMs(page.lastTimestamp);
        if (!Number.isNaN(tsMs) && (highWaterMs === null || tsMs > highWaterMs)) {
          await deps.writeCursor(page.lastTimestamp);
          highWaterMs = tsMs;
          cursorTs = page.lastTimestamp;
        }
      }
      if (cursorTs !== null) rememberBoundary(cursorTs, page.fills);
      if (!page.hasMore || !page.nextCursor) return;
      if (page.nextCursor === cursor) {
        throw new Error('solver-fills: backend returned the same next_cursor twice, stopping pagination');
      }
      cursor = page.nextCursor;
    }
  }

  return { runOnce };
}
