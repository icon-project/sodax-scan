import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../middlewares/logger';

dotenv.config();

export interface Message {
  id: string;
  sn: string;
  src_network: string;
  dest_network: string;
  src_tx_hash: string;
  dest_tx_hash: string;
  response_tx_hash: string;
  rollback_tx_hash: string;
  fee: string | null;
  action_type: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateData {
  fee?: string;
  action_type?: string;
}

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT) || 5432,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (error: Error) => {
      logger.error('Database pool error:', error);
    });
  }

  async getMessagesWithMissingData(limit: number = 100, lastProcessedId?: number): Promise<Message[]> {
    const query = lastProcessedId
      ? `SELECT * FROM messages WHERE id > $1 ORDER BY id LIMIT $2`
      : `SELECT * FROM messages ORDER BY id LIMIT $1`;
    
    const params = lastProcessedId ? [lastProcessedId, limit] : [limit];
    
    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching messages with missing data:', error);
      throw error;
    }
  }

  async updateMessageData(id: string, updateData: UpdateData): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.fee !== undefined) {
      fields.push(`fee = $${paramIndex++}`);
      values.push(updateData.fee);
    }

    if (updateData.action_type !== undefined) {
      fields.push(`action_type = $${paramIndex++}`);
      values.push(updateData.action_type);
    }

    if (fields.length === 0) {
      return false;
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);

    const query = `
      UPDATE messages 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `;

    try {
      const result = await this.pool.query(query, values);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Error updating message ${id}:`, error);
      throw error;
    }
  }

  async batchUpdateMessages(updates: Array<{ id: string; data: UpdateData }>): Promise<number> {
    const client: PoolClient = await this.pool.connect();
    let successCount = 0;

    try {
      await client.query('BEGIN');

      for (const update of updates) {
        try {
          const success = await this.updateMessageWithClient(client, update.id, update.data);
          if (success) successCount++;
        } catch (error) {
          logger.error(`Failed to update message ${update.id}:`, error);
        }
      }

      await client.query('COMMIT');
      return successCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Batch update failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateMessageWithClient(client: PoolClient, id: string, updateData: UpdateData): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.fee !== undefined) {
      fields.push(`fee = $${paramIndex++}`);
      values.push(updateData.fee);
    }

    if (updateData.action_type !== undefined) {
      fields.push(`action_type = $${paramIndex++}`);
      values.push(updateData.action_type);
    }

    if (fields.length === 0) {
      return false;
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);

    const query = `
      UPDATE messages 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `;

    logger.info(`Executing update query: ${query} with values: ${JSON.stringify(values)}`);
    const result = await client.query(query, values);
    logger.info(`Update result: rowCount=${result.rowCount}`);
    return (result.rowCount ?? 0) > 0;
  }

  async getMessageById(messageId: string): Promise<Message | null> {
    const query = `
      SELECT id, sn, src_network, dest_network, src_tx_hash, dest_tx_hash, 
             response_tx_hash, rollback_tx_hash, fee, action_type, created_at, updated_at
      FROM messages 
      WHERE id = $1
    `;
    
    try {
      const result = await this.pool.query(query, [messageId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error fetching message ${messageId}:`, error);
      throw error;
    }
  }

  async getMessageCount(): Promise<number> {
    try {
      const result = await this.pool.query('SELECT COUNT(*) as count FROM messages WHERE (fee IS NULL OR action_type IS NULL OR action_type = \'SendMsg\')');
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting message count:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const databaseService = new DatabaseService();