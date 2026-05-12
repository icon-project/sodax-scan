/**
 * Backfill action_detail for rows that fell back to raw-address display.
 *
 * Two rewrite strategies, in order:
 *   1. Same-chain hit (chains[srcChainId].Assets[token]) — any action type.
 *      Captures the gaps closed by enrichChainsFromApi().
 *   2. Hub fallback (chains[sonic].Assets[token]) — money-market only
 *      (Supply/Borrow/Withdraw/Repay). Captures bnUSDd-style cross-chain rows.
 *
 * Two-token shape (IntentSwap / IntentFilled / IntentCancelled) is handled
 * separately; each side resolved against its own chain via the (chain) suffix.
 *
 * Amount recovery: original fallback used `bigintDivisionToDecimalString(amt, 18)`.
 * Reverse with multiplyDecimalBy10Pow18 to get the raw bigint, then re-format
 * with the asset's actual decimals.
 *
 * Usage:
 *   bun run scripts/backfill-action-detail.ts            # dry-run, full table
 *   bun run scripts/backfill-action-detail.ts --apply    # commit, full table
 *   bun run scripts/backfill-action-detail.ts --apply --days 30   # last 30 days
 */
import "dotenv/config";
import { Pool } from "pg";
import { chains, enrichChainsFromApi, idToChainNameMap, sonic } from "../src/configs";
import {
  bigintDivisionToDecimalString,
  getErc20Decimals,
  multiplyDecimalBy10Pow18,
} from "../src/utils";

const MM_ACTIONS = new Set(["Supply", "Borrow", "Withdraw", "Repay"]);
const RAW_TOKEN = "(0x[0-9a-fA-F]{40}|cx[0-9a-fA-F]{40})";
const SINGLE_REGEX = new RegExp(`^(\\w+)\\s+([0-9.]+)\\s+${RAW_TOKEN}\\s*$`);
const INTENT_REGEX = /^(\w+)\s+([0-9.]+)\s+(\S+?)\((\w+)\)\s*->\s*([0-9.]+)\s+(\S+?)\((\w+)\)\s*$/;
const RAW_TOKEN_ONLY = /^(0x[0-9a-fA-F]{40}|cx[0-9a-fA-F]{40})$/;

const chainNameToId: Record<string, string> = Object.fromEntries(
  Object.entries(idToChainNameMap).map(([id, name]) => [name, id]),
);

type Row = { id: number; src_network: string; action_type: string; action_detail: string };

function resolveIntentSide(amt: string, tok: string, chainName: string): string | null {
  if (!RAW_TOKEN_ONLY.test(tok)) return null;
  const chainId = chainNameToId[chainName];
  const hit = chains[chainId]?.Assets?.[tok.toLowerCase()];
  if (!hit) return null;
  const amtBigint = multiplyDecimalBy10Pow18(amt);
  return `${bigintDivisionToDecimalString(amtBigint, hit.decimals)} ${hit.name}(${chainName})`;
}

function rewriteActionDetail(row: Row): string | null {
  const im = INTENT_REGEX.exec(row.action_detail);
  if (im) {
    const [, verb, inAmt, inTok, inChain, outAmt, outTok, outChain] = im;
    const newIn = resolveIntentSide(inAmt, inTok, inChain);
    const newOut = resolveIntentSide(outAmt, outTok, outChain);
    if (!newIn && !newOut) return null;
    const finalIn = newIn ?? `${inAmt} ${inTok}(${inChain})`;
    const finalOut = newOut ?? `${outAmt} ${outTok}(${outChain})`;
    return `${verb} ${finalIn} -> ${finalOut}`;
  }

  const sm = SINGLE_REGEX.exec(row.action_detail);
  if (!sm) return null;
  const [, action, amountStr, tokenRaw] = sm;
  const token = tokenRaw.toLowerCase();
  const amountBigint = multiplyDecimalBy10Pow18(amountStr);

  const srcHit = chains[row.src_network]?.Assets?.[token];
  if (srcHit) {
    return `${action} ${bigintDivisionToDecimalString(amountBigint, getErc20Decimals(srcHit))} ${srcHit.name}`;
  }
  if (MM_ACTIONS.has(action)) {
    const hubHit = chains[sonic]?.Assets?.[token];
    if (hubHit) {
      const srcName = idToChainNameMap[row.src_network] ?? row.src_network;
      return `${action} ${bigintDivisionToDecimalString(amountBigint, getErc20Decimals(hubHit))} ${hubHit.name} (Sonic) ← initiated from ${srcName}`;
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const daysIdx = args.indexOf("--days");
  const recentDays = daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) : undefined;

  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log(`Scope: ${recentDays ? `last ${recentDays} days` : "full table"}`);

  await enrichChainsFromApi();

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  let scanned = 0;
  let rewritten = 0;
  let unchanged = 0;
  const sample: { id: number; before: string; after: string }[] = [];

  try {
    const params: (string | number)[] = [];
    let timeFilter = "";
    if (recentDays !== undefined) {
      const cutoff = Math.floor(Date.now() / 1000) - recentDays * 86400;
      timeFilter = `AND created_at >= $${params.length + 1}`;
      params.push(cutoff);
    }
    const sql = `
      SELECT id, src_network, action_type, action_detail
      FROM messages
      WHERE action_detail ~ '${RAW_TOKEN}'
        ${timeFilter}
    `;
    const res = await client.query(sql, params);
    scanned = res.rowCount ?? 0;

    if (apply) await client.query("BEGIN");
    for (const row of res.rows as Row[]) {
      const nextText = rewriteActionDetail(row);
      if (!nextText || nextText === row.action_detail) {
        unchanged++;
        continue;
      }
      rewritten++;
      if (sample.length < 20) sample.push({ id: row.id, before: row.action_detail, after: nextText });
      if (apply) {
        await client.query("UPDATE messages SET action_detail = $1 WHERE id = $2", [nextText, row.id]);
      }
    }
    if (apply) await client.query("COMMIT");
  } catch (err) {
    if (apply) await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\nScanned: ${scanned}`);
  console.log(`Rewritten: ${rewritten}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`\nSample (first ${sample.length}):`);
  for (const s of sample) {
    console.log(`  #${s.id}`);
    console.log(`    before: ${s.before}`);
    console.log(`    after:  ${s.after}`);
  }
  if (!apply) console.log("\nDRY-RUN — no rows written. Re-run with --apply to commit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
