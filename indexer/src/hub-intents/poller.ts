import { ethers } from 'ethers';
import { RPC_URLS, sonic, chains, idToChainNameMap } from '../configs';
import { bigintDivisionToDecimalString } from '../utils';
import {
  HubEventRow,
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

const INTENT_CANCELLED_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('IntentCancelled(bytes32)'),
);

// A Message event in the cancel tx means the cancel arrived cross-chain via the
// relayer (recorded by the upstream scanner from its spoke origin). Hub-native
// cancels are direct calls to the hub and emit no Message — that absence is the
// hub-only signal.
const MESSAGE_EVENT_TOPIC = ethers.keccak256(
  ethers.toUtf8Bytes('Message(uint256,bytes,uint256,uint256,bytes,bytes)'),
);

const INTENT_TUPLE =
  '(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)';
const CREATED_TUPLE = INTENT_TUPLE;

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const CONTRACT_ADDRESS = (
  process.env.HUB_INTENT_CONTRACT || '0x6382D6ccD780758C5e8A6123c33ee8F4472F96ef'
).toLowerCase();
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

  // Hub-only filter: a hub-native intent is created by a direct call to the
  // hub contract (tx.to === hub). Relayer-driven intents emit the same
  // IntentCreated event but arrive via the relayer router / multicall
  // (tx.to is that contract, not the hub) and are recorded by the upstream
  // scanner from their spoke origin — skip them here. The intent's own
  // src/dst chains are irrelevant to this distinction. `getLogs` omits the
  // transaction's `to`, so resolve it with one getTransaction per create.
  const txn = await rpcGate(() => getProvider().getTransaction(log.transactionHash));
  if (txn?.to?.toLowerCase() !== CONTRACT_ADDRESS) return;

  const inInfo = tokenInfo(srcChainId, inputToken);
  const outInfo = tokenInfo(dstChainId, outputToken);
  const inAmt = bigintDivisionToDecimalString(inputAmountRaw, inInfo.decimals);
  const outAmt = bigintDivisionToDecimalString(minOutputAmountRaw, outInfo.decimals);
  const srcName = idToChainNameMap[srcChainId] || srcChainId;
  const dstName = idToChainNameMap[dstChainId] || dstChainId;
  const actionDetail = `IntentSwap ${inAmt} ${inInfo.name}(${srcName}) -> ${outAmt} ${outInfo.name}(${dstName})`;

  const ts = await blockTs.get(log.blockNumber);
  const row: HubEventRow = {
    intentHash,
    actionType: 'CreateIntent',
    creator,
    solver,
    srcChainId,
    dstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    actionDetail,
    slippage: null,
  };
  console.log("intent created",{
    intentHash,
    actionType: 'CreateIntent',
    creator,
    solver,
    srcChainId,
    dstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    actionDetail,
    slippage: null,
  })
  // await insertHubEventAsMessage(row);
}

async function handleCancelled(
  log: ethers.Log,
  blockTs: BlockTimestampCache,
): Promise<void> {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const intentHash = abi.decode(['bytes32'], log.data)[0] as string;

  // Hub-only filter: skip cancels that arrived cross-chain. A relayer-driven
  // cancel emits a Message event in the same tx; a hub-native cancel does not.
  const receipt = await rpcGate(() => getProvider().getTransactionReceipt(log.transactionHash));
  if (!receipt) return;
  if (receipt.logs.some(l => l.topics[0] === MESSAGE_EVENT_TOPIC)) return;

  // IntentCancelled carries only the intent hash, so recover token/amounts from
  // the cancel call's calldata: cancelIntent(SwapIntent) — the same tuple shape
  // IntentCreated emits.
  const txn = await rpcGate(() => getProvider().getTransaction(log.transactionHash));
  if (!txn?.data || txn.data.length <= 10) return;
  const tuple = abi.decode([INTENT_TUPLE], `0x${txn.data.slice(10)}`)[0] as ethers.Result;

  const creator = (tuple[1] as string).toLowerCase();
  const inputToken = normalizeAddr(tuple[2] as string);
  const outputToken = normalizeAddr(tuple[3] as string);
  const inputAmountRaw = tuple[4] as bigint;
  const minOutputAmountRaw = tuple[5] as bigint;
  const srcChainId = (tuple[8] as bigint).toString();
  const dstChainId = (tuple[9] as bigint).toString();
  const solver = (tuple[12] as string).toLowerCase();

  const inInfo = tokenInfo(srcChainId, inputToken);
  const outInfo = tokenInfo(dstChainId, outputToken);
  const inAmt = bigintDivisionToDecimalString(inputAmountRaw, inInfo.decimals);
  const outAmt = bigintDivisionToDecimalString(minOutputAmountRaw, outInfo.decimals);
  const srcName = idToChainNameMap[srcChainId] || srcChainId;
  const dstName = idToChainNameMap[dstChainId] || dstChainId;
  const actionDetail = `IntentCancelled ${inAmt} ${inInfo.name}(${srcName}) -> ${outAmt} ${outInfo.name}(${dstName})`;

  const ts = await blockTs.get(log.blockNumber);
  const row: HubEventRow = {
    intentHash,
    actionType: 'CancelIntent',
    creator,
    solver,
    srcChainId,
    dstChainId,
    blockNumber: log.blockNumber,
    blockTimestamp: ts,
    txHash: log.transactionHash,
    actionDetail,
    slippage: null,
  };
  console.log("intent cancelled", row);
  // await insertHubEventAsMessage(row);
}

async function processBatch(fromBlock: number, toBlock: number): Promise<void> {
  const logs = await rpcGate(() => getProvider().getLogs({
    address: CONTRACT_ADDRESS,
    fromBlock,
    toBlock,
    topics: [[INTENT_CREATED_TOPIC, INTENT_CANCELLED_TOPIC]],
  }));
  if (logs.length === 0) return;

  const blockTs = makeBlockTsCache();

  let failures = 0;
  for (const log of logs) {
    try {
      if (log.topics[0] === INTENT_CANCELLED_TOPIC) {
        await handleCancelled(log, blockTs);
      } else {
        await handleCreated(log, blockTs);
      }
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`hub-intents: failed to process log ${log.transactionHash}#${log.index}:`, msg);
    }
  }

  // Any per-log failure must block cursor advance so the next tick replays the
  // whole batch. Inserts are idempotent via the WHERE NOT EXISTS clause keyed
  // on (intent_tx_hash, action_type, sn IS NULL). Persistent failures loop
  // visibly in logs.
  if (failures > 0) {
    throw new Error(
      `hub-intents: ${failures}/${logs.length} log(s) failed in [${fromBlock}, ${toBlock}] — not advancing cursor`,
    );
  }
}

async function runOnce(): Promise<void> {
  const head = await rpcGate(() => getProvider().getBlockNumber());
  const safeHead = head - CONFIRMATIONS;

  const stored = await getCursor(CURSOR_NAME);
  // First run (no cursor): start from the current chain head — skip historical
  // blocks and only index intents created from now on. Persist the starting
  // point so the next tick advances forward from here.
  if (stored === null) {
    await setCursor(CURSOR_NAME, safeHead);
    return;
  }
  if (safeHead <= stored) return;

  let from = stored + 1;
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
