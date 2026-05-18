import pool from '../db/db';

const CREATE_HUB_INTENTS = `
  CREATE TABLE IF NOT EXISTS hub_intents (
    id                          BIGSERIAL PRIMARY KEY,
    intent_hash                 VARCHAR(100) NOT NULL UNIQUE,
    creator                     VARCHAR(100),
    solver                      VARCHAR(100),
    input_token                 VARCHAR(100),
    output_token                VARCHAR(100),
    input_amount                VARCHAR(100),
    min_output_amount           VARCHAR(100),
    filled_output_amount        VARCHAR(100),
    src_chain_id                VARCHAR(20),
    dst_chain_id                VARCHAR(20),
    status                      VARCHAR(20) NOT NULL,
    created_block_number        BIGINT,
    created_block_timestamp     BIGINT,
    created_tx_hash             VARCHAR(100),
    filled_block_number         BIGINT,
    filled_block_timestamp      BIGINT,
    filled_tx_hash              VARCHAR(100),
    cancelled_block_number      BIGINT,
    cancelled_block_timestamp   BIGINT,
    cancelled_tx_hash           VARCHAR(100),
    slippage                    VARCHAR(50),
    action_detail               TEXT,
    created_at                  BIGINT,
    updated_at                  BIGINT
  );
`;

const HUB_INTENTS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_hub_intents_status        ON hub_intents(status);`,
  `CREATE INDEX IF NOT EXISTS idx_hub_intents_creator       ON hub_intents(LOWER(creator));`,
  `CREATE INDEX IF NOT EXISTS idx_hub_intents_created_tx    ON hub_intents(created_tx_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_hub_intents_filled_tx     ON hub_intents(filled_tx_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_hub_intents_cancelled_tx  ON hub_intents(cancelled_tx_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_hub_intents_created_at    ON hub_intents(created_at DESC);`,
];

const CREATE_INDEXER_CURSORS = `
  CREATE TABLE IF NOT EXISTS indexer_cursors (
    name        VARCHAR(64) PRIMARY KEY,
    last_block  BIGINT NOT NULL,
    updated_at  BIGINT
  );
`;

export async function ensureHubIntentsSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(CREATE_HUB_INTENTS);
    for (const sql of HUB_INTENTS_INDEXES) {
      await client.query(sql);
    }
    await client.query(CREATE_INDEXER_CURSORS);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
