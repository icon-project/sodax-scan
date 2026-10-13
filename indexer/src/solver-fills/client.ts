import axios from 'axios';

/**
 * Client for sodax-data-backend's market-maker trades feed. parseTradesPage
 * keeps only NEAR and LI.FI trades and only the fields the scanner needs:
 * venues, order ids and realised PnL identify the source marketplace and are
 * dropped here, so they never reach the database or logs.
 */

export interface MarketTrade {
  id: number;
  timestamp: string;
  /** Chain-specific tx or intent hash; for NEAR trades it equals the NEAR intent hash. */
  txHash: string;
  assetIn: string;
  assetOut: string;
  amountIn: number;
  amountOut: number;
  /** Chain suffix of the venue, e.g. "arb" from "lifi:arb". */
  chainIn: string;
  chainOut: string;
  notionalUsd: number | null;
}

export interface SkippedTrade {
  id: number;
  reason: string;
}

export interface TradesPage {
  trades: MarketTrade[];
  skipped: SkippedTrade[];
  /** Highest and lowest id on the raw page, including trades from venues that are dropped. Null on an empty page. */
  newestId: number | null;
  oldestId: number | null;
  hasMore: boolean;
  /** Pass as before_id to get the next (older) page. */
  nextCursor: number | null;
}

export interface TradesQuery {
  beforeId?: number;
}

export interface ClientConfig {
  baseUrl: string;
  pageSize: number;
  timeoutMs: number;
}

export class FillsResponseError extends Error {
  constructor(message: string) {
    super(`solver-fills: ${message}`);
    this.name = 'FillsResponseError';
  }
}

const TRADES_PATH = '/v1/mm/quoter/trades';

// Venue families that are solver marketplace fills. Others (sodax hub,
// Kraken spot) are not cross-chain fills and have no place in `messages`.
const FILL_VENUE_FAMILIES = new Set(['near', 'lifi']);

// YYYY-MM-DDTHH:MM[:SS[.fraction]] followed by Z or a UTC offset.
export const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Unix ms from the backend's ISO timestamp; fractional seconds beyond milliseconds are cut so every engine parses it. NaN when unparseable. */
export function parseIsoMs(iso: string): number {
  if (!ISO_TIMESTAMP_RE.test(iso)) return Number.NaN;
  return Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isId(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
}

function str(o: Obj, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v === '') throw new FillsResponseError(`${key} must be a non-empty string`);
  return v;
}

function finite(o: Obj, key: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new FillsResponseError(`${key} must be a finite number`);
  return v;
}

// "lifi:arb" → family "lifi", chain "arb".
function splitVenue(o: Obj, key: string): { family: string; chain: string } {
  const venue = str(o, key);
  const i = venue.indexOf(':');
  if (i <= 0 || i === venue.length - 1) throw new FillsResponseError(`${key} "${venue}" is not "<family>:<chain>"`);
  return { family: venue.slice(0, i).toLowerCase(), chain: venue.slice(i + 1).toLowerCase() };
}

function parseTrade(raw: Obj, id: number): MarketTrade {
  const timestamp = str(raw, 'ts');
  if (Number.isNaN(parseIsoMs(timestamp))) throw new FillsResponseError('ts must be an ISO timestamp');
  const notional = raw.notional_usd;
  if (notional !== null && (typeof notional !== 'number' || !Number.isFinite(notional))) {
    throw new FillsResponseError('notional_usd must be a finite number or null');
  }
  return {
    id,
    timestamp,
    txHash: str(raw, 'tx_hash'),
    assetIn: str(raw, 'asset_in'),
    assetOut: str(raw, 'asset_out'),
    amountIn: finite(raw, 'amount_in'),
    amountOut: finite(raw, 'amount_out'),
    chainIn: splitVenue(raw, 'in_venue').chain,
    chainOut: splitVenue(raw, 'out_venue').chain,
    notionalUsd: notional,
  };
}

/**
 * Validates one response page. Envelope errors, and any trade whose id is
 * missing or out of order, throw FillsResponseError: the poller's cursor is
 * the trade id, so a page it can't order is unusable. Any other per-trade
 * shape error moves that trade to `skipped`, so one bad trade doesn't stall
 * the cursor.
 */
export function parseTradesPage(body: unknown): TradesPage {
  if (!isObj(body)) throw new FillsResponseError('response body is not a JSON object');
  if (typeof body.has_more !== 'boolean') throw new FillsResponseError('has_more must be a boolean');
  const nextCursor = body.next_cursor;
  if (nextCursor !== null && !isId(nextCursor))
    throw new FillsResponseError('next_cursor must be a positive integer or null');
  if (!Array.isArray(body.trades)) throw new FillsResponseError('trades must be an array');

  const trades: MarketTrade[] = [];
  const skipped: SkippedTrade[] = [];
  let newestId: number | null = null;
  let previousId: number | null = null;
  for (const [i, raw] of body.trades.entries()) {
    if (!isObj(raw) || !isId(raw.id)) throw new FillsResponseError(`trades[${i}].id must be a positive integer`);
    const id = raw.id;
    if (previousId !== null && id >= previousId) {
      throw new FillsResponseError(`trades must be newest-first by id, got ${id} after ${previousId}`);
    }
    newestId ??= id;
    previousId = id;
    try {
      if (!FILL_VENUE_FAMILIES.has(splitVenue(raw, 'in_venue').family)) continue;
      trades.push(parseTrade(raw, id));
    } catch (err) {
      if (!(err instanceof FillsResponseError)) throw err;
      skipped.push({ id, reason: err.message.replace(/^solver-fills: /, '') });
    }
  }

  return {
    trades,
    skipped,
    newestId,
    oldestId: previousId,
    hasMore: body.has_more,
    nextCursor,
  };
}

export async function fetchTradesPage(cfg: ClientConfig, q: TradesQuery): Promise<TradesPage> {
  const params: Record<string, number> = { limit: cfg.pageSize };
  if (q.beforeId !== undefined) params.before_id = q.beforeId;
  try {
    const res = await axios.get(`${cfg.baseUrl.replace(/\/+$/, '')}${TRADES_PATH}`, {
      params,
      timeout: cfg.timeoutMs,
    });
    return parseTradesPage(res.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response ? String(err.response.status) : `no response${err.code ? `, ${err.code}` : ''}`;
      throw new FillsResponseError(`GET ${TRADES_PATH} before_id=${q.beforeId ?? 'none'} failed (${status})`);
    }
    throw err;
  }
}
