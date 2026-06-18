/**
 * Diagnostic (read-only): do the raw-tuple "orphan" fills (IntentFilled
 * 0x…, with no sibling CreateIntent in `messages`) actually have an
 * IntentCreated event on-chain? Scans hub IntentCreated logs over the hub
 * range and reports how many orphan intent hashes are present on-chain — i.e.
 * how much of the 1,384 a hub re-scan could supply a create for.
 */
import { ethers } from 'ethers';
import { RPC_URLS, sonic } from '../src/configs';
import pool from '../src/db/db';

const CONTRACT_ADDRESS = (process.env.HUB_INTENT_CONTRACT || '0x6382D6ccD780758C5e8A6123c33ee8F4472F96ef').toLowerCase();
const START_BLOCK = Number.parseInt(process.env.HUB_INTENT_START_BLOCK || '18681775', 10);
const BATCH_SIZE = Number.parseInt(process.env.HUB_INTENT_BATCH_SIZE || '5000', 10);
const CONFIRMATIONS = Number.parseInt(process.env.HUB_INTENT_CONFIRMATIONS || '12', 10);
const SLEEP_MS = Number.parseInt(process.env.BACKFILL_RPC_SLEEP_MS || '120', 10);

const INTENT_CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('IntentCreated(bytes32,(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))'),
);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main(): Promise<void> {
  // Orphan fills: raw-tuple, 0x hash, no sibling create in messages.
  const r = await pool.query(`
    SELECT lower(m.intent_tx_hash) h FROM messages m
    WHERE m.action_type='IntentFilled'
      AND m.action_detail ~ '^IntentFilled 0x[0-9a-fA-F]{64},'
      AND m.intent_tx_hash LIKE '0x%'
      AND NOT EXISTS (SELECT 1 FROM messages c WHERE c.action_type='CreateIntent' AND lower(c.intent_tx_hash)=lower(m.intent_tx_hash))`);
  const orphans = new Set<string>(r.rows.map(x => x.h));
  console.log(`orphan fills (no sibling create): ${orphans.size}`);

  const provider = new ethers.JsonRpcProvider(RPC_URLS[sonic]);
  const head = (await provider.getBlockNumber()) - CONFIRMATIONS;
  const onChain = new Set<string>();
  let calls = 0;
  for (let lo = START_BLOCK; lo <= head; lo += BATCH_SIZE) {
    const hi = Math.min(lo + BATCH_SIZE - 1, head);
    const logs = await provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock: lo, toBlock: hi, topics: [INTENT_CREATED_TOPIC] });
    calls++;
    for (const log of logs) onChain.add(`0x${log.data.slice(2, 66)}`.toLowerCase());
    if (calls % 50 === 0) {
      let hit = 0; for (const h of orphans) if (onChain.has(h)) hit++;
      console.log(`  block ${hi}: on-chain creates=${onChain.size}, orphan hits so far=${hit}/${orphans.size} (${calls} calls)`);
    }
    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }
  let found = 0; for (const h of orphans) if (onChain.has(h)) found++;
  console.log(`\nDONE: ${calls} getLogs calls, ${onChain.size} on-chain IntentCreated.`);
  console.log(`orphan fills WITH on-chain create: ${found}/${orphans.size}  (recoverable via hub re-scan)`);
  console.log(`orphan fills with NO on-chain create: ${orphans.size - found}  (create not on hub — likely non-hub-origin / pre-START_BLOCK)`);
  await pool.end();
}
main().catch(e => { console.error('verify failed:', e); process.exit(1); });
