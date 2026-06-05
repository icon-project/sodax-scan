import * as fs from 'node:fs';
import * as path from 'node:path';
import pool from '../db/db';

// Hub events go into the `messages` table with sn = NULL as the hub-origin
// marker. Every event type skips its insert when the relayer already has
// an enriched row for the same event (see insertHubEventAsMessage);
// fills/cancels additionally are written only when intra-hub (dst=sonic),
// since cross-chain fill deliveries already land in messages via the
// relayer.

export interface HubEventRow {
  intentHash: string;
  eventType: 'created' | 'filled' | 'cancelled';
  actionType: 'CreateIntent' | 'IntentFilled' | 'CancelIntent';
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

// Subset of a CreateIntent row needed to enrich subsequent fill/cancel events
// (creator/solver for src_app/dest_app, chain ids + parseable action_detail
// for slippage and fill action_detail formatting).
export interface CreatedContext {
  creator: string | null;
  solver: string | null;
  srcChainId: string;
  dstChainId: string;
  actionDetail: string;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// Insert a hub event as a messages row with sn = NULL.
// Returns true when a row was written, false when a guard matched (no
// write). Lets the caller surface a write/skip ratio for monitoring.
//
// Two guards:
//   1. The same (intent_tx_hash, action_type, sn IS NULL) row already
//      exists — idempotency for cursor replays.
//   2. The relayer already has an enriched row for the same event (same
//      intent + action_type, sn IS NOT NULL) — a hub copy would only
//      duplicate it. An unenriched relay row (still 'SendMsg') does NOT
//      block the insert: enrichment can fail permanently (e.g. a stale
//      RPC), and then the hub row is the only usable record. The brief
//      window where the relay row exists but isn't enriched yet can still
//      produce a duplicate — updateTransactionInfo deletes the hub copy
//      when the relay row's enrichment lands.
export async function insertHubEventAsMessage(row: HubEventRow): Promise<boolean> {
  const status = row.eventType === 'cancelled' ? 'rollbacked' : 'executed';
  const now = nowSec();
  const sql = `
    INSERT INTO messages (
      sn, status,
      src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app,
      dest_network, dest_app,
      action_type, action_detail, intent_tx_hash, slippage,
      created_at, updated_at
    )
    SELECT NULL, $1,
           $2, $3, $4, $5, $6,
           $7, $8,
           $9::varchar, $10, $11::varchar, $12,
           $4, $13
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $11::varchar
        AND action_type    = $9::varchar
        AND sn IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $11::varchar
        AND action_type    = $9::varchar
        AND sn IS NOT NULL
    )
  `;
  const result = await pool.query(sql, [
    status,
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
  return result.rowCount === 1;
}

// Read CreatedContext for a single intent from its CreateIntent messages row.
// Returns null when the create hasn't been indexed yet (or never was — e.g.
// the intent was created before HUB_INTENT_START_BLOCK).
export async function getCreatedContext(intentHash: string): Promise<CreatedContext | null> {
  const r = await pool.query(
    `SELECT src_app, dest_app, src_network, dest_network, action_detail
       FROM messages
      WHERE intent_tx_hash = $1
        AND action_type    = 'CreateIntent'
        AND sn IS NULL
      LIMIT 1`,
    [intentHash],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    creator: row.src_app,
    solver: row.dest_app,
    srcChainId: row.src_network,
    dstChainId: row.dest_network,
    actionDetail: row.action_detail,
  };
}

// Batch variant of getCreatedContext: returns a Map keyed by intent_hash for
// every hash in `intentHashes` that has a hub-origin CreateIntent row.
// Hashes with no create are simply absent from the map.
export async function getCreatedContextsByIntentHashes(
  intentHashes: string[],
): Promise<Map<string, CreatedContext>> {
  const out = new Map<string, CreatedContext>();
  if (intentHashes.length === 0) return out;
  const unique = Array.from(new Set(intentHashes));
  const r = await pool.query(
    `SELECT intent_tx_hash, src_app, dest_app, src_network, dest_network, action_detail
       FROM messages
      WHERE intent_tx_hash = ANY($1)
        AND action_type    = 'CreateIntent'
        AND sn IS NULL`,
    [unique],
  );
  for (const row of r.rows) {
    out.set(row.intent_tx_hash, {
      creator: row.src_app,
      solver: row.dest_app,
      srcChainId: row.src_network,
      dstChainId: row.dest_network,
      actionDetail: row.action_detail,
    });
  }
  return out;
}

const CURSOR_DIR = process.env.HUB_INTENTS_CURSOR_DIR || path.resolve('.cursors');

function cursorPath(name: string): string {
  return path.join(CURSOR_DIR, `${name}.json`);
}

export async function getCursor(name: string): Promise<number | null> {
  try {
    const raw = await fs.promises.readFile(cursorPath(name), 'utf8');
    const parsed = JSON.parse(raw) as { lastBlock?: number };
    if (typeof parsed.lastBlock !== 'number' || !Number.isFinite(parsed.lastBlock)) return null;
    return parsed.lastBlock;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function setCursor(name: string, lastBlock: number): Promise<void> {
  // Write to a temp file then rename so a crash mid-write can't leave a
  // partial / corrupt JSON file behind.
  await fs.promises.mkdir(CURSOR_DIR, { recursive: true });
  const finalPath = cursorPath(name);
  const tmpPath = `${finalPath}.tmp`;
  const payload = JSON.stringify({ lastBlock, updatedAt: nowSec() });
  await fs.promises.writeFile(tmpPath, payload, 'utf8');
  await fs.promises.rename(tmpPath, finalPath);
}
