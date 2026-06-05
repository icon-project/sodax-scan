import pool from './db';

export async function updateTransactionInfo(id: number, fee: string, actionType: string, actionText: string, intentTxHash: string, slippage = '', blockNumber: number | null): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const updateQuery = `
      UPDATE messages
      SET fee = $1,
        action_type = $2,
        action_detail = $3,
        intent_tx_hash = $4,
        slippage = $5,
        src_block_number = $6
      WHERE id = $7
    `;
    await client.query(updateQuery, [fee, actionType, actionText, intentTxHash, slippage, blockNumber, id]);

    // This enrichment is the last writer for an intent event: the relayer
    // row is now the authoritative record, so a hub-poller copy of the
    // same event (sn IS NULL — only the poller writes those) is redundant.
    // Deleting it here, in the same transaction, closes the race the
    // poller's insert guard can't see: when the hub row landed before this
    // relay row was enriched. The opposite order is covered by the guard
    // in insertHubEventAsMessage.
    if (intentTxHash) {
      await client.query(
        `DELETE FROM messages
          WHERE sn IS NULL
            AND intent_tx_hash = $1
            AND action_type    = $2`,
        [intentTxHash, actionType],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating transaction:', err);
    throw err;
  } finally {
    client.release();
  }
}
