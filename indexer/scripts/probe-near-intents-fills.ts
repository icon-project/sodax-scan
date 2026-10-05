/**
 * Validation probe for sodax-data-backend's NEAR Intents fills endpoint.
 *
 * Fetches one page from GET /v1/intents/near/fills and dumps the raw shape,
 * so the near-intents poller's mapping (src/near-intents/types.ts) can be
 * checked against what the backend actually returns.
 *
 * Read-only, no DB access. Usage:
 *   ts-node scripts/probe-near-intents-fills.ts [cursor]
 *
 * Requires NEAR_INTENTS_DATA_BACKEND_URL in the environment.
 */

import 'dotenv/config';
import axios from 'axios';
import { NearFillsPage } from '../src/near-intents/types';

async function main(): Promise<void> {
  const baseUrl = (process.env.NEAR_INTENTS_DATA_BACKEND_URL || '').replace(/\/+$/, '');
  if (!baseUrl) {
    console.error('NEAR_INTENTS_DATA_BACKEND_URL is not set');
    process.exit(1);
  }

  const cursor = process.argv[2];
  const params: Record<string, string> = {};
  if (cursor) params.cursor = cursor;

  const { data } = await axios.get<NearFillsPage>(`${baseUrl}/v1/intents/near/fills`, { params });

  console.log(`fills: ${data.fills?.length ?? 0}`);
  console.log(`has_more: ${data.has_more}`);
  console.log(`cursor: ${data.cursor}`);
  console.log(`next_cursor: ${data.next_cursor}`);
  console.log(`indexed_through:`, data.indexed_through);
  console.log('\nfirst fill (raw):');
  console.log(JSON.stringify(data.fills?.[0], null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
