import { parseIsoMs, type FillLeg, type SolverFill } from './client';

export interface SolverFillRow {
  intentHash: string;
  srcChainId: string;
  dstChainId: string;
  /** Fill time, unix seconds. */
  timestamp: number;
  actionDetail: string;
  amountUsd: string | null;
}

export type FillMapResult = { ok: true; row: SolverFillRow } | { ok: false; reason: string };

// Backend display names that differ from our configs.ts chain keys.
const CHAIN_ALIASES: Record<string, string> = {
  avalanche: 'avax',
  'bnb chain': 'bsc',
  'bnb smart chain': 'bsc',
  'xrp ledger': 'xrp',
};

// "USDT (Arbitrum)" → symbol "USDT", chain "Arbitrum". Symbols may contain spaces.
const LABEL_RE = /^(.+?)\s*\(([^()]+)\)\s*$/;

/** Unix seconds from an ISO timestamp. */
export function isoToUnixSeconds(iso: string): number {
  return Math.floor(parseIsoMs(iso) / 1000);
}

// Plain decimal, never exponent notation.
function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 18 });
}

interface ResolvedLeg {
  text: string;
  chainId: string;
}

function resolveLeg(leg: FillLeg, chainIdsByName: Record<string, string>): ResolvedLeg | string {
  const m = LABEL_RE.exec(leg.label);
  if (!m) return `unparseable leg label "${leg.label}"`;
  const [, symbol, chainLabel] = m;
  const lower = chainLabel.trim().toLowerCase();
  const chainName = CHAIN_ALIASES[lower] ?? lower;
  const chainId = chainIdsByName[chainName];
  if (!chainId) return `unknown chain "${chainLabel.trim()}"`;
  return { text: `${formatAmount(leg.amount)} ${symbol.trim()}(${chainName})`, chainId };
}

function resolveSide(legs: FillLeg[], chainIdsByName: Record<string, string>): ResolvedLeg[] | string {
  const out: ResolvedLeg[] = [];
  for (const leg of legs) {
    const r = resolveLeg(leg, chainIdsByName);
    if (typeof r === 'string') return r;
    out.push(r);
  }
  return out;
}

/**
 * Maps a fill to a messages row. received legs are the user's input (src side),
 * paid legs the user's output (dst side). Returns a stable reason string when
 * the fill can't be mapped, so callers can warn once per reason.
 */
export function fillToRow(fill: SolverFill, chainIdsByName: Record<string, string>): FillMapResult {
  if (fill.receivedLegs.length === 0 || fill.paidLegs.length === 0) {
    return { ok: false, reason: 'fill has an empty leg side' };
  }
  const timestamp = isoToUnixSeconds(fill.timestamp);
  if (Number.isNaN(timestamp)) return { ok: false, reason: `unparseable timestamp "${fill.timestamp}"` };

  const input = resolveSide(fill.receivedLegs, chainIdsByName);
  if (typeof input === 'string') return { ok: false, reason: input };
  const output = resolveSide(fill.paidLegs, chainIdsByName);
  if (typeof output === 'string') return { ok: false, reason: output };

  const join = (legs: ResolvedLeg[]) => legs.map((l) => l.text).join(' + ');
  return {
    ok: true,
    row: {
      intentHash: fill.intentHash,
      srcChainId: input[0].chainId,
      dstChainId: output[0].chainId,
      timestamp,
      actionDetail: `SolverFill ${join(input)} -> ${join(output)}`,
      amountUsd: fill.unpricedLegs > 0 ? null : fill.usdPaid,
    },
  };
}
