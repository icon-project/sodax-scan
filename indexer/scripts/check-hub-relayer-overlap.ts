/**
 * Diagnostic for PR #128 review point P4: does the same on-chain Sonic tx end
 * up in both `messages` (relayer-scanned) and `hub_intent_events` (hub
 * poller), producing duplicate rows in the unified API?
 *
 * Reports:
 *   1. Overlap count and a few sample tx hashes — if non-zero, dedup is needed
 *      in db.js UNIFIED_SUBQUERY.
 *   2. Breakdown by action_type pair, to see WHICH event types collide (helps
 *      decide whether to dedupe by tx_hash alone or by (tx_hash, action_type)).
 *
 * Read-only; safe to run anytime.
 *
 * Usage:
 *   bun run scripts/check-hub-relayer-overlap.ts
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
  const overlap = await pool.query(`
    SELECT count(*) AS n
      FROM messages m
      JOIN hub_intent_events h ON h.tx_hash = m.src_tx_hash
  `);
  console.log(`messages.src_tx_hash ∩ hub_intent_events.tx_hash : ${overlap.rows[0].n}`);

  const sample = await pool.query(`
    SELECT m.src_tx_hash, m.action_type AS msg_action, m.sn,
           h.action_type AS hub_action, h.event_type
      FROM messages m
      JOIN hub_intent_events h ON h.tx_hash = m.src_tx_hash
     ORDER BY m.id DESC
     LIMIT 10
  `);
  if (sample.rows.length > 0) {
    console.log('\nSample overlap rows (newest first):');
    for (const r of sample.rows) {
      console.log(
        `  tx=${r.src_tx_hash}  msg=${r.msg_action}(sn=${r.sn})  hub=${r.hub_action}(${r.event_type})`,
      );
    }
  }

  const byPair = await pool.query(`
    SELECT m.action_type AS msg_action, h.event_type AS hub_event, count(*) AS n
      FROM messages m
      JOIN hub_intent_events h ON h.tx_hash = m.src_tx_hash
     GROUP BY 1, 2
     ORDER BY n DESC
  `);
  if (byPair.rows.length > 0) {
    console.log('\nBreakdown by (messages.action_type, hub_intent_events.event_type):');
    for (const r of byPair.rows) {
      console.log(`  ${r.msg_action} ↔ ${r.hub_event} : ${r.n}`);
    }
  }

  // Also check the other direction: a hub tx_hash appearing as a relayer
  // dest_tx_hash. Less likely (hub events are single-tx on Sonic, no relay
  // dest leg) but worth confirming.
  const destOverlap = await pool.query(`
    SELECT count(*) AS n
      FROM messages m
      JOIN hub_intent_events h ON h.tx_hash = m.dest_tx_hash
  `);
  console.log(`\nmessages.dest_tx_hash ∩ hub_intent_events.tx_hash : ${destOverlap.rows[0].n}`);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
