/**
 * Remove hub-origin CreateIntent rows that duplicate an enriched relayer
 * CreateIntent for the same intent.
 *
 * For spoke-originated intents the creation is indexed twice: the relayer
 * writes the cross-chain message row and the hub poller writes the
 * on-chain IntentCreated event row. The poller now skips its row when the
 * relayer's is already enriched (insertHubEventAsMessage guard), but:
 *   - rows from before that guard exist, and
 *   - the guard can't catch the window where the relay row exists but
 *     isn't enriched yet (still 'SendMsg') at hub-insert time.
 * This sweep deletes those duplicates. Safe to re-run any time — e.g.
 * periodically, to mop up the race-window stragglers.
 *
 * A hub create row is deleted ONLY when an enriched relayer CreateIntent
 * with the same intent_tx_hash exists. Hub creates whose relay twin is
 * missing or stuck unenriched are kept — they're the only usable record
 * of the creation.
 *
 * Dry run by default — prints count + sample. Pass --apply to delete.
 */

import 'dotenv/config';
import { Pool } from 'pg';

const apply = process.argv.includes('--apply');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

const WHERE = `
  m.sn IS NULL
  AND m.action_type = 'CreateIntent'
  AND EXISTS (
    SELECT 1 FROM messages r
    WHERE r.intent_tx_hash = m.intent_tx_hash
      AND r.action_type    = 'CreateIntent'
      AND r.sn IS NOT NULL
  )
`;

async function main(): Promise<void> {
  const count = Number(
    (await pool.query(`SELECT count(*) AS n FROM messages m WHERE ${WHERE}`)).rows[0].n,
  );
  console.log(`duplicate hub creates in scope: ${count}`);

  const sample = await pool.query(
    `SELECT m.id, m.intent_tx_hash, LEFT(m.action_detail, 60) AS detail
       FROM messages m WHERE ${WHERE} ORDER BY m.id DESC LIMIT 5`,
  );
  for (const r of sample.rows) {
    console.log(`  id=${r.id} intent=${r.intent_tx_hash} ${r.detail}`);
  }

  if (!apply) {
    console.log('\nDry run — nothing deleted. Re-run with --apply to delete.');
    await pool.end();
    return;
  }

  const rs = await pool.query(`DELETE FROM messages m WHERE ${WHERE}`);
  console.log(`deleted ${rs.rowCount} row(s).`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
