/**
 * Recover a nicely-formatted IntentFilled action_detail (+ slippage) for cases
 * where the EVM handler's input-calldata decode fell through to the raw event
 * tuple. The handler still parses the intent hash and the raw filled output
 * from the IntentFilled event log; this module supplies the missing token /
 * chain / decimals context from other rows we already have indexed.
 *
 * Two recovery sources, tried in order:
 *   1. hub_intent_events.filled — same on-chain event, already nicely formatted
 *      by the hub poller AND carries computed slippage. Copy both verbatim.
 *   2. The intent's sibling CreateIntent message (linked by intent_tx_hash).
 *      Parse its action_detail "IntentSwap … -> <minOut> <outTok>(<dstChain>)"
 *      to get the output token name + dst chain. Look up decimals from chains
 *      config and format the raw filled value; compute slippage from minOut.
 *
 * Returns null when neither source can resolve the format (e.g. sibling
 * CreateIntent hasn't arrived yet, intent_tx_hash still blank elsewhere).
 * Callers should keep their existing action_detail in that case; the periodic
 * scripts/backfill-fill-action-detail.ts is the safety net.
 */
import pool from './db/db';
import { chains, idToChainNameMap } from './configs';
import { bigintDivisionToDecimalString } from './utils';

export interface FillFormatResult {
  actionDetail: string;
  slippage: string;
}

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
  const [intPart, fracPart = ''] = amount.split('.');
  const paddedFrac = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
  const s = (intPart || '0') + paddedFrac;
  return BigInt(s);
}

// Mirrors hub-poller slippage format (4 decimals, signed, "%" suffix).
function slippagePercent(expected: bigint, actual: bigint): string {
  if (expected === 0n) return '';
  const decimals = 4;
  const diff = actual - expected;
  const isNegative = diff < 0n;
  const absDiff = diff < 0n ? -diff : diff;
  const SCALE = BigInt(10 ** decimals);
  const scaled = (absDiff * SCALE * 100n) / expected;
  let s = scaled.toString();
  if (s.length <= decimals) s = s.padStart(decimals + 1, '0');
  const intPart = s.slice(0, s.length - decimals);
  const decPart = s.slice(s.length - decimals);
  return `${isNegative ? '-' : ''}${intPart}.${decPart}%`;
}

async function fromHubEvent(intentHash: string): Promise<FillFormatResult | null> {
  const r = await pool.query(
    `SELECT action_detail, slippage
       FROM hub_intent_events
      WHERE intent_hash = $1 AND event_type = 'filled'
      LIMIT 1`,
    [intentHash],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  if (!row.action_detail || !row.action_detail.startsWith('IntentFilled ')) return null;
  return { actionDetail: row.action_detail, slippage: row.slippage ?? '' };
}

async function fromSiblingCreate(intentHash: string, filledRaw: bigint): Promise<FillFormatResult | null> {
  const r = await pool.query(
    `SELECT action_detail FROM messages
      WHERE action_type = 'CreateIntent'
        AND intent_tx_hash = $1
        AND action_detail LIKE 'IntentSwap %'
      LIMIT 1`,
    [intentHash],
  );
  if (r.rows.length === 0) return null;
  const m = CREATE_RE.exec(r.rows[0].action_detail);
  if (!m) return null;
  const minOutputStr = m[4];
  const outputTokenName = m[5];
  const dstChainName = m[6];

  const dstChainId = chainNameToId[dstChainName];
  if (!dstChainId) return null;
  const decimals = decimalsForTokenName(dstChainId, outputTokenName);
  if (decimals == null) return null;

  const formatted = bigintDivisionToDecimalString(filledRaw, decimals);
  const actionDetail = `IntentFilled ${formatted} ${outputTokenName}(${dstChainName})`;

  let slippage = '';
  try {
    const minRaw = decimalStringToBigInt(minOutputStr, decimals);
    if (minRaw > 0n) slippage = slippagePercent(minRaw, filledRaw);
  } catch { /* leave empty */ }

  return { actionDetail, slippage };
}

/**
 * Returns a nicely-formatted IntentFilled action_detail + slippage if either
 * recovery source resolves; otherwise null.
 */
export async function recoverIntentFilledFormat(
  intentHash: string,
  filledRaw: bigint,
): Promise<FillFormatResult | null> {
  return (await fromHubEvent(intentHash)) ?? (await fromSiblingCreate(intentHash, filledRaw));
}

const RAW_TUPLE_RE = /^IntentFilled 0x[0-9a-fA-F]{64},/;
export function isRawTupleActionText(text: string | undefined | null): boolean {
  return !!text && RAW_TUPLE_RE.test(text);
}
