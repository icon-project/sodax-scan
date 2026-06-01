/**
 * One-shot migration for the hub-events-into-messages unification.
 *
 * Copies every row from `hub_intent_events` into `messages` with sn=NULL,
 * mapping columns as defined below. Idempotent — re-running is a no-op
 * because of the WHERE NOT EXISTS clause keyed on (intent_tx_hash,
 * action_type, sn IS NULL).
 *
 * Column mapping:
 *   intent_hash        → intent_tx_hash
 *   action_type        → action_type        (already in the same vocabulary)
 *   creator            → src_app
 *   solver             → dest_app
 *   src_chain_id       → src_network
 *   dst_chain_id       → dest_network
 *   block_number       → src_block_number
 *   block_timestamp    → src_block_timestamp AND created_at
 *   tx_hash            → src_tx_hash
 *   action_detail      → action_detail
 *   slippage           → slippage
 *   event_type=cancelled → status='rollbacked'
 *   event_type=created/filled → status='executed'
 *
 * After running and verifying, pass --drop-table to also drop the old
 * hub_intent_events table (and its indexes). The default leaves it intact
 * so it can be re-consulted or backed up before the final cleanup.
 *
 * Usage:
 *   bun run scripts/migrate-hub-events-to-messages.ts            # dry run
 *   bun run scripts/migrate-hub-events-to-messages.ts --apply    # do it
 *   bun run scripts/migrate-hub-events-to-messages.ts --apply --drop-table
 */
import 'dotenv/config';
import { Pool } from 'pg';

const apply = process.argv.includes('--apply');
const dropTable = process.argv.includes('--drop-table');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

const COPY_SQL = `
  INSERT INTO messages (
    sn, status,
    src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app,
    dest_network, dest_app,
    action_type, action_detail, intent_tx_hash, slippage,
    created_at, updated_at
  )
  SELECT
    NULL,
    CASE WHEN e.event_type = 'cancelled' THEN 'rollbacked' ELSE 'executed' END,
    e.src_chain_id, e.block_number, e.block_timestamp, e.tx_hash, e.creator,
    e.dst_chain_id, e.solver,
    e.action_type, e.action_detail, e.intent_hash, e.slippage,
    e.block_timestamp, $1
  FROM hub_intent_events e
  WHERE NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.intent_tx_hash = e.intent_hash
      AND m.action_type    = e.action_type
      AND m.sn IS NULL
  )
`;

const COUNT_SOURCE = `SELECT count(*) AS n FROM hub_intent_events`;
const COUNT_PENDING = `
  SELECT count(*) AS n
    FROM hub_intent_events e
   WHERE NOT EXISTS (
     SELECT 1 FROM messages m
     WHERE m.intent_tx_hash = e.intent_hash
       AND m.action_type    = e.action_type
       AND m.sn IS NULL
   )
`;

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT to_regclass($1) AS oid`,
    [name],
  );
  return r.rows[0].oid !== null;
}

async function main(): Promise<void> {
  if (!(await tableExists('hub_intent_events'))) {
    console.log('hub_intent_events does not exist — nothing to migrate.');
    await pool.end();
    return;
  }

  const total = Number((await pool.query(COUNT_SOURCE)).rows[0].n);
  const pending = Number((await pool.query(COUNT_PENDING)).rows[0].n);
  console.log(`hub_intent_events rows total: ${total}`);
  console.log(`rows that would be inserted : ${pending}`);
  console.log(`rows already in messages    : ${total - pending}`);

  if (!apply) {
    console.log('\nDry run — pass --apply to commit.');
    await pool.end();
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const rs = await pool.query(COPY_SQL, [nowSec]);
  console.log(`\nInserted ${rs.rowCount} row(s) into messages.`);

  if (dropTable) {
    console.log('\nDropping hub_intent_events table…');
    await pool.query(`DROP TABLE IF EXISTS hub_intent_events`);
    console.log('Dropped.');
  } else {
    console.log('\nLeaving hub_intent_events in place. Pass --drop-table to remove it once verified.');
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
