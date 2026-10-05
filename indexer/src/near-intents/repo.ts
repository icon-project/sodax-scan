import * as fs from 'node:fs';
import * as path from 'node:path';
import pool from '../db/db';
import { near } from '../configs';

// NEAR Intents marketplace fills (e.g. sodax-mm filling swaps on
// intents.near) are not SODAX relay messages or Sonic hub events — they're
// ingested from sodax-data-backend's own index of that marketplace. Written
// into the existing `messages` table with sn = NULL (same hub-origin marker
// convention as hub-intents, see hub-intents/repo.ts:7-13) and a distinct
// action_type so they stay clearly distinguishable from both relay rows (sn
// set) and hub rows (other action_types with sn NULL).

export interface NearIntentFillMessageRow {
  intentHash: string;
  // Taker/solver account_id for this fill leg — the data-backend endpoint
  // defaults to its own configured solver accounts when no `account` filter
  // is passed, so every row ingested here is already solver-side.
  account: string;
  receiptId: string;
  blockHeight: number;
  blockTimestamp: number;
  actionDetail: string;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// Insert a NEAR Intents fill as a messages row with sn = NULL.
// Returns true when a row was written, false when the dedupe guard matched.
//
// The data-backend's own PK is (timestamp, intent_hash, account_id) — one
// row per participant per intent — so the guard keys on (intent_tx_hash,
// action_type, src_app) rather than just (intent_tx_hash, action_type) like
// insertHubEventAsMessage: a solver and a maker row for the same intent must
// not block each other.
export async function insertNearIntentFillAsMessage(
  row: NearIntentFillMessageRow,
): Promise<boolean> {
  const now = nowSec();
  const sql = `
    INSERT INTO messages (
      sn, status,
      src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app,
      dest_network, dest_app,
      action_type, action_detail, intent_tx_hash,
      created_at, updated_at
    )
    SELECT NULL, 'executed',
           $1, $2, $3, $4, $5,
           $1, NULL,
           'NearIntentFill', $6, $7,
           $3, $8
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $7::varchar
        AND action_type    = 'NearIntentFill'
        AND src_app         = $5
        AND sn IS NULL
    )
  `;
  const result = await pool.query(sql, [
    near,
    row.blockHeight,
    row.blockTimestamp,
    row.receiptId,
    row.account,
    row.actionDetail,
    row.intentHash,
    now,
  ]);
  return result.rowCount === 1;
}

const CURSOR_DIR = process.env.NEAR_INTENTS_CURSOR_DIR || path.resolve('.cursors');

function cursorPath(name: string): string {
  return path.join(CURSOR_DIR, `${name}.json`);
}

// This poller resumes via an opaque keyset cursor (not a block number like
// hub-intents), so it persists its own shape rather than reusing
// hub-intents/repo.ts's getCursor/setCursor. indexedThrough* is carried
// along purely for observability (how far the backend itself has scanned) —
// resuming only ever uses `cursor`.
export interface NearIntentsCursorState {
  cursor: string | null;
  indexedThroughBlock: number | null;
  indexedThroughTime: number | null;
}

export async function getCursor(name: string): Promise<NearIntentsCursorState | null> {
  try {
    const raw = await fs.promises.readFile(cursorPath(name), 'utf8');
    const parsed = JSON.parse(raw) as Partial<NearIntentsCursorState>;
    if (typeof parsed.cursor !== 'string' && parsed.cursor !== null) return null;
    return {
      cursor: parsed.cursor ?? null,
      indexedThroughBlock: parsed.indexedThroughBlock ?? null,
      indexedThroughTime: parsed.indexedThroughTime ?? null,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function setCursor(name: string, state: NearIntentsCursorState): Promise<void> {
  // Write to a temp file then rename so a crash mid-write can't leave a
  // partial / corrupt JSON file behind (same pattern as hub-intents/repo.ts).
  await fs.promises.mkdir(CURSOR_DIR, { recursive: true });
  const finalPath = cursorPath(name);
  const tmpPath = `${finalPath}.tmp`;
  const payload = JSON.stringify({ ...state, updatedAt: nowSec() });
  await fs.promises.writeFile(tmpPath, payload, 'utf8');
  await fs.promises.rename(tmpPath, finalPath);
}
