import pool from '../db/db';
import { readCursorFile, writeCursorFile } from '../cursor-file';
import type { SolverFillRow } from './format';

const CURSOR_NAME = 'solver_fills';
const ACTION_TYPE = 'SolverFill';

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Inserts a fill as a messages row with sn = NULL. Tx hashes, block number and
 * src/dest apps stay NULL: each would identify the source marketplace. The
 * NOT EXISTS guard makes cursor replays and the inclusive `from` boundary no-ops.
 */
export async function insertSolverFill(row: SolverFillRow): Promise<boolean> {
  const sql = `
    INSERT INTO messages (
      sn, status,
      src_network, src_block_timestamp,
      dest_network,
      action_type, action_detail, action_amount_usd, intent_tx_hash,
      created_at, updated_at
    )
    SELECT NULL, 'executed',
           $1, $2,
           $3,
           $4::varchar, $5, $6, $7::varchar,
           $2, $8
    WHERE NOT EXISTS (
      SELECT 1 FROM messages
      WHERE intent_tx_hash = $7::varchar
        AND action_type    = $4::varchar
    )
  `;
  const result = await pool.query(sql, [
    row.srcChainId,
    row.timestamp,
    row.dstChainId,
    ACTION_TYPE,
    row.actionDetail,
    row.amountUsd,
    row.intentHash,
    nowSec(),
  ]);
  return result.rowCount === 1;
}

export async function readFillsCursor(): Promise<string | null> {
  const parsed = (await readCursorFile(CURSOR_NAME)) as { lastTimestamp?: unknown } | null;
  return typeof parsed?.lastTimestamp === 'string' ? parsed.lastTimestamp : null;
}

export async function writeFillsCursor(lastTimestamp: string): Promise<void> {
  await writeCursorFile(CURSOR_NAME, { lastTimestamp, updatedAt: nowSec() });
}
