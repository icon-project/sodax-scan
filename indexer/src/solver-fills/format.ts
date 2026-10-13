import { type FillVenue, type MarketTrade, parseIsoMs } from './client';

export interface SolverMarketPlaceFillRow {
  intentHash: string;
  srcChainId: string;
  dstChainId: string;
  /** Fill time, unix seconds. */
  timestamp: number;
  actionDetail: string;
  amountUsd: string | null;
}

export type FillMapResult = { ok: true; row: SolverMarketPlaceFillRow } | { ok: false; reason: string };

// Venue chain suffixes that differ from our configs.ts chain keys.
const CHAIN_ALIASES: Record<string, string> = {
  eth: 'ethereum',
  arb: 'arbitrum',
  op: 'optimism',
  pol: 'polygon',
  sol: 'solana',
  zec: 'zcash',
};

const VENUE_LABELS: Record<FillVenue, string> = {
  near: 'near.intents',
  lifi: 'lifi.intents',
};

/** Unix seconds from an ISO timestamp. */
export function isoToUnixSeconds(iso: string): number {
  return Math.floor(parseIsoMs(iso) / 1000);
}

// Plain decimal, never exponent notation.
function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 18 });
}

// The feed reports the chain a token sits on; the scanner shows its origin
// chain. BTC on NEAR (nBTC) is the only NEAR-held asset whose origin differs.
const ORIGIN_CHAIN_OVERRIDES: Record<string, string> = {
  'near:BTC': 'bitcoin',
};

function resolveChain(
  suffix: string,
  asset: string,
  chainIdsByName: Record<string, string>,
): { name: string; id: string } | string {
  const name = ORIGIN_CHAIN_OVERRIDES[`${suffix}:${asset}`] ?? CHAIN_ALIASES[suffix] ?? suffix;
  const id = chainIdsByName[name];
  return id ? { name, id } : `unknown chain "${suffix}"`;
}

/**
 * Maps a trade to a messages row. asset_in is what the solver received (the
 * user's input, src side), asset_out what it paid (the user's output, dst
 * side). Returns a stable reason string when the trade can't be mapped, so
 * callers can warn once per reason.
 */
export function tradeToRow(trade: MarketTrade, chainIdsByName: Record<string, string>): FillMapResult {
  const src = resolveChain(trade.chainIn, trade.assetIn, chainIdsByName);
  if (typeof src === 'string') return { ok: false, reason: src };
  const dst = resolveChain(trade.chainOut, trade.assetOut, chainIdsByName);
  if (typeof dst === 'string') return { ok: false, reason: dst };

  return {
    ok: true,
    row: {
      intentHash: trade.txHash,
      srcChainId: src.id,
      dstChainId: dst.id,
      // parseTradesPage already rejected unparseable timestamps.
      timestamp: isoToUnixSeconds(trade.timestamp),
      actionDetail: `SolverMarketPlaceFill ${formatAmount(trade.amountIn)} ${trade.assetIn}(${src.name}) -> ${formatAmount(trade.amountOut)} ${trade.assetOut}(${dst.name}) via ${VENUE_LABELS[trade.venue]}`,
      amountUsd: trade.notionalUsd === null ? null : formatAmount(trade.notionalUsd),
    },
  };
}
