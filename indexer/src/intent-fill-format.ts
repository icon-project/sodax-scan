/**
 * Recover a formatted IntentFilled action_detail (+ slippage) when the EVM
 * handler's calldata decode falls through to the raw event tuple. The
 * caller supplies the intent hash and the raw filled output amount; we
 * resolve token / chain / decimals from the sibling CreateIntent row in
 * `messages` (linked by intent_tx_hash).
 *
 * Returns null when the sibling hasn't been ingested yet or its
 * action_detail isn't parseable; the caller keeps its existing text.
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

/**
 * Pure helper: given a CreateIntent row's action_detail string and the raw
 * filled output amount, returns the formatted fill action_detail + slippage.
 * Returns null when the create action_detail isn't parseable or the token /
 * decimals lookup fails. Used by both the hub poller (at fill insert time)
 * and the recovery path below (after-the-fact for relayer-side rows).
 */
export function formatFillFromCreateActionDetail(
  createActionDetail: string,
  filledRaw: bigint,
): FillFormatResult | null {
  const m = CREATE_RE.exec(createActionDetail);
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
 * Returns a nicely-formatted IntentFilled action_detail + slippage by looking
 * up the intent's CreateIntent sibling in `messages` and parsing its
 * action_detail. Hub creates land with sn IS NULL, relayer creates with sn
 * IS NOT NULL — either works, the format we parse is the same. Returns null
 * when the sibling hasn't been ingested yet or its action_detail can't be
 * parsed.
 */
export async function recoverIntentFilledFormat(
  intentHash: string,
  filledRaw: bigint,
): Promise<FillFormatResult | null> {
  const r = await pool.query(
    `SELECT action_detail FROM messages
      WHERE action_type = 'CreateIntent'
        AND intent_tx_hash = $1
        AND action_detail LIKE 'IntentSwap %'
      LIMIT 1`,
    [intentHash],
  );
  if (r.rows.length === 0) return null;
  return formatFillFromCreateActionDetail(r.rows[0].action_detail, filledRaw);
}

const RAW_TUPLE_RE = /^IntentFilled 0x[0-9a-fA-F]{64},/;
export function isRawTupleActionText(text: string | undefined | null): boolean {
  return !!text && RAW_TUPLE_RE.test(text);
}
