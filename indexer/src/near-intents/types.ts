/**
 * Wire types for sodax-data-backend's `GET /v1/intents/near/fills`.
 *
 * Field names/shapes here are the best read of the backend's
 * `NearIntentFill` model + its documented cursor/indexed_through hand-off
 * contract (resolved in issue #151's discussion), not yet verified against a
 * live response. This file is deliberately the only place that assumes the
 * wire shape — re-run `scripts/probe-near-intents-fills.ts` against the real
 * endpoint and fix the mapping here first if anything doesn't match.
 */

// One leg of a fill's token diff, decimal-adjusted by the backend (not raw
// on-chain units).
export interface NearIntentLeg {
  token_id: string;
  amount: string;
}

export interface NearFillRow {
  intent_hash: string;
  account_id: string;
  // Unix seconds, matching the block-timestamp convention used elsewhere in
  // this indexer (e.g. hub-intents' blockTimestamp).
  timestamp: number;
  block_height: number;
  receipt_id: string;
  direction?: string | null;
  received_legs?: NearIntentLeg[] | null;
  paid_legs?: NearIntentLeg[] | null;
  usd_received?: string | null;
  usd_paid?: string | null;
  referral?: string | null;
}

export interface NearFillsIndexedThrough {
  block_height: number;
  time: number;
}

export interface NearFillsPage {
  fills: NearFillRow[];
  cursor: string | null;
  next_cursor: string | null;
  has_more: boolean;
  count: number;
  indexed_through: NearFillsIndexedThrough;
}
