/**
 * One-off backfill: recompute hub-side intent action_detail (+ fill slippage)
 * from the original Sonic events, resolving token decimals & origin BY ADDRESS.
 *
 * Why: the old fill formatter resolved decimals by token *symbol*, which is
 * ambiguous on the hub (one symbol → many addresses with different decimals,
 * e.g. USDT at 6 and 18). That produced both wrong numbers (slippage in the
 * billions of %) and origin-less labels (`USDT(sonic)` instead of
 * `USDT.bsc(sonic)`). The live code is fixed; this repairs existing rows.
 *
 * Approach: re-scan IntentCreated + IntentFilled logs over the hub range
 * (~2.7M blocks / 5k batch ≈ ~545 getLogs calls), rebuild each CreateIntent
 * detail by address (so it carries origin + correct decimals), then format
 * each fill from that corrected create string via the shared formatter. UPDATE
 * the matching `messages` rows (sn IS NULL only — hub-origin rows).
 *
 * SCOPE: hub-side rows only. The relayer raw-tuple victims (sn IS NOT NULL,
 * "IntentFilled 0x…,") are a separate code path and are NOT touched here.
 *
 * Usage:
 *   ts-node -r dotenv/config scripts/backfill-hub-intent-origin.ts            # dry-run
 *   ts-node -r dotenv/config scripts/backfill-hub-intent-origin.ts --apply    # write
 *   …--from <block> --to <block>   override the scan range (default: full history)
 */
import { ethers } from 'ethers';
import { RPC_URLS, sonic, chains, idToChainNameMap, enrichChainsFromApi } from '../src/configs';
import { bigintDivisionToDecimalString, symbolWithOrigin } from '../src/utils';
import { formatFillFromCreateActionDetail } from '../src/intent-fill-format';
import pool from '../src/db/db';

const CONTRACT_ADDRESS = (
  process.env.HUB_INTENT_CONTRACT || '0x6382D6ccD780758C5e8A6123c33ee8F4472F96ef'
).toLowerCase();
const START_BLOCK = Number.parseInt(process.env.HUB_INTENT_START_BLOCK || '18681775', 10);
const BATCH_SIZE = Number.parseInt(process.env.HUB_INTENT_BATCH_SIZE || '5000', 10);
const CONFIRMATIONS = Number.parseInt(process.env.HUB_INTENT_CONFIRMATIONS || '12', 10);
const RPC_SLEEP_MS = Number.parseInt(process.env.BACKFILL_RPC_SLEEP_MS || '150', 10);

const INTENT_CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes(
    'IntentCreated(bytes32,(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))',
  ),
);
const INTENT_FILLED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('IntentFilled(bytes32,(bool,uint256,uint256,bool))'),
);
const CREATED_TUPLE =
  '(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)';

const normalizeAddr = (a: string): string =>
  /^(0x|cx)[0-9a-fA-F]+$/.test(a) ? a.toLowerCase() : a;

function tokenInfo(chainId: string, addr: string): { name: string; decimals: number; origin?: string } {
  const key = normalizeAddr(addr);
  const a = chains[chainId]?.Assets?.[key];
  if (a) return { name: a.name, decimals: a.decimals, origin: a.origin };
  return { name: addr, decimals: 18 };
}

// Rebuild a CreateIntent action_detail exactly as poller.handleCreated does —
// resolving each leg by address so it carries origin + correct decimals.
function buildCreateDetail(data: string): { intentHash: string; detail: string } {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const decoded = abi.decode(['bytes32', CREATED_TUPLE], data);
  const intentHash = (decoded[0] as string).toLowerCase();
  const t = decoded[1] as ethers.Result;
  const inInfo = tokenInfo((t[8] as bigint).toString(), normalizeAddr(t[2] as string));
  const outInfo = tokenInfo((t[9] as bigint).toString(), normalizeAddr(t[3] as string));
  const inAmt = bigintDivisionToDecimalString(t[4] as bigint, inInfo.decimals);
  const outAmt = bigintDivisionToDecimalString(t[5] as bigint, outInfo.decimals);
  const srcName = idToChainNameMap[(t[8] as bigint).toString()] || (t[8] as bigint).toString();
  const dstName = idToChainNameMap[(t[9] as bigint).toString()] || (t[9] as bigint).toString();
  const detail = `IntentSwap ${inAmt} ${symbolWithOrigin(inInfo, inInfo.name)}(${srcName}) -> ${outAmt} ${symbolWithOrigin(outInfo, outInfo.name)}(${dstName})`;
  return { intentHash, detail };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const argFrom = process.argv.indexOf('--from');
  const argTo = process.argv.indexOf('--to');

  await enrichChainsFromApi(); // populate AssetInfo.origin

  const provider = new ethers.JsonRpcProvider(RPC_URLS[sonic]);
  const head = (await provider.getBlockNumber()) - CONFIRMATIONS;
  const from = argFrom >= 0 ? Number.parseInt(process.argv[argFrom + 1], 10) : START_BLOCK;
  const to = argTo >= 0 ? Number.parseInt(process.argv[argTo + 1], 10) : head;
  console.log(`mode=${apply ? 'APPLY' : 'DRY-RUN'} contract=${CONTRACT_ADDRESS} range=[${from}, ${to}] batch=${BATCH_SIZE}`);

  const createDetails = new Map<string, string>();             // intentHash → corrected create detail
  const fills: { intentHash: string; filledRaw: bigint }[] = [];

  let calls = 0;
  for (let lo = from; lo <= to; lo += BATCH_SIZE) {
    const hi = Math.min(lo + BATCH_SIZE - 1, to);
    const logs = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      fromBlock: lo,
      toBlock: hi,
      topics: [[INTENT_CREATED_TOPIC, INTENT_FILLED_TOPIC]],
    });
    calls++;
    for (const log of logs) {
      if (log.topics[0] === INTENT_CREATED_TOPIC) {
        const { intentHash, detail } = buildCreateDetail(log.data);
        createDetails.set(intentHash, detail);
      } else {
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const t = abi.decode(['(bytes32,bool,uint256,uint256,bool)'], log.data)[0] as ethers.Result;
        fills.push({ intentHash: (t[0] as string).toLowerCase(), filledRaw: t[3] as bigint });
      }
    }
    if (calls % 25 === 0) console.log(`  scanned to ${hi} — creates=${createDetails.size} fills=${fills.length} (${calls} calls)`);
    if (RPC_SLEEP_MS > 0) await sleep(RPC_SLEEP_MS);
  }
  console.log(`scan done: ${calls} getLogs calls, ${createDetails.size} creates, ${fills.length} fills`);

  // Build the fill rewrites from the corrected create strings.
  const createUpdates: { intentHash: string; detail: string }[] = [];
  for (const [intentHash, detail] of createDetails) createUpdates.push({ intentHash, detail });

  const fillUpdates: { intentHash: string; detail: string; slippage: string | null }[] = [];
  let unresolved = 0;
  for (const f of fills) {
    const createDetail = createDetails.get(f.intentHash);
    if (!createDetail) { unresolved++; continue; }
    const fmt = formatFillFromCreateActionDetail(createDetail, f.filledRaw);
    if (!fmt) { unresolved++; continue; }
    fillUpdates.push({ intentHash: f.intentHash, detail: fmt.actionDetail, slippage: fmt.slippage || null });
  }
  console.log(`prepared: ${createUpdates.length} create rewrites, ${fillUpdates.length} fill rewrites, ${unresolved} fills unresolved (no/unparseable create)`);

  // Sample diff vs current DB so dry-run shows real before→after — prefer
  // implausible-slippage rows (the decimals victims) so the repair is visible.
  const allHashes = fillUpdates.map(u => u.intentHash);
  const sample = await pool.query(
    `SELECT intent_tx_hash, action_detail, slippage FROM messages
      WHERE action_type='IntentFilled' AND sn IS NULL AND lower(intent_tx_hash) = ANY($1)
      ORDER BY (slippage ~ '^-?[0-9.]+%$' AND abs(replace(slippage,'%','')::numeric) > 1000) DESC NULLS LAST
      LIMIT 8`,
    [allHashes],
  );
  console.log('\nsample current fill rows:');
  for (const r of sample.rows) {
    const u = fillUpdates.find(x => x.intentHash === r.intent_tx_hash.toLowerCase());
    console.log(`  ${r.intent_tx_hash}\n    before: ${r.action_detail}  [${r.slippage}]\n    after : ${u?.detail}  [${u?.slippage}]`);
  }

  if (!apply) {
    console.log('\nDRY-RUN — no writes. Re-run with --apply to persist.');
    await pool.end();
    return;
  }

  // Apply: UPDATE only hub rows (sn IS NULL), only when the value actually changes.
  let cWrote = 0, fWrote = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of createUpdates) {
      const r = await client.query(
        `UPDATE messages SET action_detail=$1, updated_at=extract(epoch from now())::bigint
           WHERE action_type='CreateIntent' AND sn IS NULL
             AND lower(intent_tx_hash)=$2 AND action_detail IS DISTINCT FROM $1`,
        [u.detail, u.intentHash],
      );
      cWrote += r.rowCount ?? 0;
    }
    for (const u of fillUpdates) {
      const r = await client.query(
        `UPDATE messages SET action_detail=$1, slippage=$2, updated_at=extract(epoch from now())::bigint
           WHERE action_type='IntentFilled' AND sn IS NULL
             AND lower(intent_tx_hash)=$3
             AND (action_detail IS DISTINCT FROM $1 OR slippage IS DISTINCT FROM $2)`,
        [u.detail, u.slippage, u.intentHash],
      );
      fWrote += r.rowCount ?? 0;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log(`APPLIED: ${cWrote} create rows, ${fWrote} fill rows updated.`);
  console.log('NOTE: relayer raw-tuple victims (sn IS NOT NULL) are NOT fixed by this script.');
  await pool.end();
}

main().catch(e => { console.error('backfill failed:', e); process.exit(1); });
