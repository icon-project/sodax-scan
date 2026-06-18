/**
 * One-off backfill: recover IntentFilled rows stuck in the raw event-tuple
 * form ("IntentFilled 0x…,bool,uint,uint,bool") into proper
 * "IntentFilled <amount> SYMBOL.origin(chain)" + slippage.
 *
 * Root cause (see project memory): the hub poller began writing fills on
 * 2026-05-18, ~10 days before the fill formatter + create migration landed.
 * A backfill run in that window found no sibling CreateIntent rows in
 * `messages`, so ~1.4k fills (mostly late-May) stayed raw. The creates DO
 * exist on-chain (verified 1384/1384), so we rebuild them from hub
 * IntentCreated logs and reformat every raw-tuple fill by intent hash —
 * independent of whether a messages sibling exists.
 *
 * Resolves decimals & origin BY ADDRESS (depends on the AssetInfo.origin /
 * (symbol,origin) fix — branch fix/intent-fill-decimals-origin must be in).
 *
 * Usage:
 *   ts-node -r dotenv/config scripts/recover-unformatted-fills.ts            # dry-run
 *   ts-node -r dotenv/config scripts/recover-unformatted-fills.ts --apply
 *   …--from <block>   lower the create-scan start if any rows stay unresolved
 */
import { ethers } from 'ethers';
import { RPC_URLS, sonic, chains, idToChainNameMap, enrichChainsFromApi } from '../src/configs';
import { bigintDivisionToDecimalString, symbolWithOrigin } from '../src/utils';
import { formatFillFromCreateActionDetail } from '../src/intent-fill-format';
import pool from '../src/db/db';

const CONTRACT_ADDRESS = (process.env.HUB_INTENT_CONTRACT || '0x6382D6ccD780758C5e8A6123c33ee8F4472F96ef').toLowerCase();
const BATCH_SIZE = Number.parseInt(process.env.HUB_INTENT_BATCH_SIZE || '5000', 10);
const CONFIRMATIONS = Number.parseInt(process.env.HUB_INTENT_CONFIRMATIONS || '12', 10);
const SLEEP_MS = Number.parseInt(process.env.BACKFILL_RPC_SLEEP_MS || '120', 10);
// Orphan creates cluster from ~block 71M (poller era); 60M is a safe, cheap
// default (~570 calls). Lower via --from if the dry-run reports unresolved.
const DEFAULT_FROM = 60_000_000;

const INTENT_CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('IntentCreated(bytes32,(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))'),
);
const CREATED_TUPLE = '(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)';
const MALFORMED_RE = /^IntentFilled (0x[0-9a-fA-F]{64}),(true|false),(\d+),(\d+),(true|false)$/;

const normalizeAddr = (a: string): string => (/^(0x|cx)[0-9a-fA-F]+$/.test(a) ? a.toLowerCase() : a);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function tokenInfo(chainId: string, addr: string): { name: string; decimals: number; origin?: string } {
  const a = chains[chainId]?.Assets?.[normalizeAddr(addr)];
  return a ? { name: a.name, decimals: a.decimals, origin: a.origin } : { name: addr, decimals: 18 };
}

// Same create-detail rebuild as poller.handleCreated (resolved by address).
function buildCreateDetail(data: string): { intentHash: string; detail: string } {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const d = abi.decode(['bytes32', CREATED_TUPLE], data);
  const t = d[1] as ethers.Result;
  const inInfo = tokenInfo((t[8] as bigint).toString(), normalizeAddr(t[2] as string));
  const outInfo = tokenInfo((t[9] as bigint).toString(), normalizeAddr(t[3] as string));
  const inAmt = bigintDivisionToDecimalString(t[4] as bigint, inInfo.decimals);
  const outAmt = bigintDivisionToDecimalString(t[5] as bigint, outInfo.decimals);
  const srcName = idToChainNameMap[(t[8] as bigint).toString()] || (t[8] as bigint).toString();
  const dstName = idToChainNameMap[(t[9] as bigint).toString()] || (t[9] as bigint).toString();
  const detail = `IntentSwap ${inAmt} ${symbolWithOrigin(inInfo, inInfo.name)}(${srcName}) -> ${outAmt} ${symbolWithOrigin(outInfo, outInfo.name)}(${dstName})`;
  return { intentHash: (d[0] as string).toLowerCase(), detail };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const argFrom = process.argv.indexOf('--from');
  await enrichChainsFromApi();

  // Raw-tuple fills to repair (hub + relayer).
  const rows = (await pool.query(
    `SELECT id, action_detail FROM messages
      WHERE action_type='IntentFilled' AND action_detail ~ '^IntentFilled 0x[0-9a-fA-F]{64},'`,
  )).rows as { id: number; action_detail: string }[];
  console.log(`raw-tuple fills to repair: ${rows.length}  mode=${apply ? 'APPLY' : 'DRY-RUN'}`);

  // Build intentHash → corrected create detail from on-chain IntentCreated.
  const provider = new ethers.JsonRpcProvider(RPC_URLS[sonic]);
  const head = (await provider.getBlockNumber()) - CONFIRMATIONS;
  const from = argFrom >= 0 ? Number.parseInt(process.argv[argFrom + 1], 10) : DEFAULT_FROM;
  console.log(`scanning IntentCreated [${from}, ${head}]…`);
  const createDetails = new Map<string, string>();
  let calls = 0;
  for (let lo = from; lo <= head; lo += BATCH_SIZE) {
    const hi = Math.min(lo + BATCH_SIZE - 1, head);
    const logs = await provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock: lo, toBlock: hi, topics: [INTENT_CREATED_TOPIC] });
    calls++;
    for (const log of logs) {
      const { intentHash, detail } = buildCreateDetail(log.data);
      createDetails.set(intentHash, detail);
    }
    if (calls % 50 === 0) console.log(`  …block ${hi}, creates=${createDetails.size} (${calls} calls)`);
    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }
  console.log(`scan done: ${calls} calls, ${createDetails.size} creates`);

  // Reformat each raw-tuple fill from its (on-chain) create.
  const updates: { id: number; detail: string; slippage: string | null }[] = [];
  let unparseable = 0, noCreate = 0;
  for (const r of rows) {
    const m = MALFORMED_RE.exec(r.action_detail);
    if (!m) { unparseable++; continue; }
    const intentHash = m[1].toLowerCase();
    const filledRaw = BigInt(m[4]);
    const createDetail = createDetails.get(intentHash);
    if (!createDetail) { noCreate++; continue; }
    const fmt = formatFillFromCreateActionDetail(createDetail, filledRaw);
    if (!fmt) { noCreate++; continue; }
    updates.push({ id: r.id, detail: fmt.actionDetail, slippage: fmt.slippage || null });
  }
  console.log(`resolvable: ${updates.length}/${rows.length}  (unparseable=${unparseable}, no on-chain create in range=${noCreate})`);
  if (noCreate > 0) console.log('  → some creates predate --from; lower it and re-run to cover them.');
  for (const u of updates.slice(0, 8)) console.log(`  #${u.id} → ${u.detail}  [${u.slippage}]`);

  if (!apply) { console.log('\nDRY-RUN — no writes. Re-run with --apply.'); await pool.end(); return; }

  let wrote = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      const r = await client.query(
        `UPDATE messages SET action_detail=$1, slippage=$2, updated_at=extract(epoch from now())::bigint
           WHERE id=$3 AND action_detail IS DISTINCT FROM $1`,
        [u.detail, u.slippage, u.id],
      );
      wrote += r.rowCount ?? 0;
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  console.log(`APPLIED: ${wrote} fill rows reformatted.`);
  await pool.end();
}
main().catch(e => { console.error('recovery failed:', e); process.exit(1); });
