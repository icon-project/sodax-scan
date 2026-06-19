/**
 * Backfill intra-hub IntentFilled / IntentCancelled events that the hub poller
 * silently dropped.
 *
 * Bug (fixed in src/hub-intents/repo.ts): the fill/cancel handlers resolved
 * their CreateIntent context with `AND sn IS NULL`, matching only hub-origin
 * creates. A cross-chain intent whose OUTPUT lands on the hub (dst = sonic) is
 * created on a spoke and recorded only by the relayer (sn IS NOT NULL); its
 * fill happens intra-hub with no relay delivery, so the relayer never indexes
 * it either. The hub poller saw the fill, found no sn-IS-NULL create, and
 * skipped it as an orphan — so the intent shows a create but no fill.
 *
 * The cursor has long since advanced past those blocks, so the live poller
 * won't revisit them. This script replays the hub contract logs over a block
 * range through the (now fixed) idempotent processBatch. Re-attempted creates
 * are skipped by the insert guards; previously-dropped intra-hub fills/cancels
 * are now written.
 *
 * Usage:
 *   ts-node -r dotenv/config scripts/backfill-intrahub-fills.ts \
 *     --from <launchBlock> --to <block> [--batch 5000]
 *
 * --from defaults to the hub-only feature launch block (71486865 on Sonic);
 * --to defaults to safe head (chain head - 12). Bump HUB_INTENT_RPC_QPS in the
 * env to speed up the one-time replay.
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import { RPC_URLS, sonic } from '../src/configs';
import { processBatch } from '../src/hub-intents/poller';

const args = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const LAUNCH_BLOCK = 71486865; // see project_hub_poller_ops memory
const CONFIRMATIONS = 12;
const batch = Number(argValue('--batch') || 5000);

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC_URLS[sonic]);
  const head = await provider.getBlockNumber();
  const from = Number(argValue('--from') || LAUNCH_BLOCK);
  const to = Number(argValue('--to') || head - CONFIRMATIONS);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    throw new Error(`bad range: from=${from} to=${to} (head=${head})`);
  }

  const totalBatches = Math.ceil((to - from + 1) / batch);
  console.log(
    `backfill intra-hub fills: blocks [${from}, ${to}] in ${totalBatches} batch(es) of ${batch}`,
  );

  let n = 0;
  for (let f = from; f <= to; f += batch) {
    const t = Math.min(f + batch - 1, to);
    await processBatch(f, t);
    n++;
    if (n % 20 === 0 || t === to) {
      console.log(`  ${n}/${totalBatches} batches (through block ${t})`);
    }
  }
  console.log('done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
