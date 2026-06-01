/**
 * Diagnostic for PR #128 review point P9: is the UNION ALL in db.js's
 * UNIFIED_SUBQUERY actually expensive on prod-sized data, or is Postgres
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

// Keep this in sync with api/db.js UNIFIED_SUBQUERY. Duplicated rather than
// imported because the API module pulls in app config.
const UNIFIED_SUBQUERY = `(
    SELECT
        id, sn, status, src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app, src_error,
        dest_network, dest_block_number, dest_block_timestamp, dest_tx_hash, dest_app, dest_error,
        response_block_number, response_block_timestamp, response_tx_hash, response_error,
        rollback_block_number, rollback_block_timestamp, rollback_tx_hash, rollback_error,
        value, fee, action_type, action_detail, action_amount_usd,
        created_at, updated_at, intent_tx_hash, slippage
    FROM messages
    UNION ALL
    SELECT
        -e.id AS id,
        NULL::bigint AS sn,
        (CASE WHEN e.event_type = 'cancelled' THEN 'rollbacked' ELSE 'executed' END)::varchar AS status,
        e.src_chain_id::varchar AS src_network,
        e.block_number          AS src_block_number,
        e.block_timestamp       AS src_block_timestamp,
        e.tx_hash::varchar      AS src_tx_hash,
        e.creator::varchar      AS src_app,
        NULL::varchar           AS src_error,
        e.dst_chain_id::varchar AS dest_network,
        NULL::bigint AS dest_block_number, NULL::bigint AS dest_block_timestamp,
        NULL::varchar AS dest_tx_hash, e.solver::varchar AS dest_app, NULL::varchar AS dest_error,
        NULL::bigint AS response_block_number, NULL::bigint AS response_block_timestamp,
        NULL::varchar AS response_tx_hash, NULL::varchar AS response_error,
        NULL::bigint AS rollback_block_number, NULL::bigint AS rollback_block_timestamp,
        NULL::varchar AS rollback_tx_hash, NULL::varchar AS rollback_error,
        NULL::varchar AS value, NULL::varchar AS fee,
        e.action_type::varchar AS action_type, e.action_detail::varchar AS action_detail,
        NULL::varchar AS action_amount_usd,
        COALESCE(e.block_timestamp, e.created_at) AS created_at,
        e.updated_at,
        e.intent_hash::varchar AS intent_tx_hash,
        e.slippage::varchar AS slippage
    FROM hub_intent_events e
    WHERE NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.src_tx_hash = e.tx_hash
          AND m.action_type = e.action_type::varchar
    )
) u`;

type Probe = { label: string; sql: string; params?: any[] };

const probes: Probe[] = [
  {
    label: '1. unfiltered list page (skip=0 limit=20)',
    sql: `SELECT id, created_at FROM ${UNIFIED_SUBQUERY}
          ORDER BY created_at DESC, sn DESC NULLS LAST
          OFFSET 0 LIMIT 20`,
  },
  {
    label: '2. filtered list (status=executed + src_network=146 sonic)',
    sql: `SELECT id FROM ${UNIFIED_SUBQUERY}
          WHERE status = $1 AND src_network = ANY(string_to_array($2, ','))
          ORDER BY created_at DESC, sn DESC NULLS LAST
          LIMIT 20`,
    params: ['executed', '146'],
  },
  {
    label: '3. search by intent_tx_hash',
    // Substitute a real hash before running; this version returns nothing
    // but still exercises the index path.
    sql: `SELECT id FROM ${UNIFIED_SUBQUERY}
          WHERE intent_tx_hash = $1
          ORDER BY src_block_timestamp DESC NULLS LAST`,
    params: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
  },
  {
    label: '4. total_messages count (no filters)',
    sql: `SELECT count(*) FROM ${UNIFIED_SUBQUERY}`,
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
