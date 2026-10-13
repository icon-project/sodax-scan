import pool from '../db/db';
import { readCursorFile, writeCursorFile } from '../cursor-file';
import type { SolverMarketPlaceFillRow } from './format';

// Not 'solver_fills': that file holds the old timestamp cursor, and a fresh
// name makes the first run start from the newest trade instead of misreading it.
const CURSOR_NAME = 'solver_trades';
const ACTION_TYPE = 'SolverMarketPlaceFill';

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Inserts a fill as a messages row with sn = NULL. Tx hashes, block number and
 * src/dest apps stay NULL: each would identify the source marketplace. The
 * NOT EXISTS guard makes cursor replays and the inclusive `from` boundary no-ops.
 */
export async function insertSolverMarketPlaceFill(row: SolverMarketPlaceFillRow): Promise<boolean> {
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

/** Id of the newest trade already processed, or null when no cursor exists. A file without a valid lastId throws rather than silently restarting from the newest trade. */
export async function readFillsCursor(): Promise<number | null> {
  const parsed = (await readCursorFile(CURSOR_NAME)) as { lastId?: unknown } | null;
  if (parsed === null) return null;
  if (typeof parsed.lastId !== 'number' || !Number.isSafeInteger(parsed.lastId) || parsed.lastId <= 0) {
    throw new Error(`solver-fills: cursor file ${CURSOR_NAME}.json has invalid lastId ${JSON.stringify(parsed.lastId)}`);
  }
  return parsed.lastId;
}

export async function writeFillsCursor(lastId: number): Promise<void> {
  await writeCursorFile(CURSOR_NAME, { lastId, updatedAt: nowSec() });
}
