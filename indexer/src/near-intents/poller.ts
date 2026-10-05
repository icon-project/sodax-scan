import axios from 'axios';
import { getCursor, insertNearIntentFillAsMessage, setCursor } from './repo';
import { NearFillLeg, NearFillRow, NearFillsPage } from './types';

const CURSOR_NAME = 'near_intents_fills';
const FILLS_PATH = '/v1/intents/near/fills';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const DATA_BACKEND_URL = process.env.NEAR_INTENTS_DATA_BACKEND_URL || '';
const POLL_INTERVAL_MS = envInt('NEAR_INTENTS_POLL_INTERVAL_MS', 30_000);

// Fill timestamps may come back as unix seconds, unix milliseconds, or an
// ISO8601 string depending on the backend's serializer — normalise to unix
// seconds, the unit `messages.src_block_timestamp` uses elsewhere.
export function toUnixSeconds(value: number | string): number {
  if (typeof value === 'number') {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

function formatLegs(legs: NearFillLeg[] | undefined): string {
  if (!legs || legs.length === 0) return '';
  return legs.map(l => `${l.amount} ${l.token_id}`).join(', ');
}

function formatDiff(diff: Record<string, string>): string {
  return Object.entries(diff)
    .map(([token, amount]) => `${amount} ${token}`)
    .join(', ');
}

// received_legs/paid_legs are already decimal-adjusted by the API; `diff` is
// raw on-chain units with no per-token decimals available locally (NEAR
// token ids don't match this repo's EVM-keyed asset config), so it's only
// used as a last-resort label when the API omits the formatted legs.
export function describeFill(row: NearFillRow): string {
  const paid = formatLegs(row.paid_legs);
  const received = formatLegs(row.received_legs);
  if (paid || received) {
    return `NearIntentFill ${paid || 'none'} -> ${received || 'none'}`;
  }
  return `NearIntentFill ${formatDiff(row.diff)}`;
}

async function fetchPage(cursor: string | null): Promise<NearFillsPage> {
  if (!DATA_BACKEND_URL) {
    throw new Error('NEAR_INTENTS_DATA_BACKEND_URL is not configured');
  }
  const res = await axios.get<NearFillsPage>(`${DATA_BACKEND_URL}${FILLS_PATH}`, {
    params: cursor ? { cursor } : undefined,
  });
  return res.data;
}

// Mirrors hub-intents/poller.ts's processBatch: aggregate write/skip/failure
// counts for one page, and refuse to advance the cursor past a failed row
// (inserts are idempotent, so the next tick safely replays the whole page).
async function processPage(page: NearFillsPage): Promise<void> {
  let failures = 0;
  let wrote = 0;
  let skippedExisting = 0;
  for (const row of page.fills) {
    try {
      const result = await insertNearIntentFillAsMessage({
        intentHash: row.intent_hash,
        account: row.account_id,
        receiptId: row.receipt_id,
        blockHeight: row.block_height,
        blockTimestamp: toUnixSeconds(row.timestamp),
        actionDetail: describeFill(row),
      });
      if (result) wrote++;
      else skippedExisting++;
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`near-intents: failed to process fill ${row.receipt_id}:`, msg);
    }
  }
  if (wrote > 0 || skippedExisting > 0) {
    console.log(`near-intents: wrote=${wrote} skipped_existing=${skippedExisting}`);
  }
  if (failures > 0) {
    throw new Error(
      `near-intents: ${failures}/${page.fills.length} fill(s) failed — not advancing cursor`,
    );
  }
}

export async function runOnce(): Promise<void> {
  const state = await getCursor(CURSOR_NAME);
  let cursor = state?.cursor ?? null;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchPage(cursor);
    await processPage(page);
    hasMore = page.has_more;

    // An empty/caught-up page returns next_cursor: null with nothing to
    // resume from — keep the existing cursor file untouched rather than
    // overwriting it with null, which would restart ingestion from the very
    // beginning on the next tick. Only persist when the page actually had
    // rows (and so a usable next_cursor) to advance to.
    if (page.fills.length > 0 && page.next_cursor) {
      cursor = page.next_cursor;
      await setCursor(CURSOR_NAME, {
        cursor,
        indexedThroughBlock: page.indexed_through?.block_height ?? null,
        indexedThroughTime: page.indexed_through
          ? toUnixSeconds(page.indexed_through.time)
          : null,
      });
    }
  }
}

let running = false;
export function startNearIntentsFillsPoller(): NodeJS.Timeout {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (err) {
      console.error('near-intents: poll error:', err);
    } finally {
      running = false;
    }
  };
  // Fire immediately, then on interval.
  void tick();
  return setInterval(tick, POLL_INTERVAL_MS);
}
