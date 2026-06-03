/**
 * Backfill messages.intent_tx_hash for intent fill/cancel legs that are missing it.
 *
 * Context: the indexer historically stored the intent hash only on some intent
 * messages. IntentFilled (and some CancelIntent) legs left intent_tx_hash blank,
 * so searching by intent hash couldn't surface them — even though the hash is the
 * universal key linking every leg of an intent (incl. hub-only creations).
 *
 * The handler fix now returns intentTxHash on those paths. This script applies the
 * same derivation to historical rows: re-read the source tx receipt, pull the
 * intent hash from the IntentFilled / IntentCancelled event log, and write it back.
 *
 * All such legs originate on Sonic, so this hammers the Sonic RPC ~once per row.
 * Concurrency + a QPS gate keep it polite; updates autocommit per row so an
 * interrupted run resumes cleanly (already-filled rows are skipped by the query).
 *
 * Usage:
 *   bun run scripts/backfill-intent-tx-hash.ts                       # dry-run, full table
 *   bun run scripts/backfill-intent-tx-hash.ts --apply               # commit, full table
 *   bun run scripts/backfill-intent-tx-hash.ts --apply --limit 500   # cap rows (testing)
 *   bun run scripts/backfill-intent-tx-hash.ts --apply --concurrency 8 --qps 6
 */
import "dotenv/config";
import { Pool } from "pg";
import { enrichChainsFromApi } from "../src/configs";
import { getHandler } from "../src/handler";

const TARGET_ACTIONS = ["IntentFilled", "CancelIntent"];

type Row = { id: number; sn: string | null; src_network: string; src_tx_hash: string };

function argNum(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i < 0) return fallback;
  const n = Number.parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) ? n : fallback;
}

// Spaces out RPC calls so combined traffic stays at or under `qps`, independent
// of how many workers are in flight.
function makeRpcGate(qps: number) {
  const minIntervalMs = Math.ceil(1000 / Math.max(1, qps));
  let chain: Promise<void> = Promise.resolve();
  let lastAt = 0;
  return function gate<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = Math.max(0, lastAt + minIntervalMs - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastAt = Date.now();
    });
    chain = run.catch(() => {});
    return run.then(fn);
  };
}

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

async function main() {
  const apply = process.argv.includes("--apply");
  const limit = argNum("--limit", 0); // 0 = no cap
  const concurrency = argNum("--concurrency", 4);
  const qps = argNum("--qps", 4);

  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log(`Scope: full table${limit ? ` (capped at ${limit})` : ""}`);
  console.log(`Concurrency: ${concurrency}, RPC QPS: ${qps}`);

  await enrichChainsFromApi();

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
    ssl: { rejectUnauthorized: false },
  });

  const selectSql = `
    SELECT id, sn, src_network, src_tx_hash
    FROM messages
    WHERE action_type = ANY($1)
      AND (intent_tx_hash IS NULL OR intent_tx_hash NOT LIKE '0x%')
      AND src_tx_hash IS NOT NULL
    ORDER BY id
    ${limit ? `LIMIT ${limit}` : ""}
  `;
  const rows = (await pool.query(selectSql, [TARGET_ACTIONS])).rows as Row[];
  console.log(`Rows to process: ${rows.length}`);

  const gate = makeRpcGate(qps);
  let scanned = 0;
  let updated = 0;
  let noHash = 0;
  let failed = 0;
  const sample: { id: number; hash: string }[] = [];

  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      scanned++;
      try {
        const payload = await gate(() =>
          getHandler(row.src_network).fetchPayload(row.src_tx_hash, String(row.sn ?? "")),
        );
        const hash = payload?.intentTxHash;
        if (!hash || !HASH_RE.test(hash)) {
          noHash++;
        } else {
          if (sample.length < 20) sample.push({ id: row.id, hash });
          if (apply) {
            await pool.query(
              `UPDATE messages SET intent_tx_hash = $1
                WHERE id = $2 AND (intent_tx_hash IS NULL OR intent_tx_hash NOT LIKE '0x%')`,
              [hash, row.id],
            );
          }
          updated++;
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        if (failed <= 20) console.warn(`  id ${row.id} failed: ${msg}`);
      }
      if (scanned % 500 === 0) {
        console.log(`  …${scanned}/${rows.length} (updated ${updated}, noHash ${noHash}, failed ${failed})`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  await pool.end();

  console.log(`\nScanned:  ${scanned}`);
  console.log(`Updated:  ${updated}${apply ? "" : " (would update)"}`);
  console.log(`No hash:  ${noHash}`);
  console.log(`Failed:   ${failed}`);
  console.log(`\nSample (first ${sample.length}):`);
  for (const s of sample) console.log(`  #${s.id} -> ${s.hash}`);
  if (!apply) console.log("\nDRY-RUN — no rows written. Re-run with --apply to commit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
