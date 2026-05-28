import pool from '../db/db';

export interface CreatedEventRow {
  intentHash: string;
  creator: string;
  solver: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  minOutputAmount: string;
  srcChainId: string;
  dstChainId: string;
  blockNumber: number;
  blockTimestamp: number;
  txHash: string;
  logIndex: number;
  actionDetail: string;
}

export interface FilledEventRow {
  intentHash: string;
  filledOutputAmount: string;
  srcChainId: string;
  dstChainId: string;
  slippage?: string;
  blockNumber: number;
  blockTimestamp: number;
  txHash: string;
  logIndex: number;
  actionDetail: string;
}

export interface CancelledEventRow {
  intentHash: string;
  srcChainId: string;
  dstChainId: string;
  blockNumber: number;
  blockTimestamp: number;
  txHash: string;
  logIndex: number;
  actionDetail: string;
}

// Subset of a created event needed to enrich later fill/cancel events
// (slippage baseline + token/chain context for action_detail formatting).
export interface CreatedContext {
  minOutputAmount: bigint | null;
  outputToken: string;
  inputToken: string;
  srcChainId: string;
  dstChainId: string;
}

const nowSec = () => Math.floor(Date.now() / 1000);

export async function insertCreatedEvent(row: CreatedEventRow): Promise<void> {
  const sql = `
    INSERT INTO hub_intent_events (
      intent_hash, event_type, action_type, creator, solver,
      input_token, output_token, input_amount, min_output_amount,
      src_chain_id, dst_chain_id, block_number, block_timestamp,
      tx_hash, log_index, action_detail, created_at, updated_at
    ) VALUES ($1,'created','CreateIntent',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
    ON CONFLICT (tx_hash, log_index) DO NOTHING
  `;
  await pool.query(sql, [
    row.intentHash,
    row.creator,
    row.solver,
    row.inputToken,
    row.outputToken,
    row.inputAmount,
    row.minOutputAmount,
    row.srcChainId,
    row.dstChainId,
    row.blockNumber,
    row.blockTimestamp,
    row.txHash,
    row.logIndex,
    row.actionDetail,
    nowSec(),
  ]);
}

export async function insertFilledEvent(row: FilledEventRow): Promise<void> {
  const sql = `
    INSERT INTO hub_intent_events (
      intent_hash, event_type, action_type, filled_output_amount,
      src_chain_id, dst_chain_id, block_number, block_timestamp,
      tx_hash, log_index, action_detail, slippage, created_at, updated_at
    ) VALUES ($1,'filled','IntentFilled',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
    ON CONFLICT (tx_hash, log_index) DO NOTHING
  `;
  await pool.query(sql, [
    row.intentHash,
    row.filledOutputAmount,
    row.srcChainId,
    row.dstChainId,
    row.blockNumber,
    row.blockTimestamp,
    row.txHash,
    row.logIndex,
    row.actionDetail,
    row.slippage ?? null,
    nowSec(),
  ]);
}

export async function insertCancelledEvent(row: CancelledEventRow): Promise<void> {
  const sql = `
    INSERT INTO hub_intent_events (
      intent_hash, event_type, action_type,
      src_chain_id, dst_chain_id, block_number, block_timestamp,
      tx_hash, log_index, action_detail, created_at, updated_at
    ) VALUES ($1,'cancelled','CancelIntent',$2,$3,$4,$5,$6,$7,$8,$9,$9)
    ON CONFLICT (tx_hash, log_index) DO NOTHING
  `;
  await pool.query(sql, [
    row.intentHash,
    row.srcChainId,
    row.dstChainId,
    row.blockNumber,
    row.blockTimestamp,
    row.txHash,
    row.logIndex,
    row.actionDetail,
    nowSec(),
  ]);
}

// Returns the created-event context for an intent, or null when we never
// indexed its creation (e.g. non-hub-origin intent, or created before
// START_BLOCK). Callers use null to skip orphan fill/cancel events.
export async function getCreatedContext(intentHash: string): Promise<CreatedContext | null> {
  const r = await pool.query(
    `SELECT min_output_amount, output_token, input_token, src_chain_id, dst_chain_id
       FROM hub_intent_events
      WHERE intent_hash = $1 AND event_type = 'created'
      LIMIT 1`,
    [intentHash],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  let minOutputAmount: bigint | null = null;
  if (row.min_output_amount !== null && row.min_output_amount !== undefined) {
    try {
      minOutputAmount = BigInt(row.min_output_amount);
    } catch {
      minOutputAmount = null;
    }
  }
  return {
    minOutputAmount,
    outputToken: row.output_token,
    inputToken: row.input_token,
    srcChainId: row.src_chain_id,
    dstChainId: row.dst_chain_id,
  };
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
