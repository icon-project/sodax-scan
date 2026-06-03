import { ethers } from 'ethers';
import { RPC_URLS, sonic, chains, idToChainNameMap } from '../configs';
import { bigintDivisionToDecimalString } from '../utils';
import { formatFillFromCreateActionDetail } from '../intent-fill-format';
import {
  CreatedContext,
  HubEventRow,
  getCreatedContext,
  getCreatedContextsByIntentHashes,
  getCursor,
  insertHubEventAsMessage,
  setCursor,
} from './repo';

const CURSOR_NAME = 'sonic_hub_intents';

const INTENT_CREATED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes(
    'IntentCreated(bytes32,(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))',
  ),
);
const INTENT_FILLED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('IntentFilled(bytes32,(bool,uint256,uint256,bool))'),
);
const INTENT_CANCELLED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('IntentCancelled(bytes32)'),
);

const CREATED_TUPLE =
  '(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const CONTRACT_ADDRESS = (
  process.env.HUB_INTENT_CONTRACT || '0x6382D6ccD780758C5e8A6123c33ee8F4472F96ef'
).toLowerCase();
const START_BLOCK = envInt('HUB_INTENT_START_BLOCK', 18681775);
const POLL_INTERVAL_MS = envInt('HUB_INTENT_POLL_INTERVAL_MS', 30_000);
const BATCH_SIZE = envInt('HUB_INTENT_BATCH_SIZE', 5_000);
const CONFIRMATIONS = envInt('HUB_INTENT_CONFIRMATIONS', 12);
const RPC_QPS = Math.max(1, envInt('HUB_INTENT_RPC_QPS', 4));
const MIN_RPC_INTERVAL_MS = Math.ceil(1000 / RPC_QPS);

// Serial gate: every awaiter is spaced at least MIN_RPC_INTERVAL_MS apart so
// total Sonic RPC traffic from this poller stays at or under RPC_QPS.
let rpcChain: Promise<void> = Promise.resolve();
let lastRpcAt = 0;
function rpcGate<T>(fn: () => Promise<T>): Promise<T> {
  const run = rpcChain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRpcAt + MIN_RPC_INTERVAL_MS - now);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRpcAt = Date.now();
  });
  rpcChain = run.catch(() => {});
  return run.then(fn);
}

let provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URLS[sonic]);
  }
  return provider;
}

// Looks up the CreateIntent context for an intent. Backed by a per-batch
// preload with a single-row fallback for same-batch creates.
type ContextLookup = (intentHash: string) => Promise<CreatedContext | null>;

// EVM/ICON hex addresses (0x…, cx…) are case-insensitive — normalise them so
// checksum vs all-lowercase variants both match registry keys. Base58/bech32
// addresses (Solana, Stellar, Sui, Bitcoin, …) ARE case-sensitive: lowercasing
// destroys them and would miss the registry entry that configs.ts deliberately
// stores in its canonical mixed case. Keep this rule mirrored with configs.ts.
function normalizeAddr(addr: string): string {
  return /^(0x|cx)[0-9a-fA-F]+$/.test(addr) ? addr.toLowerCase() : addr;
}

function tokenInfo(chainId: string, addr: string): { name: string; decimals: number } {
  const key = normalizeAddr(addr);
  const assets = chains[chainId]?.Assets;
  if (assets && key in assets) {
    return { name: assets[key].name, decimals: assets[key].decimals };
  }
  // Unknown token: action_detail will use the raw address as the symbol and
  // fall back to 18 decimals, which is wrong for USDC (6), WBTC (8), etc.
  // Warn once per (chain, addr) so missing config entries surface in logs.
  warnMissingToken(chainId, addr);
  return { name: addr, decimals: 18 };
}

const missingTokenSeen = new Set<string>();
function warnMissingToken(chainId: string, addr: string): void {
  const key = `${chainId}:${addr}`;
  if (missingTokenSeen.has(key)) return;
  missingTokenSeen.add(key);
  console.warn(
    `hub-intents: tokenInfo miss on chain ${chainId} for ${addr} — defaulting to 18 decimals.`,
  );
}

interface BlockTimestampCache {
  get(blockNumber: number): Promise<number>;
}

function makeBlockTsCache(): BlockTimestampCache {
  const cache = new Map<number, number>();
  return {
    async get(blockNumber: number): Promise<number> {
      const hit = cache.get(blockNumber);
      if (hit !== undefined) return hit;
      const block = await rpcGate(() => getProvider().getBlock(blockNumber));
      const ts = Number(block?.timestamp ?? 0);
      cache.set(blockNumber, ts);
      return ts;
    },
  };
}

// Handlers return:
//   true  → row was newly written to messages
//   false → row already existed (WHERE NOT EXISTS matched, no write)
//   void  → event filtered out before any INSERT attempt
// processBatch aggregates these to log a per-batch write/skip summary.
async function handleCreated(
  log: ethers.Log,
  blockTs: BlockTimestampCache,
): Promise<boolean> {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const decoded = abi.decode(['bytes32', CREATED_TUPLE], log.data);
  const intentHash = decoded[0] as string;
  const tuple = decoded[1] as ethers.Result;

  // creator/solver come off the Sonic contract as EVM-style addresses, so
  // lowercasing them is safe and matches downstream filter comparisons.
  // Token addresses, however, may reference non-EVM tokens on cross-chain
  // intents (e.g. Solana mint, Stellar issuer) — normalize only when hex.
  const creator = (tuple[1] as string).toLowerCase();
  const inputToken = normalizeAddr(tuple[2] as string);
  const outputToken = normalizeAddr(tuple[3] as string);
  const inputAmountRaw = tuple[4] as bigint;
  const minOutputAmountRaw = tuple[5] as bigint;
  const tupleSrcChainId = (tuple[8] as bigint).toString();
  const tupleDstChainId = (tuple[9] as bigint).toString();
  const solver = (tuple[12] as string).toLowerCase();

  const inInfo = tokenInfo(tupleSrcChainId, inputToken);
  const outInfo = tokenInfo(tupleDstChainId, outputToken);
  const inAmt = bigintDivisionToDecimalString(inputAmountRaw, inInfo.decimals);
  const outAmt = bigintDivisionToDecimalString(minOutputAmountRaw, outInfo.decimals);
  const srcName = idToChainNameMap[tupleSrcChainId] || tupleSrcChainId;
  const dstName = idToChainNameMap[tupleDstChainId] || tupleDstChainId;
  const actionDetail = `IntentSwap ${inAmt} ${inInfo.name}(${srcName}) -> ${outAmt} ${outInfo.name}(${dstName})`;

  const ts = await blockTs.get(log.blockNumber);
  const row: HubEventRow = {
    intentHash,
    eventType: 'created',
    actionType: 'CreateIntent',
    creator,
    solver,
    srcChainId: sonic,
    dstChainId: tupleDstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    actionDetail,
    slippage: null,
  };
  return insertHubEventAsMessage(row);
}

async function handleFilled(
  log: ethers.Log,
  blockTs: BlockTimestampCache,
  lookupContext: ContextLookup,
): Promise<boolean | void> {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  // Match existing flattened-tuple decode pattern.
  const decoded = abi.decode(['(bytes32,bool,uint256,uint256,bool)'], log.data);
  const t = decoded[0] as ethers.Result;
  const intentHash = t[0] as string;
  const filledOutputRaw = t[3] as bigint;

  // A null context means the IntentCreated log for this intent is missing
  // (typically created before HUB_INTENT_START_BLOCK). Recording the fill
  // without it would orphan the event from its create.
  const ctx = await lookupContext(intentHash);
  if (ctx === null) return;

  // Cross-chain fills produce a Sonic→spoke delivery message that the
  // upstream relayer already indexes — only intra-hub fills are written here.
  if (ctx.dstChainId !== sonic) return;

  const fmt = formatFillFromCreateActionDetail(ctx.actionDetail, filledOutputRaw);
  const actionDetail = fmt?.actionDetail ?? `IntentFilled ${filledOutputRaw.toString()}`;
  const slippage = fmt?.slippage ? fmt.slippage : null;

  const ts = await blockTs.get(log.blockNumber);
  const row: HubEventRow = {
    intentHash,
    eventType: 'filled',
    actionType: 'IntentFilled',
    creator: ctx.creator,
    solver: ctx.solver,
    srcChainId: ctx.srcChainId,
    dstChainId: ctx.dstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    actionDetail,
    slippage,
  };
  return insertHubEventAsMessage(row);
}

async function handleCancelled(
  log: ethers.Log,
  blockTs: BlockTimestampCache,
  lookupContext: ContextLookup,
): Promise<boolean | void> {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const decoded = abi.decode(['bytes32'], log.data);
  const intentHash = decoded[0] as string;

  // Same orphan guard as fills: only record cancels for intents we created.
  const ctx = await lookupContext(intentHash);
  if (ctx === null) return;

  // Same cross-chain skip as fills: rollback delivery is relayer-indexed.
  if (ctx.dstChainId !== sonic) return;

  const ts = await blockTs.get(log.blockNumber);
  const row: HubEventRow = {
    intentHash,
    eventType: 'cancelled',
    actionType: 'CancelIntent',
    creator: ctx.creator,
    solver: ctx.solver,
    srcChainId: ctx.srcChainId,
    dstChainId: ctx.dstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    actionDetail: 'IntentCancelled',
    slippage: null,
  };
  return insertHubEventAsMessage(row);
}

async function processBatch(fromBlock: number, toBlock: number): Promise<void> {
  const logs = await rpcGate(() => getProvider().getLogs({
    address: CONTRACT_ADDRESS,
    fromBlock,
    toBlock,
    topics: [[INTENT_CREATED_TOPIC, INTENT_FILLED_TOPIC, INTENT_CANCELLED_TOPIC]],
  }));
  if (logs.length === 0) return;

  const blockTs = makeBlockTsCache();

  // Order matters: a fill / cancel handler looks up its CreateIntent's
  // context, and when the matching create lives in the same batch the
  // lookup's fallback query needs the create row already inserted.
  logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return (a.index ?? 0) - (b.index ?? 0);
  });

  // One preload SELECT for every fill/cancel in this batch (vs. N round
  // trips). Same-batch creates land in the fallback single-row query.
  const lookupContext = makeContextLookup(
    await getCreatedContextsByIntentHashes(extractIntentHashes(logs)),
  );

  let failures = 0;
  let wrote = 0;
  let skippedExisting = 0;
  for (const log of logs) {
    try {
      const topic0 = log.topics[0];
      let result: boolean | void = undefined;
      if (topic0 === INTENT_CREATED_TOPIC) {
        result = await handleCreated(log, blockTs);
      } else if (topic0 === INTENT_FILLED_TOPIC) {
        result = await handleFilled(log, blockTs, lookupContext);
      } else if (topic0 === INTENT_CANCELLED_TOPIC) {
        result = await handleCancelled(log, blockTs, lookupContext);
      }
      if (result === true) wrote++;
      else if (result === false) skippedExisting++;
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`hub-intents: failed to process log ${log.transactionHash}#${log.index}:`, msg);
    }
  }

  // Surface the write/skip mix so we can monitor the rate of redundant
  // INSERT attempts (skippedExisting = row was already in messages).
  if (wrote > 0 || skippedExisting > 0) {
    console.log(
      `hub-intents: [${fromBlock}-${toBlock}] wrote=${wrote} skipped_existing=${skippedExisting}`,
    );
  }

  // Block cursor advance on any per-log failure: a failed create would
  // otherwise orphan its sibling fill/cancel once the cursor moves past
  // this range (context lookup returns null → skipped silently). Inserts
  // are idempotent so the next tick replays the whole batch safely.
  if (failures > 0) {
    throw new Error(
      `hub-intents: ${failures}/${logs.length} log(s) failed in [${fromBlock}, ${toBlock}] — not advancing cursor`,
    );
  }
}

// First bytes32 of `data` is the intent hash in both fill and cancel event
// signatures — extract it without a full ABI decode.
function extractIntentHashes(logs: ethers.Log[]): string[] {
  const out: string[] = [];
  for (const log of logs) {
    const topic0 = log.topics[0];
    if (topic0 !== INTENT_FILLED_TOPIC && topic0 !== INTENT_CANCELLED_TOPIC) continue;
    if (typeof log.data !== 'string' || log.data.length < 66) continue;
    out.push(`0x${log.data.slice(2, 66)}`.toLowerCase());
  }
  return out;
}

function makeContextLookup(preload: Map<string, CreatedContext>): ContextLookup {
  // Normalize hash case so callers don't have to think about it.
  const lower = new Map<string, CreatedContext>();
  for (const [k, v] of preload) lower.set(k.toLowerCase(), v);
  return async (intentHash: string) => {
    const key = intentHash.toLowerCase();
    const hit = lower.get(key);
    if (hit) return hit;
    // Miss: either a same-batch create the preload didn't see, or an orphan.
    return getCreatedContext(intentHash);
  };
}

async function runOnce(): Promise<void> {
  const cursor = (await getCursor(CURSOR_NAME)) ?? START_BLOCK - 1;
  const head = await rpcGate(() => getProvider().getBlockNumber());
  const safeHead = head - CONFIRMATIONS;
  if (safeHead <= cursor) return;

  let from = cursor + 1;
  while (from <= safeHead) {
    const to = Math.min(from + BATCH_SIZE - 1, safeHead);
    await processBatch(from, to);
    await setCursor(CURSOR_NAME, to);
    from = to + 1;
  }
}

let running = false;
export function startHubIntentsPoller(): NodeJS.Timeout {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (err) {
      console.error('hub-intents: poll error:', err);
    } finally {
      running = false;
    }
  };
  // Fire immediately, then on interval.
  void tick();
  return setInterval(tick, POLL_INTERVAL_MS);
}
