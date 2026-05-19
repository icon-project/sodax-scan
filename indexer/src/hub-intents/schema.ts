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

// Indexer in prod connects as a DML-only role (e.g. v3_relayer). When the
// schema is bootstrapped by an admin role once, these GRANTs make the tables
// usable from that DML role. Override target via env if your role differs.
const GRANT_TARGET_ROLE = process.env.HUB_INTENTS_DB_ROLE || 'v3_relayer';
const GRANTS = [
  `GRANT SELECT, INSERT, UPDATE ON hub_intents     TO ${GRANT_TARGET_ROLE};`,
  `GRANT SELECT, INSERT, UPDATE ON indexer_cursors TO ${GRANT_TARGET_ROLE};`,
  `GRANT USAGE, SELECT ON SEQUENCE hub_intents_id_seq TO ${GRANT_TARGET_ROLE};`,
];

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

  // GRANTs run in their own connection, each isolated. When the indexer runs
  // as the DML role itself, these all fail with "must be owner" — that's
  // fine, we log once and move on without rolling back the schema above.
  for (const sql of GRANTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`hub-intents: skipped grant (${msg}): ${sql.trim()}`);
    }
  }
}
