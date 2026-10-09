// Shape of sodax-data-backend's GET /v1/intents/near/fills response.
// Field names confirmed against sodax-data-backend's models/tables.py and API
// router (see issue #151 comments) — kept isolated here so a contract change
// only touches this file.

export interface NearFillRow {
  // PK tuple: (timestamp, intent_hash, account_id).
  timestamp: string;
  intent_hash: string;
  account_id: string;
  block_height: number;
  receipt_id: string;
  // Raw on-chain units (not decimal-adjusted) — string because amounts can
  // exceed int64. { token_id: signed_amount_string }.
  diff: Record<string, string>;
  fees_collected: Record<string, string> | null;
  referral: string | null;
  // Server-derived, request-scoped (not stored): generic buy/sell direction.
  direction?: 'buy' | 'sell' | string;
  usd_received?: string | null;
  usd_paid?: string | null;
}

export interface NearFillsPage {
  fills: NearFillRow[];
  cursor: string | null;
  next_cursor: string | null;
  has_more: boolean;
  count: number;
  // Block height + time the backend has scanned through, present even on an
  // empty page — distinguishes "caught up" from "endpoint broken".
  indexed_through: {
    block_height: number;
    time: string;
  };
}
