import pool from '../db/db';

export interface CreatedRow {
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
  actionDetail: string;
}

export interface FilledRow {
  intentHash: string;
  filledOutputAmount: string;
  slippage?: string;
  blockNumber: number;
  blockTimestamp: number;
  txHash: string;
}

export interface CancelledRow {
  intentHash: string;
  blockNumber: number;
  blockTimestamp: number;
  txHash: string;
}

const nowSec = () => Math.floor(Date.now() / 1000);

export async function insertCreatedIntent(row: CreatedRow): Promise<void> {
  const sql = `
    INSERT INTO hub_intents (
      intent_hash, creator, solver, input_token, output_token,
      input_amount, min_output_amount, src_chain_id, dst_chain_id,
      status, created_block_number, created_block_timestamp, created_tx_hash,
      action_detail, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'created',$10,$11,$12,$13,$14,$14)
    ON CONFLICT (intent_hash) DO NOTHING
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
    row.actionDetail,
    nowSec(),
  ]);
}

export async function markIntentFilled(row: FilledRow): Promise<void> {
  const sql = `
    UPDATE hub_intents
       SET status                 = 'filled',
           filled_output_amount   = $2,
           slippage               = COALESCE($3, slippage),
           filled_block_number    = $4,
           filled_block_timestamp = $5,
           filled_tx_hash         = $6,
           updated_at             = $7
     WHERE intent_hash = $1
  `;
  await pool.query(sql, [
    row.intentHash,
    row.filledOutputAmount,
    row.slippage ?? null,
    row.blockNumber,
    row.blockTimestamp,
    row.txHash,
    nowSec(),
  ]);
}

export async function markIntentCancelled(row: CancelledRow): Promise<void> {
  const sql = `
    UPDATE hub_intents
       SET status                    = 'cancelled',
           cancelled_block_number    = $2,
           cancelled_block_timestamp = $3,
           cancelled_tx_hash         = $4,
           updated_at                = $5
     WHERE intent_hash = $1
  `;
  await pool.query(sql, [
    row.intentHash,
    row.blockNumber,
    row.blockTimestamp,
    row.txHash,
    nowSec(),
  ]);
}

export async function getMinOutputAmount(intentHash: string): Promise<bigint | null> {
  const r = await pool.query(
    `SELECT min_output_amount FROM hub_intents WHERE intent_hash = $1`,
    [intentHash],
  );
  if (r.rows.length === 0) return null;
  const v = r.rows[0].min_output_amount;
  if (v === null || v === undefined) return null;
  try {
    return BigInt(v);
  } catch {
    return null;
  }
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
