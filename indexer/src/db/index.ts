import pool from './db';

export async function updateTransactionInfo(id: number, fee: string, actionType: string, actionText: string, intentTxHash: string, slippage = ''): Promise<void> {
  // console.log([fee, actionType, actionText, intentTxHash, slippage, id])
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const updateQuery = `
      UPDATE messages
      SET fee = $1,
        action_type = $2,
        action_detail = $3,
        intent_tx_hash = $4,
        slippage = $5
      WHERE id = $6     
    `;
    console.log(updateQuery)
    await client.query(updateQuery, [fee, actionType, actionText, intentTxHash, slippage, id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating transaction:', err);
    throw err;
  } finally {
    client.release();
  }
}
