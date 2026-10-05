/**
 * Validation probe for sodax-data-backend's `GET /v1/intents/near/fills`.
 *
 * Fetches a single page from the real endpoint (no `account` param — the
 * server applies its own configured solver-account default) and dumps the
 * raw JSON shape, so the field names/types assumed in
 * `src/near-intents/types.ts` can be checked against a live response before
 * (or while) relying on them in the poller.
 *
 * Read-only: issues one GET request, writes nothing. Does not touch the
 * poller's cursor file.
 *
 * Usage: ts-node scripts/probe-near-intents-fills.ts [cursor]
 */

import 'dotenv/config';
import axios from 'axios';

const DATA_BACKEND_URL = process.env.NEAR_INTENTS_DATA_BACKEND_URL;
const FILLS_PATH = '/v1/intents/near/fills';
const cursorArg = process.argv[2];

async function main(): Promise<void> {
  if (!DATA_BACKEND_URL) {
    console.error('NEAR_INTENTS_DATA_BACKEND_URL is not set.');
    process.exitCode = 1;
    return;
  }

  const response = await axios.get(`${DATA_BACKEND_URL}${FILLS_PATH}`, {
    params: cursorArg ? { cursor: cursorArg } : undefined,
  });

  const body = response.data;
  console.log(`status: ${response.status}`);
  console.log(`has_more: ${body.has_more}`);
  console.log(`count: ${body.count}`);
  console.log(`next_cursor: ${JSON.stringify(body.next_cursor)}`);
  console.log(`indexed_through: ${JSON.stringify(body.indexed_through)}`);
  console.log(`fills (${Array.isArray(body.fills) ? body.fills.length : 0}):`);
  console.log(JSON.stringify(body.fills, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
