import pool from '../db/db';

const CREATE_HUB_INTENT_EVENTS = `
  CREATE TABLE IF NOT EXISTS hub_intent_events (
    id                    BIGSERIAL PRIMARY KEY,
    intent_hash           VARCHAR(100) NOT NULL,
    event_type            VARCHAR(20)  NOT NULL,   -- created | filled | cancelled
    action_type           VARCHAR(30)  NOT NULL,   -- CreateIntent | IntentFilled | CancelIntent
    creator               VARCHAR(100),
    solver                VARCHAR(100),
    input_token           VARCHAR(100),
    output_token          VARCHAR(100),
    input_amount          VARCHAR(100),
    min_output_amount     VARCHAR(100),
    filled_output_amount  VARCHAR(100),
    src_chain_id          VARCHAR(20),
    dst_chain_id          VARCHAR(20),
    block_number          BIGINT,
    block_timestamp       BIGINT,
    tx_hash               VARCHAR(100),
    log_index             INTEGER,
    action_detail         TEXT,
    slippage              VARCHAR(50),
    created_at            BIGINT,
    updated_at            BIGINT,
    UNIQUE (tx_hash, log_index)
  );
`;

const HUB_INTENT_EVENTS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_hie_intent_hash  ON hub_intent_events(intent_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_hie_event_type   ON hub_intent_events(event_type);`,
  `CREATE INDEX IF NOT EXISTS idx_hie_creator      ON hub_intent_events(LOWER(creator));`,
  `CREATE INDEX IF NOT EXISTS idx_hie_tx_hash      ON hub_intent_events(tx_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_hie_block_ts     ON hub_intent_events(block_timestamp DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_hie_created_at   ON hub_intent_events(created_at DESC);`,
];

const CREATE_INDEXER_CURSORS = `
  CREATE TABLE IF NOT EXISTS indexer_cursors (
    name        VARCHAR(64) PRIMARY KEY,
    last_block  BIGINT NOT NULL,
    updated_at  BIGINT
  );
`;

const GRANT_TARGET_ROLE = process.env.HUB_INTENTS_DB_ROLE || 'v3_relayer';
const GRANTS = [
  `GRANT SELECT, INSERT ON hub_intent_events        TO ${GRANT_TARGET_ROLE};`,
  `GRANT SELECT, INSERT, UPDATE ON indexer_cursors  TO ${GRANT_TARGET_ROLE};`,
  `GRANT USAGE, SELECT ON SEQUENCE hub_intent_events_id_seq TO ${GRANT_TARGET_ROLE};`,
];

export async function ensureHubIntentsSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(CREATE_HUB_INTENT_EVENTS);
    for (const sql of HUB_INTENT_EVENTS_INDEXES) {
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

  // Best-effort cleanup of the superseded per-intent table. Runs isolated so a
  // missing-privilege error under a DML role doesn't undo the schema above.
  try {
    await pool.query('DROP TABLE IF EXISTS hub_intents;');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`hub-intents: skipped drop of legacy hub_intents (${msg})`);
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
