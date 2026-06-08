/**
 * Re-enrich relayer rows stuck at action_type='SendMsg'.
 *
 * The enrichment stream only looks at the newest LIMIT rows of
 * /api/messages — a row that fails enrichment (e.g. while OPTIMISM_URL
 * pointed at a node 17 days behind head, 2026-05-18 → 2026-06-04) scrolls
 * out of that window and is never retried. This script feeds those rows
 * back through the exact same enrichment path (parseTransactionEvent).
 *
 * Scope: sn IS NOT NULL (relayer rows only; hub rows are complete at
 * insert) AND action_type='SendMsg'. Optional filters:
 *   --network <id>    only this src_network (e.g. 24 for optimism)
 *   --dest <id>       only this dest_network (e.g. 18501 for hedera)
 *   --since <date>    only rows created on/after date (default 2026-05-18)
 *   --all             ignore --since, take every stuck row
 *   --limit <n>       stop after n rows (for a trial run)
 *
 * Rows whose tx still can't be parsed just stay SendMsg — the stream's
 * normal failure mode, safe to re-run.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { enrichChainsFromApi } from '../src/configs';
import { parseTransactionEvent } from '../src/main';
import type { SodaxScannerResponse } from '../src/types';

const args = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const network = argValue('--network');
const dest = argValue('--dest');
const since = argValue('--since') || '2026-05-18';
const all = args.includes('--all');
const limit = Number(argValue('--limit') || 0);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

async function main(): Promise<void> {
  await enrichChainsFromApi();

  const conditions = [`sn IS NOT NULL`, `action_type = 'SendMsg'`];
  const values: (string | number)[] = [];
  if (network) {
    values.push(network);
    conditions.push(`src_network = $${values.length}`);
  }
  if (dest) {
    values.push(dest);
    conditions.push(`dest_network = $${values.length}`);
  }
  if (!all) {
    values.push(Math.floor(new Date(since).getTime() / 1000));
    conditions.push(`created_at >= $${values.length}`);
  }

  const rs = await pool.query(
    `SELECT id, sn, src_network, dest_network, src_tx_hash, dest_tx_hash,
            action_type, intent_tx_hash
       FROM messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY id
      ${limit > 0 ? `LIMIT ${limit}` : ''}`,
    values,
  );
  console.log(`stuck rows in scope: ${rs.rows.length}`);

  let done = 0;
  for (const row of rs.rows) {
    // One row per call: parseTransactionEvent expects the API response
    // shape, and a failing row must not abort its neighbours (the function
    // catches per-row errors itself, this just keeps progress observable).
    await parseTransactionEvent({ data: [row] } as SodaxScannerResponse);
    done++;
    if (done % 50 === 0) console.log(`processed ${done}/${rs.rows.length}`);
  }

  const still = await pool.query(
    `SELECT count(*) AS n FROM messages WHERE ${conditions.join(' AND ')}`,
    values,
  );
  console.log(
    `done: ${rs.rows.length} processed, ${still.rows[0].n} still SendMsg (unparseable or retry-worthy).`,
  );
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
