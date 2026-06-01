/**
 * Backfill creator/solver on hub_intent_events fill/cancel rows.
 *
 * The IntentFilled and IntentCancelled events on the Sonic hub contract don't
 * carry creator or solver in their topics/data — those addresses only live on
 * the matching IntentCreated event. Before the fix in #128, the poller wrote
 * NULL into creator/solver for fill/cancel rows, which made them invisible to
 * the unified API's src_address / dest_address filters.
 *
 * This script repairs existing rows by copying creator/solver from the same
 * intent's CreateIntent sibling (linked by intent_hash). Rows whose created
 * sibling never made it into the table — e.g. the intent was created before
 * HUB_INTENT_START_BLOCK — are left alone; they were already orphans.
 *
 * Usage:
 *   bun run scripts/backfill-hub-creator-solver.ts            # dry-run (count)
 *   bun run scripts/backfill-hub-creator-solver.ts --apply    # commit
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

const SELECT_SQL = `
  SELECT t.id, c.creator, c.solver
    FROM hub_intent_events t
    JOIN hub_intent_events c
      ON c.intent_hash = t.intent_hash
     AND c.event_type = 'created'
   WHERE t.event_type IN ('filled', 'cancelled')
     AND (t.creator IS NULL OR t.solver IS NULL)
`;

const UPDATE_SQL = `
  UPDATE hub_intent_events t
     SET creator = COALESCE(t.creator, c.creator),
         solver  = COALESCE(t.solver,  c.solver),
         updated_at = $1
    FROM hub_intent_events c
   WHERE c.intent_hash = t.intent_hash
     AND c.event_type = 'created'
     AND t.event_type IN ('filled', 'cancelled')
     AND (t.creator IS NULL OR t.solver IS NULL)
`;

async function main(): Promise<void> {
  const preview = await pool.query(SELECT_SQL + ' LIMIT 5');
  const countRs = await pool.query(`SELECT count(*) FROM (${SELECT_SQL}) sq`);
  const total = Number(countRs.rows[0].count);

  console.log(`fill/cancel rows missing creator or solver: ${total}`);
  if (preview.rows.length > 0) {
    console.log('Sample rows that would be updated:');
    for (const r of preview.rows) {
      console.log(`  id=${r.id} creator=${r.creator} solver=${r.solver}`);
    }
  }

  if (!apply) {
    console.log('Dry run — pass --apply to commit.');
    await pool.end();
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const rs = await pool.query(UPDATE_SQL, [nowSec]);
  console.log(`Updated ${rs.rowCount} rows.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
