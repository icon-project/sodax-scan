/**
 * Pre-flight check for the hub-events-into-messages unification (the refactor
 * that drops the separate hub_intent_events table). Before adding a UNIQUE
 * constraint on (src_tx_hash, action_type) we need to be sure the existing
 * `messages` table doesn't already violate it. If it does, the migration
 * would fail half-way and we'd need to dedupe first.
 *
 * Reports:
 *   1. Count of (src_tx_hash, action_type) pairs that appear more than once
 *   2. The 10 noisiest offenders with their multiplicities
 *   3. Total rows-that-would-be-deleted-by-a-naive-dedupe (count - distinct)
 *   4. Same audit for (src_tx_hash, action_type) restricted to rows with
 *      action_type IN ('CreateIntent','IntentFilled','CancelIntent') — those
 *      are the ones the hub poller would write, so dupes there matter most.
 *
 * Read-only. Run from indexer/ with `bun run scripts/audit-messages-dupes.ts`.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

async function main(): Promise<void> {
  console.log('=== ALL action_types ===');

  const dupePairs = await pool.query(`
    SELECT count(*) AS pair_count, sum(n) - count(*) AS rows_to_dedupe
      FROM (
        SELECT src_tx_hash, action_type, count(*) AS n
          FROM messages
         WHERE src_tx_hash IS NOT NULL
         GROUP BY src_tx_hash, action_type
        HAVING count(*) > 1
      ) sq
  `);
  console.log(
    `(src_tx_hash, action_type) pairs with >1 row : ${dupePairs.rows[0].pair_count}`,
  );
  console.log(
    `total surplus rows (sum(n)-pair_count)       : ${dupePairs.rows[0].rows_to_dedupe ?? 0}`,
  );

  const samples = await pool.query(`
    SELECT src_tx_hash, action_type, count(*) AS n
      FROM messages
     WHERE src_tx_hash IS NOT NULL
     GROUP BY src_tx_hash, action_type
    HAVING count(*) > 1
     ORDER BY n DESC, src_tx_hash
     LIMIT 10
  `);
  if (samples.rows.length > 0) {
    console.log('\nWorst offenders:');
    for (const r of samples.rows) {
      console.log(`  ${r.src_tx_hash}  ${r.action_type}  ×${r.n}`);
    }
  }

  console.log('\n=== Hub-relevant action_types only (CreateIntent/IntentFilled/CancelIntent) ===');

  const hubDupes = await pool.query(`
    SELECT count(*) AS pair_count, sum(n) - count(*) AS rows_to_dedupe
      FROM (
        SELECT src_tx_hash, action_type, count(*) AS n
          FROM messages
         WHERE src_tx_hash IS NOT NULL
           AND action_type IN ('CreateIntent','IntentFilled','CancelIntent')
         GROUP BY src_tx_hash, action_type
        HAVING count(*) > 1
      ) sq
  `);
  console.log(
    `(src_tx_hash, action_type) pairs with >1 row : ${hubDupes.rows[0].pair_count}`,
  );
  console.log(
    `total surplus rows                          : ${hubDupes.rows[0].rows_to_dedupe ?? 0}`,
  );

  const hubSamples = await pool.query(`
    SELECT src_tx_hash, action_type, count(*) AS n
      FROM messages
     WHERE src_tx_hash IS NOT NULL
       AND action_type IN ('CreateIntent','IntentFilled','CancelIntent')
     GROUP BY src_tx_hash, action_type
    HAVING count(*) > 1
     ORDER BY n DESC, src_tx_hash
     LIMIT 10
  `);
  if (hubSamples.rows.length > 0) {
    console.log('\nHub-relevant offenders:');
    for (const r of hubSamples.rows) {
      console.log(`  ${r.src_tx_hash}  ${r.action_type}  ×${r.n}`);
    }
  } else {
    console.log('\n(no duplicates in hub-relevant action types — safe to constrain)');
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
