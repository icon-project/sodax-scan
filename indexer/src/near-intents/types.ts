// Shape of sodax-data-backend's `GET /v1/intents/near/fills` response, as
// confirmed against its source in issue #151's comment thread:
//   - storage PK is (timestamp, intent_hash, account_id) — one row per
//     participant per intent.
//   - `diff` is raw on-chain units (string, may exceed int64) keyed by
//     NEAR token id; `received_legs`/`paid_legs`/`usd_received`/`usd_paid`
//     are derived per-request (decimal-adjusted), not stored.
//   - cursor is an opaque base64url blob; a caught-up/empty page returns
//     `fills: []`, `has_more: false`, `next_cursor: null` with
//     `indexed_through` still populated.
// Isolated in this file so a future contract correction (field rename,
// leg shape, etc.) is a one-file change.

export interface NearFillLeg {
  token_id: string;
  amount: string;
}

export interface NearFillRow {
  timestamp: number | string;
  intent_hash: string;
  account_id: string;
  block_height: number;
  receipt_id: string;
  diff: Record<string, string>;
  fees_collected?: Record<string, string> | null;
  referral?: string | null;
  direction?: string;
  received_legs?: NearFillLeg[];
  paid_legs?: NearFillLeg[];
  usd_received?: string;
  usd_paid?: string;
}

export interface NearFillsIndexedThrough {
  block_height: number;
  time: number | string;
}

export interface NearFillsPage {
  fills: NearFillRow[];
  cursor: string | null;
  next_cursor: string | null;
  has_more: boolean;
  count: number;
  indexed_through: NearFillsIndexedThrough;
}
