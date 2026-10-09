import axios from 'axios';

/**
 * Client for sodax-data-backend's solver fills feed. parseFillsPage keeps only
 * the fields the scanner needs: account ids, receipt ids, token diffs, fees and
 * referrals identify the source marketplace and are dropped here, so they never
 * reach the database or logs.
 */

export interface FillLeg {
  label: string;
  amount: number;
}

export interface SolverFill {
  timestamp: string;
  intentHash: string;
  receivedLegs: FillLeg[];
  paidLegs: FillLeg[];
  usdPaid: string | null;
  unpricedLegs: number;
}

export interface SkippedFill {
  intentHash: string | null;
  reason: string;
}

export interface FillsPage {
  fills: SolverFill[];
  skipped: SkippedFill[];
  lastTimestamp: string | null;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface FillsQuery {
  from: string;
  cursor?: string;
}

export interface ClientConfig {
  baseUrl: string;
  accounts: string[];
  pageSize: number;
  timeoutMs: number;
}

export class FillsResponseError extends Error {
  constructor(message: string) {
    super(`solver-fills: ${message}`);
    this.name = 'FillsResponseError';
  }
}

const FILLS_PATH = '/v1/intents/near/fills';

// YYYY-MM-DDTHH:MM[:SS[.fraction]] followed by Z or a UTC offset.
export const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Unix ms from the backend's ISO timestamp; fractional seconds beyond milliseconds are cut so every engine parses it. NaN when unparseable. */
export function parseIsoMs(iso: string): number {
  if (!ISO_TIMESTAMP_RE.test(iso)) return NaN;
  return Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Obj, key: string, where?: string): string {
  const v = o[key];
  const path = where ? `${where}.${key}` : key;
  if (typeof v !== 'string' || v === '') throw new FillsResponseError(`${path} must be a non-empty string`);
  return v;
}

function parseLegs(v: unknown, where: string): FillLeg[] {
  if (!Array.isArray(v)) throw new FillsResponseError(`${where} must be an array`);
  return v.map((leg, i) => {
    const at = `${where}[${i}]`;
    if (!isObj(leg)) throw new FillsResponseError(`${at} must be an object`);
    if (typeof leg.amount !== 'number' || !Number.isFinite(leg.amount)) {
      throw new FillsResponseError(`${at}.amount must be a finite number`);
    }
    return { label: str(leg, 'label', at), amount: leg.amount };
  });
}

function fillTimestamp(v: Obj): string {
  const t = v.timestamp;
  if (typeof t !== 'string' || t === '' || Number.isNaN(parseIsoMs(t))) {
    throw new FillsResponseError('timestamp must be an ISO timestamp');
  }
  return t;
}

function parseFill(v: unknown): SolverFill {
  if (!isObj(v)) throw new FillsResponseError('fill must be an object');
  const usdPaid = v.usd_paid;
  if (usdPaid !== null && typeof usdPaid !== 'string') {
    throw new FillsResponseError('usd_paid must be a string or null');
  }
  if (typeof v.unpriced_legs !== 'number') throw new FillsResponseError('unpriced_legs must be a number');
  return {
    timestamp: fillTimestamp(v),
    intentHash: str(v, 'intent_hash'),
    receivedLegs: parseLegs(v.received_legs, 'received_legs'),
    paidLegs: parseLegs(v.paid_legs, 'paid_legs'),
    usdPaid,
    unpricedLegs: v.unpriced_legs,
  };
}

function rawIntentHash(raw: unknown): string | null {
  return isObj(raw) && typeof raw.intent_hash === 'string' && raw.intent_hash !== '' ? raw.intent_hash : null;
}

function rawTimestamp(raw: unknown): string | null {
  if (!isObj(raw) || typeof raw.timestamp !== 'string' || raw.timestamp === '') return null;
  return Number.isNaN(parseIsoMs(raw.timestamp)) ? null : raw.timestamp;
}

/**
 * Validates one response page. Envelope errors (shape of the page itself) throw
 * FillsResponseError. A per-fill shape error is caught and the fill is moved to
 * `skipped` instead, so one bad fill doesn't stall the whole page's cursor.
 */
export function parseFillsPage(body: unknown): FillsPage {
  if (!isObj(body)) throw new FillsResponseError('response body is not a JSON object');
  // The cursor only moves forward if pages arrive oldest-first.
  if (body.order !== 'asc') throw new FillsResponseError('expected order "asc"');
  if (typeof body.has_more !== 'boolean') throw new FillsResponseError('has_more must be a boolean');
  const nextCursor = body.next_cursor;
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new FillsResponseError('next_cursor must be a string or null');
  }
  if (!Array.isArray(body.fills)) throw new FillsResponseError('fills must be an array');

  const fills: SolverFill[] = [];
  const skipped: SkippedFill[] = [];
  for (const raw of body.fills) {
    try {
      fills.push(parseFill(raw));
    } catch (err) {
      if (!(err instanceof FillsResponseError)) throw err;
      skipped.push({ intentHash: rawIntentHash(raw), reason: err.message.replace(/^solver-fills: /, '') });
    }
  }

  let lastTimestamp: string | null = null;
  if (body.fills.length > 0) {
    lastTimestamp = rawTimestamp(body.fills[body.fills.length - 1]) ?? (fills.length > 0 ? fills[fills.length - 1].timestamp : null);
  }

  return { fills, skipped, lastTimestamp, hasMore: body.has_more, nextCursor };
}

export async function fetchFillsPage(cfg: ClientConfig, q: FillsQuery): Promise<FillsPage> {
  const params: Record<string, string | number> = {
    order: 'asc',
    from: q.from,
    accounts: cfg.accounts.join(','),
    limit: cfg.pageSize,
  };
  if (q.cursor) params.cursor = q.cursor;
  try {
    const res = await axios.get(`${cfg.baseUrl.replace(/\/+$/, '')}${FILLS_PATH}`, {
      params,
      timeout: cfg.timeoutMs,
    });
    return parseFillsPage(res.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response ? String(err.response.status) : `no response${err.code ? `, ${err.code}` : ''}`;
      throw new FillsResponseError(`GET ${FILLS_PATH} from=${q.from} failed (${status})`);
    }
    throw err;
  }
}
