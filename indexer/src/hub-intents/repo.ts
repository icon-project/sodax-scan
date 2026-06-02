import { promises as fs } from 'fs';
import path from 'path';
import pool from '../db/db';

// Hub-native CreateIntent events are written directly into the `messages`
// table with `sn = NULL` as the hub-origin marker. Only IntentCreated is
// indexed here — fills/cancels are not recorded by the hub poller.

export interface HubEventRow {
  intentHash: string;
  actionType: 'CreateIntent';
  creator: string | null;
  solver: string | null;
  srcChainId: string;
  dstChainId: string;
  blockNumber: number;
  blockTimestamp: number;
  txHash: string;
  actionDetail: string;
  slippage: string | null;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// Insert a hub CreateIntent event as a messages row with sn=NULL. Idempotent:
// skips when a row for the same intent already exists (same intent_tx_hash +
// action_type). This makes re-processing safe when the cursor is reset and the
// same blocks are scanned again — no duplicate rows.
export async function insertHubEventAsMessage(row: HubEventRow): Promise<void> {
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
           $1, $2, $3, $4, $5,
           $6, $7,
           $8, $9, $10, $11,
           $3, $12
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $10
        AND action_type    = $8
    )
  `;
  await pool.query(sql, [
    row.srcChainId,
    row.blockNumber,
    row.blockTimestamp,
    row.txHash,
    row.creator,
    row.dstChainId,
    row.solver,
    row.actionType,
    row.actionDetail,
    row.intentHash,
    row.slippage,
    now,
  ]);
}

// Cursor persistence is file-based (a local JSON map of name -> last_block),
// not a DB table. Override the location with HUB_INTENT_CURSOR_FILE.
const CURSOR_FILE = process.env.HUB_INTENT_CURSOR_FILE
  || path.resolve(process.cwd(), 'hub-intents-cursor.json');

async function readCursorFile(): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(CURSOR_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    console.error(
      `hub-intents: cursor file unreadable (${CURSOR_FILE}) — treating as empty:`,
      err?.message ?? err,
    );
    return {};
  }
}

export async function getCursor(name: string): Promise<number | null> {
  const data = await readCursorFile();
  const v = data[name];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function setCursor(name: string, lastBlock: number): Promise<void> {
  const data = await readCursorFile();
  data[name] = lastBlock;
  // Write to a temp file then rename so a crash mid-write can't corrupt the
  // cursor (rename is atomic on the same filesystem).
  const tmp = `${CURSOR_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, CURSOR_FILE);
}
