/**
 * Validation probe for the sender-based IntentFilled discriminator.
 *
 * Rule under test: a relay Message in a fill tx is THE fill delivery iff
 * its payload sender field equals the contract that emitted the
 * IntentFilled event in the same tx. Everything else in the tx is a
 * plain transfer (solver side-moves), regardless of token names.
 *
 * Samples historical Sonic fill txs from `messages` and reports:
 *   - per-tx: #Message events, #messages matching the sender rule
 *   - invariant violations (0 matches, or more matches than IntentFilled
 *     events in the tx — batch fills legitimately have several)
 *   - disagreements between the rule and current DB labels (expected:
 *     exactly the mislabeled siblings)
 *
 * Read-only. Usage: ts-node scripts/probe-fill-sender-rule.ts [sampleSize]
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import { Pool } from 'pg';

const SAMPLE = Number(process.argv[2] || 200);

const MESSAGE_EVENT_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('Message(uint256,bytes,uint256,uint256,bytes,bytes)'),
);
const INTENT_FILLED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('IntentFilled(bytes32,(bool,uint256,uint256,bool))'),
);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

const provider = new ethers.JsonRpcProvider(process.env.SONIC_URL);
const abi = ethers.AbiCoder.defaultAbiCoder();

// Payload sender: field 1 of the 5-field RLP transfer payload.
function payloadSender(payload: string): string | null {
  try {
    const rlp = ethers.decodeRlp(payload);
    if (!Array.isArray(rlp) || rlp.length !== 5) return null;
    return String(rlp[1]).toLowerCase();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  // Mix: txs that produced >1 IntentFilled-labeled rows (suspect) and
  // single-fill txs (control), most recent first.
  const txs = await pool.query(
    `SELECT src_tx_hash, count(*) AS fill_rows
       FROM messages
      WHERE sn IS NOT NULL AND action_type = 'IntentFilled' AND src_network = '146'
      GROUP BY src_tx_hash
      ORDER BY max(id) DESC
      LIMIT $1`,
    [SAMPLE],
  );

  let txsOk = 0;
  let txsNoMatch = 0;
  let txsExcessMatch = 0;
  let rpcOrDecodeIssues = 0;
  const disagreements: string[] = [];
  let agreements = 0;

  for (const row of txs.rows) {
    const txHash = row.src_tx_hash;
    let rcpt: ethers.TransactionReceipt | null = null;
    try {
      rcpt = await provider.getTransactionReceipt(txHash);
    } catch {
      /* fall through */
    }
    if (!rcpt) {
      rpcOrDecodeIssues++;
      continue;
    }

    const fillEmitters = new Set<string>();
    let fillEventCount = 0;
    for (const log of rcpt.logs) {
      if (log.topics[0] === INTENT_FILLED_TOPIC) {
        fillEmitters.add(log.address.toLowerCase());
        fillEventCount++;
      }
    }
    if (fillEventCount === 0) {
      // DB says fill but no event on chain — different problem, just count.
      rpcOrDecodeIssues++;
      continue;
    }

    // Apply the rule to every Message event in the tx.
    const verdicts: Array<{ sn: string; isFill: boolean }> = [];
    for (const log of rcpt.logs) {
      if (log.topics[0] !== MESSAGE_EVENT_TOPIC) continue;
      const d = abi.decode(['uint256', 'bytes', 'uint256', 'uint256', 'bytes', 'bytes'], log.data);
      const sender = payloadSender(d[5]);
      verdicts.push({
        sn: BigInt(d[2]).toString(),
        isFill: sender !== null && fillEmitters.has(sender),
      });
    }

    const matches = verdicts.filter(v => v.isFill).length;
    if (verdicts.length > 0 && matches === 0) {
      txsNoMatch++;
      console.log(`NO-MATCH   ${txHash} msgs=${verdicts.length} fillEvents=${fillEventCount}`);
    } else if (matches > fillEventCount) {
      txsExcessMatch++;
      console.log(`EXCESS     ${txHash} matches=${matches} fillEvents=${fillEventCount}`);
    } else {
      txsOk++;
    }

    // Compare rule verdicts against DB labels for this tx.
    const dbRows = await pool.query(
      `SELECT sn, action_type FROM messages WHERE src_tx_hash = $1 AND sn IS NOT NULL`,
      [txHash],
    );
    for (const dbRow of dbRows.rows) {
      const v = verdicts.find(x => x.sn === String(dbRow.sn));
      if (!v) continue;
      const dbSaysFill = dbRow.action_type === 'IntentFilled';
      if (dbSaysFill === v.isFill) {
        agreements++;
      } else {
        disagreements.push(
          `  sn=${dbRow.sn} db=${dbRow.action_type} rule=${v.isFill ? 'IntentFilled' : 'Transfer'} tx=${txHash}`,
        );
      }
    }
  }

  console.log(`\ntxs sampled: ${txs.rows.length}`);
  console.log(`  rule consistent (matches <= fill events, >=1): ${txsOk}`);
  console.log(`  NO message matched sender rule:                ${txsNoMatch}`);
  console.log(`  more matches than fill events:                 ${txsExcessMatch}`);
  console.log(`  rpc/decode issues (skipped):                   ${rpcOrDecodeIssues}`);
  console.log(`\nrow-level vs DB labels: ${agreements} agree, ${disagreements.length} disagree`);
  console.log('disagreements (expected = mislabeled siblings):');
  for (const d of disagreements.slice(0, 40)) console.log(d);
  if (disagreements.length > 40) console.log(`  ... +${disagreements.length - 40} more`);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
