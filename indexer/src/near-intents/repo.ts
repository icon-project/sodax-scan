import * as fs from 'node:fs';
import * as path from 'node:path';
import pool from '../db/db';
import { near } from '../configs';

// NEAR Intents marketplace fills (solver fills on intents.near, sourced from
// sodax-data-backend) land in `messages` with sn = NULL, same hub-origin
// marker convention as hub-intents, but action_type = 'SolverFill' keeps them
// distinct from both relay rows and hub-contract 'IntentFilled' rows.
//
// Per the resolved issue #151 discussion, the row is deliberately generic:
// no solver account_id, NEAR receipt_id, raw intent_hash text, token diff
// breakdown, or referral — those fingerprint the source marketplace/solver.
// Only intent_tx_hash (reused for dedupe/linking) and a direction+USD-size
// summary are kept.
export interface NearFillMessageRow {
  intentHash: string;
  blockNumber: number;
  blockTimestamp: number;
  actionDetail: string;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// Insert a NEAR Intents fill as a messages row with sn = NULL.
// Returns true when a row was written, false when the (intent_tx_hash,
// action_type) guard already matched — idempotency for cursor replays.
export async function insertNearIntentFillAsMessage(row: NearFillMessageRow): Promise<boolean> {
  const now = nowSec();
  const sql = `
    INSERT INTO messages (
      sn, status,
      src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app,
      dest_network, dest_app,
      action_type, action_detail, intent_tx_hash, slippage,
      created_at, updated_at
    )
    SELECT NULL, 'executed',
           $1, $2, $3, $4, NULL,
           $1, NULL,
           'SolverFill'::varchar, $5, $6::varchar, NULL,
           $3, $7
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $6::varchar
        AND action_type    = 'SolverFill'::varchar
    )
  `;
  const result = await pool.query(sql, [
    near,
    row.blockNumber,
    row.blockTimestamp,
    // src_tx_hash: empty, not NULL — the column is populated for every other
    // row type (see hub-intents/repo.ts). Left empty rather than the NEAR
    // receipt_id deliberately: per issue #151, the receipt_id would let
    // anyone click through to the raw on-chain fill (account, token diff)
    // this row is designed not to expose.
    '',
    row.actionDetail,
    row.intentHash,
    now,
  ]);
  return result.rowCount === 1;
}

// This poller's resume state: the opaque keyset cursor sodax-data-backend
// hands back (not seedable — see issue #151 discussion #4), plus the
// indexed_through watermark it reports alongside every page (for operator
// visibility only, not used for resume logic).
export interface NearIntentsCursorState {
  cursor: string | null;
  indexedThroughBlock: number | null;
  indexedThroughTime: string | null;
}

const CURSOR_DIR = process.env.NEAR_INTENTS_CURSOR_DIR || path.resolve('.cursors');

function cursorPath(name: string): string {
  return path.join(CURSOR_DIR, `${name}.json`);
}

export async function getCursor(name: string): Promise<NearIntentsCursorState | null> {
  try {
    const raw = await fs.promises.readFile(cursorPath(name), 'utf8');
    const parsed = JSON.parse(raw) as Partial<NearIntentsCursorState>;
    return {
      cursor: typeof parsed.cursor === 'string' ? parsed.cursor : null,
      indexedThroughBlock:
        typeof parsed.indexedThroughBlock === 'number' ? parsed.indexedThroughBlock : null,
      indexedThroughTime:
        typeof parsed.indexedThroughTime === 'string' ? parsed.indexedThroughTime : null,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function setCursor(name: string, state: NearIntentsCursorState): Promise<void> {
  // Write to a temp file then rename so a crash mid-write can't leave a
  // partial / corrupt JSON file behind — same pattern as hub-intents/repo.ts.
  await fs.promises.mkdir(CURSOR_DIR, { recursive: true });
  const finalPath = cursorPath(name);
  const tmpPath = `${finalPath}.tmp`;
  const payload = JSON.stringify({ ...state, updatedAt: nowSec() });
  await fs.promises.writeFile(tmpPath, payload, 'utf8');
  await fs.promises.rename(tmpPath, finalPath);
}
