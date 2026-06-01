import { ethers } from 'ethers';
import { RPC_URLS, sonic, chains, idToChainNameMap } from '../configs';
import { bigintDivisionToDecimalString } from '../utils';
import {
  CreatedContext,
  CreatedEventRow,
  FilledEventRow,
  CancelledEventRow,
  getCreatedContext,
  getCreatedContextsByIntentHashes,
  getCursor,
  insertCancelledEvent,
  insertCreatedEvent,
  insertFilledEvent,
  setCursor,
} from './repo';

// Resolves the created-event context for an intent. Backed by a per-batch
// preload (one SELECT for all known intent_hashes in the batch) with a
// single-row fallback for cases the preload couldn't cover — namely intents
// whose CreateIntent log is in the same batch (the preload runs before
// handleCreated inserts those rows, so they wouldn't appear in the map).
type ContextLookup = (intentHash: string) => Promise<CreatedContext | null>;

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

function slippagePercent(expected: bigint, actual: bigint): string {
  if (expected === 0n) return '';
  const decimals = 4;
  const diff = actual - expected;
  const isNegative = diff < 0n;
  const absDiff = diff < 0n ? -diff : diff;
  const SCALE = BigInt(10 ** decimals);
  const scaled = (absDiff * SCALE * 100n) / expected;
  let s = scaled.toString();
  if (s.length <= decimals) s = s.padStart(decimals + 1, '0');
  const intPart = s.slice(0, s.length - decimals);
  const decPart = s.slice(s.length - decimals);
  return `${isNegative ? '-' : ''}${intPart}.${decPart}%`;
}

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

async function handleCreated(
  log: ethers.Log,
  blockTs: BlockTimestampCache,
): Promise<void> {
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
  const srcChainId = (tuple[8] as bigint).toString();
  const dstChainId = (tuple[9] as bigint).toString();
  const solver = (tuple[12] as string).toLowerCase();

  // Hub-origin filter: source leg on Sonic means the intent was created
  // hub-native (did not arrive via the relayer, so the relayer path won't
  // have it). Destination may be any chain — cross-network intents still
  // originate here and must be indexed.
  if (srcChainId !== sonic) return;

  const inInfo = tokenInfo(srcChainId, inputToken);
  const outInfo = tokenInfo(dstChainId, outputToken);
  const inAmt = bigintDivisionToDecimalString(inputAmountRaw, inInfo.decimals);
  const outAmt = bigintDivisionToDecimalString(minOutputAmountRaw, outInfo.decimals);
  const srcName = idToChainNameMap[srcChainId] || srcChainId;
  const dstName = idToChainNameMap[dstChainId] || dstChainId;
  const actionDetail = `IntentSwap ${inAmt} ${inInfo.name}(${srcName}) -> ${outAmt} ${outInfo.name}(${dstName})`;

  const ts = await blockTs.get(log.blockNumber);
  const row: CreatedEventRow = {
    intentHash,
    creator,
    solver,
    inputToken,
    outputToken,
    inputAmount: inputAmountRaw.toString(),
    minOutputAmount: minOutputAmountRaw.toString(),
    srcChainId,
    dstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    logIndex: log.index ?? 0,
    actionDetail,
  };
  await insertCreatedEvent(row);
}

async function handleFilled(
  log: ethers.Log,
  blockTs: BlockTimestampCache,
  lookupContext: ContextLookup,
): Promise<void> {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  // Match existing flattened-tuple decode pattern.
  const decoded = abi.decode(['(bytes32,bool,uint256,uint256,bool)'], log.data);
  const t = decoded[0] as ethers.Result;
  const intentHash = t[0] as string;
  const filledOutputRaw = t[3] as bigint;
  const filledOutputAmount = filledOutputRaw.toString();

  // Only record fills for intents we created (hub-origin). A null context means
  // the IntentFilled belongs to an intent the created-filter skipped or one
  // created before our START_BLOCK — recording it would orphan the event.
  const ctx = await lookupContext(intentHash);
  if (ctx === null) return;

  // Slippage = (filled - minOutput) / minOutput, signed. Negative = worse than min,
  // which should be impossible per contract invariants but we report it honestly.
  let slippage: string | undefined;
  if (ctx.minOutputAmount !== null && ctx.minOutputAmount > 0n) {
    slippage = slippagePercent(ctx.minOutputAmount, filledOutputRaw);
  }

  const outInfo = tokenInfo(ctx.dstChainId, ctx.outputToken);
  const outAmt = bigintDivisionToDecimalString(filledOutputRaw, outInfo.decimals);
  const dstName = idToChainNameMap[ctx.dstChainId] || ctx.dstChainId;
  const actionDetail = `IntentFilled ${outAmt} ${outInfo.name}(${dstName})`;

  const ts = await blockTs.get(log.blockNumber);
  const row: FilledEventRow = {
    intentHash,
    filledOutputAmount,
    creator: ctx.creator,
    solver: ctx.solver,
    srcChainId: ctx.srcChainId,
    dstChainId: ctx.dstChainId,
    slippage,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    logIndex: log.index ?? 0,
    actionDetail,
  };
  await insertFilledEvent(row);
}

async function handleCancelled(
  log: ethers.Log,
  blockTs: BlockTimestampCache,
  lookupContext: ContextLookup,
): Promise<void> {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const decoded = abi.decode(['bytes32'], log.data);
  const intentHash = decoded[0] as string;

  // Same orphan guard as fills: only record cancels for intents we created.
  const ctx = await lookupContext(intentHash);
  if (ctx === null) return;

  const ts = await blockTs.get(log.blockNumber);
  const row: CancelledEventRow = {
    intentHash,
    creator: ctx.creator,
    solver: ctx.solver,
    srcChainId: ctx.srcChainId,
    dstChainId: ctx.dstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    logIndex: log.index ?? 0,
    actionDetail: 'IntentCancelled',
  };
  await insertCancelledEvent(row);
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

  // Process strictly in order: created → filled / cancelled within same batch
  // would otherwise risk updating a row that hasn't been inserted yet.
  logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return (a.index ?? 0) - (b.index ?? 0);
  });

  // Preload created contexts for every fill/cancel hash in this batch with
  // one query, instead of one SELECT per log. The lookup falls back to a
  // single-row query only for hashes whose CreateIntent log lives in the
  // SAME batch (preload runs before handleCreated inserts those rows, so
  // they can't appear in the map). Pre-batch creates are cached either way.
  const lookupContext = makeContextLookup(
    await getCreatedContextsByIntentHashes(extractIntentHashes(logs)),
  );

  let failures = 0;
  for (const log of logs) {
    try {
      const topic0 = log.topics[0];
      if (topic0 === INTENT_CREATED_TOPIC) {
        await handleCreated(log, blockTs);
      } else if (topic0 === INTENT_FILLED_TOPIC) {
        await handleFilled(log, blockTs, lookupContext);
      } else if (topic0 === INTENT_CANCELLED_TOPIC) {
        await handleCancelled(log, blockTs, lookupContext);
      }
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`hub-intents: failed to process log ${log.transactionHash}#${log.index}:`, msg);
    }
  }

  // Any per-log failure must block cursor advance. A failed handleCreated
  // would otherwise leave its sibling fill/cancel orphaned forever (the
  // context lookup returns null and the event is silently skipped) once the
  // cursor moves past this block range. The inserts are idempotent via the
  // (tx_hash, log_index) unique constraint, so the next tick replays the
  // whole batch safely. Persistent failures will loop visibly in logs.
  if (failures > 0) {
    throw new Error(
      `hub-intents: ${failures}/${logs.length} log(s) failed in [${fromBlock}, ${toBlock}] — not advancing cursor`,
    );
  }
}

// Pulls the first bytes32 word out of each fill/cancel log's `data` — that's
// the intent hash in both event signatures. Avoids running ABI decode just to
// build the preload key set; the per-event handlers still decode the full
// payload when they actually process the log.
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
  // Case-insensitive lookup: bytes32 hashes round-trip from RPC in lowercase
  // hex but downstream code shouldn't have to care which casing came back.
  const lower = new Map<string, CreatedContext>();
  for (const [k, v] of preload) lower.set(k.toLowerCase(), v);
  return async (intentHash: string) => {
    const key = intentHash.toLowerCase();
    const hit = lower.get(key);
    if (hit) return hit;
    // Miss = either the CreateIntent landed in this same batch (preload
    // captured a snapshot before handleCreated wrote it) or it's a true
    // orphan. One per-miss query handles the former and lets the latter
    // return null as before.
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
