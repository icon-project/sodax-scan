/**
 * Backfill messages.action_detail (+ slippage) for IntentFilled rows whose
 * action_detail is the raw event tuple, e.g.
 *
 *   IntentFilled 0x8d24fbfc…,true,0,1640012973,false
 *
 * Those come from the EVM handler's fallback path (when decodeExecuteCalldata
 * fails) and dump the IntentFilled event tuple verbatim. The fourth field is
 * the raw filled output amount; with token decimals + name we can render it.
 *
 * Recovery source: the intent's sibling CreateIntent message (linked by
 * intent_tx_hash). Its action_detail
 *   "IntentSwap <inAmt> <inTok>(<src>) -> <outMin> <outTok>(<dst>)"
 * gives us output token + dst chain. Look up decimals from chains config,
 * format the filled raw value, and compute slippage from <outMin> vs filled.
 *
 * After the hub_intent_events → messages unification, hub-native creates
 * land in `messages` directly with sn=NULL, so the sibling lookup covers
 * both relayer creates and hub-native creates from one table. The previous
 * "hub_intent_events.filled" recovery path is gone.
 *
 * Rows still unlinked (intent_tx_hash blank) are skipped — they're picked up
 * by the existing backfill-intent-tx-hash.ts once that finishes.
 *
 * Usage:
 *   bun run scripts/backfill-fill-action-detail.ts                # dry-run
 *   bun run scripts/backfill-fill-action-detail.ts --apply        # commit
 *   bun run scripts/backfill-fill-action-detail.ts --apply --limit 200
 */
import "dotenv/config";
import { Pool } from "pg";
import { chains, enrichChainsFromApi, idToChainNameMap } from "../src/configs";
import { bigintDivisionToDecimalString } from "../src/utils";

const MALFORMED_RE = /^IntentFilled (0x[0-9a-fA-F]{64}),(true|false),(\d+),(\d+),(true|false)$/;
const CREATE_RE = /^IntentSwap\s+([0-9.]+)\s+(\S+?)\((\w+)\)\s*->\s*([0-9.]+)\s+(\S+?)\((\w+)\)\s*$/;

const chainNameToId: Record<string, string> = Object.fromEntries(
  Object.entries(idToChainNameMap).map(([id, name]) => [name, id]),
);

function decimalsForTokenName(chainId: string, tokenName: string): number | null {
  const assets = chains[chainId]?.Assets;
  if (!assets) return null;
  for (const addr of Object.keys(assets)) {
    if (assets[addr].name === tokenName) return assets[addr].decimals;
  }
  return null;
}

function decimalStringToBigInt(amount: string, decimals: number): bigint {
  const [intPart, fracPart = ""] = amount.split(".");
  const paddedFrac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const s = (intPart || "0") + paddedFrac;
  return BigInt(s);
}

// Mirrors hub poller's slippage format: 4 decimals, signed, "%" suffix.
function slippagePercent(expected: bigint, actual: bigint): string {
  if (expected === 0n) return "";
  const decimals = 4;
  const diff = actual - expected;
  const isNegative = diff < 0n;
  const absDiff = diff < 0n ? -diff : diff;
  const SCALE = BigInt(10 ** decimals);
  const scaled = (absDiff * SCALE * 100n) / expected;
  let s = scaled.toString();
  if (s.length <= decimals) s = s.padStart(decimals + 1, "0");
  const intPart = s.slice(0, s.length - decimals);
  const decPart = s.slice(s.length - decimals);
  return `${isNegative ? "-" : ""}${intPart}.${decPart}%`;
}

function argNum(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i < 0) return fallback;
  const n = Number.parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const limit = argNum("--limit", 0);

  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log(`Scope: full table${limit ? ` (capped at ${limit})` : ""}`);

  await enrichChainsFromApi();

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
    ssl: { rejectUnauthorized: false },
  });

  // Collect all updates in memory, then flush in batches. One UPDATE per row
  // round-trips per row; one batched UPDATE...FROM (VALUES ...) does the lot in
  // a single network hop. For ~13k rows that's seconds instead of minutes.
  type Update = { id: number; action_detail: string; slippage: string };
  const updates: Update[] = [];

  async function flush(batch: Update[]) {
    if (!apply || batch.length === 0) return;
    const placeholders: string[] = [];
    const params: (string | number)[] = [];
    let p = 1;
    for (const u of batch) {
      placeholders.push(`($${p++}::text, $${p++}::text, $${p++}::bigint)`);
      params.push(u.action_detail, u.slippage, u.id);
    }
    const sql = `
      UPDATE messages m
         SET action_detail = v.action_detail,
             slippage      = COALESCE(NULLIF(v.slippage, ''), m.slippage)
        FROM (VALUES ${placeholders.join(",")}) AS v(action_detail, slippage, id)
       WHERE m.id = v.id
    `;
    await pool.query(sql, params);
  }

  async function flushAll() {
    const CHUNK = 500;
    for (let i = 0; i < updates.length; i += CHUNK) {
      await flush(updates.slice(i, i + CHUNK));
      if ((i + CHUNK) % 5000 === 0 || i + CHUNK >= updates.length) {
        console.log(`  …flushed ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
      }
    }
  }

  // --------------- Recovery: sibling CreateIntent ---------------
  console.log(`Querying sibling-CreateIntent recoveries…`);
  const sibSql = `
    SELECT m.id, m.action_detail AS bad_detail, c.action_detail AS create_detail
    FROM messages m
    JOIN messages c ON c.action_type='CreateIntent' AND c.intent_tx_hash = m.intent_tx_hash
    WHERE m.action_type='IntentFilled'
      AND m.action_detail ~ '^IntentFilled 0x[0-9a-fA-F]{64},'
      AND m.intent_tx_hash LIKE '0x%'
      AND c.action_detail LIKE 'IntentSwap %'
    ${limit ? `LIMIT ${limit}` : ""}
  `;
  const sibRs = await pool.query(sibSql);
  console.log(`  sibling rows: ${sibRs.rows.length}`);

  let fixedFromSibling = 0;
  let unrecoverable = 0;
  const reasons: Record<string, number> = {};
  const sampleSib: { id: number; before: string; after: string; slippage?: string }[] = [];

  for (const row of sibRs.rows) {
    const fm = MALFORMED_RE.exec(row.bad_detail);
    if (!fm) { unrecoverable++; reasons["bad_detail_parse_failed"] = (reasons["bad_detail_parse_failed"] || 0) + 1; continue; }
    const filledRaw = BigInt(fm[4]);

    const cm = CREATE_RE.exec(row.create_detail);
    if (!cm) { unrecoverable++; reasons["create_detail_parse_failed"] = (reasons["create_detail_parse_failed"] || 0) + 1; continue; }
    const minOutputStr = cm[4];
    const outputTokenName = cm[5];
    const dstChainName = cm[6];

    const dstChainId = chainNameToId[dstChainName];
    if (!dstChainId) { unrecoverable++; reasons["unknown_dst_chain:" + dstChainName] = (reasons["unknown_dst_chain:" + dstChainName] || 0) + 1; continue; }
    const decimals = decimalsForTokenName(dstChainId, outputTokenName);
    if (decimals == null) { unrecoverable++; reasons["token_decimals_unknown:" + dstChainName + "/" + outputTokenName] = (reasons["token_decimals_unknown:" + dstChainName + "/" + outputTokenName] || 0) + 1; continue; }

    const formattedFilled = bigintDivisionToDecimalString(filledRaw, decimals);
    const newDetail = `IntentFilled ${formattedFilled} ${outputTokenName}(${dstChainName})`;

    let slippage = "";
    try {
      const minRaw = decimalStringToBigInt(minOutputStr, decimals);
      if (minRaw > 0n) slippage = slippagePercent(minRaw, filledRaw);
    } catch { /* leave empty */ }

    if (sampleSib.length < 10) {
      sampleSib.push({ id: row.id, before: row.bad_detail, after: newDetail, slippage });
    }

    updates.push({ id: row.id, action_detail: newDetail, slippage });
    fixedFromSibling++;
  }

  console.log(`\nTotal queued updates: ${updates.length}`);
  if (apply) {
    console.log(`Flushing in chunks of 500…`);
    await flushAll();
  }
  await pool.end();

  console.log(`Fixed via sibling CreateIntent: ${fixedFromSibling}${apply ? "" : " (would fix)"}`);
  console.log(`Unrecoverable parses:           ${unrecoverable}`);
  if (Object.keys(reasons).length > 0) {
    console.log(`\nUnrecoverable reasons:`);
    for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${v.toString().padStart(6, " ")}  ${k}`);
    }
  }
  console.log(`\nSample fixes from sibling CreateIntent (first ${sampleSib.length}):`);
  for (const s of sampleSib) {
    console.log(`  #${s.id}`);
    console.log(`    before: ${s.before}`);
    console.log(`    after:  ${s.after}${s.slippage ? `  (slippage: ${s.slippage})` : ""}`);
  }
  if (!apply) console.log(`\nDRY-RUN — no rows written. Re-run with --apply to commit.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
