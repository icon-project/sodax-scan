/**
 * One-shot cleanup for hub-origin rows clobbered by the enrichment stream.
 *
 * Before the sn-IS-NULL guard in main.ts, the stream re-parsed hub poller
 * rows and overwrote them with the parser's blank Transfer fallback
 * (action_type='Transfer', action_detail=''). That mutation also broke the
 * poller's WHERE NOT EXISTS dedupe (keyed on action_type), so replays
 * inserted duplicates which were then clobbered too.
 *
 * No legitimate writer produces this combination: the poller only writes
 * CreateIntent / IntentFilled / CancelIntent with sn=NULL, and relayer rows
 * always have sn set. Verified against prod: every matching row has a blank
 * action_detail.
 *
 * Deletes rows matching ALL of:
 *   - sn IS NULL                     (hub-origin marker)
 *   - action_type = 'Transfer'       (parser fallback label)
 *   - action_detail empty or NULL    (extra guard; always true in practice)
 *
 * Dry run by default — prints count + sample. Pass --apply to delete.
 *
 * Run AFTER deploying the main.ts fix, else the stream re-clobbers fresh
 * poller rows and new junk accumulates. After deleting, reset the hub
 * poller cursor (.cursors/sonic_hub_intents.json) so the poller replays
 * and re-inserts any legit hub rows that were lost to clobbering —
 * inserts are idempotent, intact rows are skipped.
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
  sn IS NULL
  AND action_type = 'Transfer'
  AND (action_detail IS NULL OR action_detail = '')
`;

async function main(): Promise<void> {
  const count = Number(
    (await pool.query(`SELECT count(*) AS n FROM messages WHERE ${WHERE}`)).rows[0].n,
  );
  // Rows that match the first two conditions but carry a detail — should be
  // zero; anything here means an assumption broke and needs a human look.
  const withDetail = Number(
    (
      await pool.query(
        `SELECT count(*) AS n FROM messages
          WHERE sn IS NULL AND action_type = 'Transfer'
            AND action_detail IS NOT NULL AND action_detail != ''`,
      )
    ).rows[0].n,
  );

  console.log(`clobbered rows in scope: ${count}`);
  if (withDetail > 0) {
    console.error(
      `WARNING: ${withDetail} sn-NULL Transfer row(s) have a non-empty action_detail — ` +
        `not deleting those; inspect them manually.`,
    );
  }

  const sample = await pool.query(
    `SELECT id, intent_tx_hash, src_tx_hash, created_at
       FROM messages WHERE ${WHERE} ORDER BY id DESC LIMIT 5`,
  );
  for (const r of sample.rows) {
    console.log(`  id=${r.id} intent=${r.intent_tx_hash} src_tx=${r.src_tx_hash}`);
  }

  if (!apply) {
    console.log('\nDry run — nothing deleted. Re-run with --apply to delete.');
    await pool.end();
    return;
  }

  const rs = await pool.query(`DELETE FROM messages WHERE ${WHERE}`);
  console.log(`deleted ${rs.rowCount} row(s).`);
  console.log(
    'Now reset the hub poller cursor (.cursors/sonic_hub_intents.json) so the ' +
      'replay re-inserts the legit hub rows these clobbers replaced.',
  );
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
