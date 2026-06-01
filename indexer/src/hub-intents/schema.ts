import pool from '../db/db';


const CREATE_INDEXER_CURSORS = `
  CREATE TABLE IF NOT EXISTS indexer_cursors (
    name        VARCHAR(64) PRIMARY KEY,
    last_block  BIGINT NOT NULL,
    updated_at  BIGINT
  );
`;

export async function ensureHubIntentsSchema(): Promise<void> {
  await pool.query(CREATE_INDEXER_CURSORS);
}
