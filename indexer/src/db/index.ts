import pool from './db';
import { chains, idToChainNameMap, sonic } from '../configs';
import { bigintDivisionToDecimalString, getErc20Decimals, multiplyDecimalBy10Pow18 } from '../utils';

export async function updateTransactionInfo(id: number, fee: string, actionType: string, actionText: string, intentTxHash: string, slippage = '', blockNumber: number | null): Promise<void> {
  // console.log([fee, actionType, actionText, intentTxHash, slippage, id])
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const updateQuery = `
      UPDATE messages
      SET fee = $1,
        action_type = $2,
        action_detail = $3,
        intent_tx_hash = $4,
        slippage = $5,
        src_block_number = $6
      WHERE id = $7     
    `;
    await client.query(updateQuery, [fee, actionType, actionText, intentTxHash, slippage, blockNumber, id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating transaction:', err);
    throw err;
  } finally {
    client.release();
  }
}

const MM_ACTIONS = new Set(['Supply', 'Borrow', 'Withdraw', 'Repay']);
const RAW_TOKEN = '(0x[0-9a-fA-F]{40}|cx[0-9a-fA-F]{40})';
// Single-token shape: `Action <amount> <addr>`
const SINGLE_REGEX = new RegExp(`^(\\w+)\\s+([0-9.]+)\\s+${RAW_TOKEN}\\s*$`);
// Two-token shape used by IntentSwap / IntentFilled / IntentCancelled:
//   <Verb> <amt> <tok>(<chain>) -> <amt> <tok>(<chain>)
const INTENT_REGEX = /^(\w+)\s+([0-9.]+)\s+(\S+?)\((\w+)\)\s*->\s*([0-9.]+)\s+(\S+?)\((\w+)\)\s*$/;
const RAW_TOKEN_ONLY = /^(0x[0-9a-fA-F]{40}|cx[0-9a-fA-F]{40})$/;

const chainNameToId: Record<string, string> = Object.fromEntries(
  Object.entries(idToChainNameMap).map(([id, name]) => [name, id])
);

type BackfillRow = { id: number; src_network: string; action_type: string; action_detail: string };

function resolveIntentSide(amt: string, tok: string, chainName: string): string | null {
  if (!RAW_TOKEN_ONLY.test(tok)) return null;
  const chainId = chainNameToId[chainName];
  const hit = chains[chainId]?.Assets?.[tok.toLowerCase()];
  if (!hit) return null;
  const amtBigint = multiplyDecimalBy10Pow18(amt);
  return `${bigintDivisionToDecimalString(amtBigint, hit.decimals)} ${hit.name}(${chainName})`;
}

function rewriteActionDetail(row: BackfillRow): string | null {
  // IntentSwap / IntentFilled / IntentCancelled: two raw-address slots,
  // each labeled with its chain in parens.
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

  // Single-token fallback shape.
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

export async function backfillRawAddressActionDetails(recentDays?: number): Promise<{ scanned: number; rewritten: number; unchanged: number }> {
  const client = await pool.connect();
  const result = { scanned: 0, rewritten: 0, unchanged: 0 };
  try {
    const params: (string | number)[] = [];
    let timeFilter = '';
    if (recentDays !== undefined) {
      // `created_at` in this schema is a unix epoch (seconds).
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
    result.scanned = res.rowCount ?? 0;

    await client.query('BEGIN');
    for (const row of res.rows as BackfillRow[]) {
      const nextText = rewriteActionDetail(row);
      if (!nextText || nextText === row.action_detail) {
        result.unchanged++;
        continue;
      }
      result.rewritten++;
      await client.query('UPDATE messages SET action_detail = $1 WHERE id = $2', [nextText, row.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return result;
}
