/**
 * Remove hub-origin rows that duplicate an enriched relayer row for the
 * same event (same intent_tx_hash + action_type).
 *
 * Steady-state this can't happen anymore: the poller skips its insert
 * when the enriched relay row exists (insertHubEventAsMessage), and
 * enrichment deletes the hub copy when it lands after the poller wrote
 * one (updateTransactionInfo). This script is the one-time cleanup for
 * rows from before those guards, and an on-demand consistency check —
 * safe to re-run any time; in a healthy system it finds 0 rows.
 *
 * A hub row is deleted ONLY when an enriched relayer row with the same
 * intent_tx_hash and action_type exists. Hub rows whose relay twin is
 * missing or stuck unenriched are kept — they're the only usable record
 * of the event.
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
  AND EXISTS (
    SELECT 1 FROM messages r
    WHERE r.intent_tx_hash = m.intent_tx_hash
      AND r.action_type    = m.action_type
      AND r.sn IS NOT NULL
  )
`;

async function main(): Promise<void> {
  const byType = await pool.query(
    `SELECT m.action_type, count(*) AS n FROM messages m WHERE ${WHERE} GROUP BY 1 ORDER BY 2 DESC`,
  );
  const total = byType.rows.reduce((s, r) => s + Number(r.n), 0);
  console.log(`duplicate hub rows in scope: ${total}`);
  for (const r of byType.rows) console.log(`  ${r.action_type}: ${r.n}`);

  const sample = await pool.query(
    `SELECT m.id, m.action_type, m.intent_tx_hash, LEFT(m.action_detail, 50) AS detail
       FROM messages m WHERE ${WHERE} ORDER BY m.id DESC LIMIT 5`,
  );
  for (const r of sample.rows) {
    console.log(`  id=${r.id} ${r.action_type} intent=${r.intent_tx_hash} ${r.detail}`);
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
