import axios from 'axios';
import { NearFillRow, NearFillsPage } from './types';
import { getCursor, insertNearIntentFillAsMessage, setCursor } from './repo';

const CURSOR_NAME = 'near_intents_fills';
const FILLS_PATH = '/v1/intents/near/fills';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const DATA_BACKEND_URL = (process.env.NEAR_INTENTS_DATA_BACKEND_URL || '').replace(/\/+$/, '');
const POLL_INTERVAL_MS = envInt('NEAR_INTENTS_POLL_INTERVAL_MS', 30_000);

async function fetchPage(cursor: string | null): Promise<NearFillsPage> {
  const params: Record<string, string> = {};
  // No `account` param: per issue #151 discussion #6, the backend defaults to
  // its own configured solver-account set when it's omitted — sodax-scan does
  // not duplicate or filter that allowlist itself.
  if (cursor) params.cursor = cursor;
  const { data } = await axios.get<NearFillsPage>(`${DATA_BACKEND_URL}${FILLS_PATH}`, { params });
  return data;
}

function toUnixSeconds(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

// Deliberately generic: no account_id, receipt_id, raw intent_hash, token
// diff, or referral — see repo.ts for why. direction/usd_* are derived,
// request-scoped fields the backend adds on top of the stored row.
function formatActionDetail(row: NearFillRow): string {
  const direction = row.direction === 'buy' || row.direction === 'sell' ? row.direction : 'swap';
  const usdRaw = row.usd_received ?? row.usd_paid ?? null;
  const usd = usdRaw != null ? Number(usdRaw) : Number.NaN;
  const usdPart = Number.isFinite(usd) ? ` $${usd.toFixed(2)}` : '';
  return `SolverFill ${direction}${usdPart}`;
}

async function handleRow(row: NearFillRow): Promise<boolean> {
  return insertNearIntentFillAsMessage({
    intentHash: row.intent_hash,
    blockNumber: row.block_height,
    blockTimestamp: toUnixSeconds(row.timestamp),
    actionDetail: formatActionDetail(row),
  });
}

// Same write/skip/failure accounting as hub-intents/poller.ts's
// processBatch: block cursor advance on any per-row failure (inserts are
// idempotent, so the next tick safely replays the whole page).
export async function processPage(page: NearFillsPage): Promise<void> {
  let failures = 0;
  let wrote = 0;
  let skippedExisting = 0;
  for (const row of page.fills) {
    try {
      const result = await handleRow(row);
      if (result) wrote++;
      else skippedExisting++;
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`near-intents: failed to process fill intent=${row.intent_hash}:`, msg);
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

let warnedMissingUrl = false;

async function runOnce(): Promise<void> {
  if (!DATA_BACKEND_URL) {
    if (!warnedMissingUrl) {
      console.error('near-intents: NEAR_INTENTS_DATA_BACKEND_URL is not set — poller idle');
      warnedMissingUrl = true;
    }
    return;
  }

  const state = await getCursor(CURSOR_NAME);
  let cursor = state?.cursor ?? null;
  for (;;) {
    const page = await fetchPage(cursor);
    await processPage(page);
    cursor = page.next_cursor;
    await setCursor(CURSOR_NAME, {
      cursor,
      indexedThroughBlock: page.indexed_through?.block_height ?? null,
      indexedThroughTime: page.indexed_through?.time ?? null,
    });
    if (!page.has_more) break;
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
