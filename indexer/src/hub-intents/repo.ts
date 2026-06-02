import pool from '../db/db';

// Hub events go into the `messages` table with sn = NULL as the hub-origin
// marker. Only hub-native creates and intra-hub (src=dst=sonic) fills/cancels
// are written here; cross-chain fills/cancels are left to the upstream relayer.

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

// Insert a hub event as a messages row with sn = NULL. The WHERE NOT EXISTS
// clause makes re-processing the same block range a no-op.
export async function insertHubEventAsMessage(row: HubEventRow): Promise<void> {
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
           $9, $10, $11, $12,
           $4, $13
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $11
        AND action_type    = $9
        AND sn IS NULL
    )
  `;
  await pool.query(sql, [
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

export async function getCursor(name: string): Promise<number | null> {
  const r = await pool.query(`SELECT last_block FROM indexer_cursors WHERE name = $1`, [name]);
  if (r.rows.length === 0) return null;
  return Number(r.rows[0].last_block);
}

export async function setCursor(name: string, lastBlock: number): Promise<void> {
  await pool.query(
    `INSERT INTO indexer_cursors (name, last_block, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = EXCLUDED.updated_at`,
    [name, lastBlock, nowSec()],
  );
}
