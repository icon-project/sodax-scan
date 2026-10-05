import axios from 'axios';
import { getCursor, insertNearIntentFillAsMessage, setCursor } from './repo';
import type { NearFillRow, NearFillsPage, NearIntentLeg } from './types';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const DATA_BACKEND_URL = process.env.NEAR_INTENTS_DATA_BACKEND_URL;
const POLL_INTERVAL_MS = envInt('NEAR_INTENTS_POLL_INTERVAL_MS', 30_000);
const FILLS_PATH = '/v1/intents/near/fills';

function formatLegs(legs: NearIntentLeg[] | null | undefined): string {
  if (!legs || legs.length === 0) return '';
  return legs.map(leg => `${leg.amount} ${leg.token_id}`).join(', ');
}

// No raw-diff fallback: the backend's derived received_legs/paid_legs are
// already decimal-adjusted, and the raw `diff` field is per-token signed
// units this indexer has no decimals table for (NEAR token ids aren't in
// configs.ts' chain asset registry). If both legs are empty, fall back to
// identifying the fill by its receipt rather than guessing amounts.
function buildActionDetail(row: NearFillRow): string {
  const received = formatLegs(row.received_legs);
  const paid = formatLegs(row.paid_legs);
  const parts: string[] = [];
  if (received) parts.push(`received ${received}`);
  if (paid) parts.push(`paid ${paid}`);
  return parts.length > 0
    ? `NearIntentFill ${parts.join('; ')}`
    : `NearIntentFill receipt ${row.receipt_id}`;
}

async function fetchPage(cursor: string | null): Promise<NearFillsPage> {
  const response = await axios.get<NearFillsPage>(`${DATA_BACKEND_URL}${FILLS_PATH}`, {
    params: cursor ? { cursor } : undefined,
  });
  return response.data;
}

async function processPage(
  page: NearFillsPage,
): Promise<{ wrote: number; skippedExisting: number; failures: number }> {
  let wrote = 0;
  let skippedExisting = 0;
  let failures = 0;
  for (const row of page.fills) {
    try {
      const inserted = await insertNearIntentFillAsMessage({
        intentHash: row.intent_hash,
        accountId: row.account_id,
        blockHeight: row.block_height,
        blockTimestamp: row.timestamp,
        receiptId: row.receipt_id,
        actionDetail: buildActionDetail(row),
      });
      if (inserted) wrote++;
      else skippedExisting++;
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`near-intents: failed to process fill ${row.intent_hash}/${row.account_id}:`, msg);
    }
  }
  return { wrote, skippedExisting, failures };
}

export async function runOnce(): Promise<void> {
  if (!DATA_BACKEND_URL) {
    console.warn('near-intents: NEAR_INTENTS_DATA_BACKEND_URL not set — poller idle.');
    return;
  }

  const state = (await getCursor()) ?? {
    cursor: null,
    indexedThroughBlock: null,
    indexedThroughTime: null,
  };
  let cursor = state.cursor;

  // Loop pages until the backend reports has_more=false. Per the documented
  // contract, a fully caught-up response is an EMPTY page (fills=[],
  // next_cursor=null) — that terminal next_cursor is not a valid resume
  // point, so it's deliberately not persisted; the next poll tick just
  // re-requests the same last-known cursor again (cheap: it returns the same
  // empty page until new fills land).
  for (;;) {
    const page = await fetchPage(cursor);
    const { wrote, skippedExisting, failures } = await processPage(page);

    if (wrote > 0 || skippedExisting > 0) {
      console.log(`near-intents: wrote=${wrote} skipped_existing=${skippedExisting}`);
    }

    // Block cursor advance on any per-row failure, same rule as hub-intents:
    // inserts are idempotent, so the next tick safely replays this page.
    if (failures > 0) {
      throw new Error(
        `near-intents: ${failures}/${page.fills.length} fill(s) failed in this page — not advancing cursor`,
      );
    }

    if (page.has_more && !page.next_cursor) {
      throw new Error('near-intents: has_more=true but next_cursor is null — stopping to avoid an infinite loop');
    }

    if (page.next_cursor) {
      cursor = page.next_cursor;
      await setCursor({
        cursor,
        indexedThroughBlock: page.indexed_through?.block_height ?? state.indexedThroughBlock,
        indexedThroughTime: page.indexed_through?.time ?? state.indexedThroughTime,
      });
    }

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
