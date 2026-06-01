/**
 * Diagnostic for PR #128 review point P9: is the UNION ALL in db.js's
 * DEDUPED_MESSAGES actually expensive on prod-sized data, or is Postgres
 * pushing predicates into both sides effectively?
 *
 * Runs EXPLAIN (ANALYZE, BUFFERS) for the four query shapes the API uses:
 *   1. Unfiltered list page (most-common request)
 *   2. Filtered list (status + src_network)
 *   3. Search by intent_tx_hash
 *   4. Count for total_messages stat
 *
 * Read-only. Each query runs with LIMIT to bound the cost.
 *
 * Usage:
 *   bun run scripts/explain-unified-queries.ts
 *
 * Read the plans for:
 *   - Sequential Scan on either table → missing index or planner skipping it
 *   - Append node merging both branches → expected; check the *total* time
 *   - Buffers: shared hit/read → real I/O cost
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

// Keep this in sync with api/db.js DEDUPED_MESSAGES. Duplicated rather than
// imported because the API module pulls in app config.
const DEDUPED_MESSAGES = `(
    SELECT m.*
      FROM messages m
     WHERE NOT (
        m.sn IS NULL
        AND m.action_type IN ('IntentFilled', 'CancelIntent')
        AND EXISTS (
            SELECT 1 FROM messages r
             WHERE r.src_tx_hash = m.src_tx_hash
               AND r.action_type = m.action_type
               AND r.sn IS NOT NULL
        )
     )
) m`;

type Probe = { label: string; sql: string; params?: any[] };

const probes: Probe[] = [
  {
    label: '1. unfiltered list page (skip=0 limit=20)',
    sql: `SELECT id, created_at FROM ${DEDUPED_MESSAGES}
          ORDER BY created_at DESC, sn DESC NULLS LAST
          OFFSET 0 LIMIT 20`,
  },
  {
    label: '2. filtered list (status=executed + src_network=146 sonic)',
    sql: `SELECT id FROM ${DEDUPED_MESSAGES}
          WHERE status = $1 AND src_network = ANY(string_to_array($2, ','))
          ORDER BY created_at DESC, sn DESC NULLS LAST
          LIMIT 20`,
    params: ['executed', '146'],
  },
  {
    label: '3. search by intent_tx_hash',
    // Substitute a real hash before running; this version returns nothing
    // but still exercises the index path.
    sql: `SELECT id FROM ${DEDUPED_MESSAGES}
          WHERE intent_tx_hash = $1
          ORDER BY src_block_timestamp DESC NULLS LAST`,
    params: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
  },
  {
    label: '4. total_messages count (no filters)',
    sql: `SELECT count(*) FROM ${DEDUPED_MESSAGES}`,
  },
];

async function main(): Promise<void> {
  for (const p of probes) {
    console.log(`\n=== ${p.label} ===`);
    const r = await pool.query(
      { text: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${p.sql}`, values: p.params },
    );
    for (const row of r.rows) console.log(row['QUERY PLAN']);
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
