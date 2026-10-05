import * as fs from 'node:fs';
import * as path from 'node:path';
import pool from '../db/db';
import { near } from '../configs';

// NEAR Intents marketplace fills (solver accounts filling swaps on
// intents.near) go into `messages` with sn = NULL, the same hub-origin-style
// marker hub-intents uses, but action_type = 'NearIntentFill' keeps them in a
// disjoint dedupe space from both hub-intents rows and relayer rows.

export interface NearIntentFillInsert {
  intentHash: string;
  accountId: string;
  blockHeight: number;
  blockTimestamp: number;
  receiptId: string;
  actionDetail: string;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// Idempotency key is (intent_tx_hash, action_type, src_app, sn IS NULL).
// The source table's own PK is (timestamp, intent_hash, account_id) — src_app
// carries account_id here, so this mirrors that PK (minus timestamp, which
// can't repeat for a fixed intent_hash+account_id pair anyway). Returns true
// when a row was written, false when the guard matched (no write), mirroring
// insertHubEventAsMessage's write/skip signal.
export async function insertNearIntentFillAsMessage(row: NearIntentFillInsert): Promise<boolean> {
  const now = nowSec();
  const sql = `
    INSERT INTO messages (
      sn, status,
      src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app,
      dest_network,
      action_type, action_detail, intent_tx_hash,
      created_at, updated_at
    )
    SELECT NULL, 'executed',
           $1, $2, $3, $4, $5,
           $1,
           'NearIntentFill', $6, $7::varchar,
           $3, $8
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $7::varchar
        AND action_type    = 'NearIntentFill'
        AND src_app        = $5
        AND sn IS NULL
    )
  `;
  const result = await pool.query(sql, [
    near,
    row.blockHeight,
    row.blockTimestamp,
    row.receiptId,
    row.accountId,
    row.actionDetail,
    row.intentHash,
    now,
  ]);
  return result.rowCount === 1;
}

// Resume state for the keyset cursor sodax-data-backend hands off. `cursor`
// is the opaque string to send on the next request; indexedThrough* are
// carried along purely for observability (how far the backend itself has
// scanned), not used for resume logic.
export interface NearIntentsCursorState {
  cursor: string | null;
  indexedThroughBlock: number | null;
  indexedThroughTime: number | null;
}

const CURSOR_DIR = process.env.NEAR_INTENTS_CURSOR_DIR || path.resolve('.cursors');
const CURSOR_NAME = 'near_intents_fills';

function cursorPath(): string {
  return path.join(CURSOR_DIR, `${CURSOR_NAME}.json`);
}

export async function getCursor(): Promise<NearIntentsCursorState | null> {
  try {
    const raw = await fs.promises.readFile(cursorPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<NearIntentsCursorState>;
    if (parsed.cursor !== null && typeof parsed.cursor !== 'string') return null;
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

export async function setCursor(state: NearIntentsCursorState): Promise<void> {
  // Write to a temp file then rename so a crash mid-write can't leave a
  // partial / corrupt JSON file behind (same pattern as hub-intents/repo.ts).
  await fs.promises.mkdir(CURSOR_DIR, { recursive: true });
  const finalPath = cursorPath();
  const tmpPath = `${finalPath}.tmp`;
  const payload = JSON.stringify({ ...state, updatedAt: nowSec() });
  await fs.promises.writeFile(tmpPath, payload, 'utf8');
  await fs.promises.rename(tmpPath, finalPath);
}
