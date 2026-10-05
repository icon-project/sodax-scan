/**
 * One-shot probe for sodax-data-backend's NEAR Intents fills endpoint.
 *
 * Dumps a raw page from GET /v1/intents/near/fills so the response shape
 * (cursor/next_cursor/has_more/indexed_through, per-row fields) can be
 * checked against indexer/src/near-intents/types.ts before relying on it.
 * Read-only: no DB writes, no cursor file writes.
 *
 * Usage: ts-node scripts/probe-near-intents-fills.ts [cursor]
 */

import 'dotenv/config';
import axios from 'axios';

const DATA_BACKEND_URL = process.env.NEAR_INTENTS_DATA_BACKEND_URL;
const cursorArg = process.argv[2];

async function main(): Promise<void> {
  if (!DATA_BACKEND_URL) {
    throw new Error('NEAR_INTENTS_DATA_BACKEND_URL is not set');
  }
  const res = await axios.get(`${DATA_BACKEND_URL}/v1/intents/near/fills`, {
    params: cursorArg ? { cursor: cursorArg } : undefined,
  });
  console.log(JSON.stringify(res.data, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
