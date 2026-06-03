import * as fs from "node:fs";
import * as path from "node:path";
export const base = "30"
export const avax = "6"
export const sonic = "146"
export const hyperliquid = "26745"
export const arbitrum = "23"
export const optimism = "24"
export const nibiru = "7235938"
export const polygon = "5"
export const bsc = "4"
export const botanix = "2203"
export const stellar = "27"
export const icon = "1768124270"
export const solana = "1"
export const sui = "21"
export const injective = "19"
export const near = "15"
export const lightlink = "27756"
export const ethereum = "2"
export const redbelly = "726564"
export const kaia = "27489"
export const bitcoin = "627463"
export const stacks = "60"
export const aleo = "6694886634401"

export type AssetInfo = {
  name: string;
  decimals: number;
  /**
   * True for hub-side liquid wraps (sodaBNB, sodaNEAR, …) — ERC-20 contracts
   * are always 18 decimals, but the API reports the underlying asset's native
   * decimals (e.g. 24 for sodaNEAR). Money-market / ERC-20 contexts should
   * force 18; intent contexts should use `decimals` as-is.
   */
  isSodaWrap?: boolean;
};

type ChainAssets = {
  AssetManager: string;
  Assets: {
    [assetAddress: string]: AssetInfo;
  };
};

type Chains = {
  [chainName: string]: ChainAssets;
};


const chainNameToIdMap: Record<string, string> = {
  sonic,
  base,
  avax: avax,
  stellar: stellar,
  nibiru: nibiru,
  hyperliquid: hyperliquid,
  arbitrum: arbitrum,
  bsc: bsc,
  polygon: polygon,
  botanix: botanix,
  optimism: optimism,
  icon: icon,
  solana: solana,
  sui: sui,
  injective: injective,
  near: near,
  lightlink: lightlink,
  ethereum: ethereum,
  redbelly: redbelly,
  kaia: kaia,
  bitcoin: bitcoin,
  stacks: stacks,
  aleo: aleo,
};

export const idToChainNameMap: Record<string, string> = Object.fromEntries(
  Object.entries(chainNameToIdMap).map(([key, value]) => [value, key])
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const RPC_URLS: Record<string, string> = {
  [avax]: requireEnv("AVAX_URL"),
  [sonic]: requireEnv("SONIC_URL"),
  [hyperliquid]: requireEnv("HYPERLIQUID_URL"),
  [polygon]: requireEnv("POLYGON_URL"),
  [arbitrum]: requireEnv("ARBITRUM_URL"),
  [bsc]: requireEnv("BSC_URL"),
  [optimism]: requireEnv("OPTIMISM_URL"),
  [base]: requireEnv("BASE_URL"),
  [nibiru]: requireEnv("NIBIRU_URL"),
  [botanix]: requireEnv("BOTANIX_URL"),
  [stellar]: requireEnv("STELLAR_URL"),
  [icon]: requireEnv("ICON_URL"),
  [sui]: requireEnv("SUI_URL"),
  [solana]: requireEnv("SOLANA_URL"),
  [injective]: requireEnv("INJECTIVE_URL"),
  [lightlink]: requireEnv("LIGHTLINK_URL"),
  [ethereum]: requireEnv("ETHEREUM_URL"),
  [redbelly]: requireEnv("REDBELLY_URL"),
  [kaia]: requireEnv("KAIA_URL"),
  [bitcoin]: requireEnv("BITCOIN_URL"),
  [stacks]: requireEnv("STACKS_URL"),
  [aleo]: requireEnv("ALEO_URL"),
};

type ChainsById = {
  [chainId: string]: ChainAssets;
};

function loadChains(filePath: string): Chains {
  const fullPath = path.resolve(filePath);
  const jsonString = fs.readFileSync(fullPath, { encoding: "utf8" });
  const parsed: Record<string, ChainAssets> = JSON.parse(jsonString);
  const chainsById: ChainsById = {};

  for (const [chainName, chainAssets] of Object.entries(parsed)) {
    const chainId = chainNameToIdMap[chainName];
    if (chainId === undefined) {
      console.warn(`Warning: No chainId found for chain name "${chainName}", skipping.`);
      continue;
    }
    chainsById[chainId] = chainAssets;
  }
  return chainsById;
}
export const chains: Chains = loadChains("./config.json")

const HUB_ASSETS_URL = "https://api.sodax.com/v1/be/config/hub/assets";
const RELAY_MAP_URL = "https://api.sodax.com/v1/be/config/relay/chain-id-map";

type HubAsset = {
  asset: string;
  decimal: number;
  symbol: string;
  name: string;
  vault: string;
};

export async function enrichChainsFromApi(): Promise<void> {
  let hubAssets: Record<string, Record<string, HubAsset>>;
  let relayMap: Record<string, string>;
  try {
    const [assetsRes, relayRes] = await Promise.all([
      fetch(HUB_ASSETS_URL),
      fetch(RELAY_MAP_URL),
    ]);
    if (!assetsRes.ok || !relayRes.ok) {
      throw new Error(`hub=${assetsRes.status} relay=${relayRes.status}`);
    }
    hubAssets = (await assetsRes.json()) as Record<string, Record<string, HubAsset>>;
    relayMap = (await relayRes.json()) as Record<string, string>;
  } catch (err) {
    console.warn(
      "enrichChainsFromApi: failed to fetch SODAX config — falling back to config.json only.",
      err instanceof Error ? err.message : err,
    );
    return;
  }

  let added = 0;
  for (const [apiChainKey, assets] of Object.entries(hubAssets)) {
    const chainId = relayMap[apiChainKey];
    if (!chainId) {
      console.warn(`enrichChainsFromApi: no internal id for API chain "${apiChainKey}", skipping.`);
      continue;
    }
    const chainEntry = chains[chainId];
    if (!chainEntry) continue; // chain not configured locally — skip
    for (const [addr, info] of Object.entries(assets)) {
      const entry: AssetInfo = {
        name: info.symbol || info.name,
        decimals: info.decimal,
        // "Soda <Asset>" name pattern identifies hub liquid wraps (Soda BNB, SODA NEAR, Soda WEETH, …)
        isSodaWrap: info.name?.toLowerCase().startsWith("soda ") ?? false,
      };
      // API exposes two addresses per token: the dict key (canonical "spoke
      // key") and `info.asset` (often the wrapped contract address). The
      // indexer's action_detail rows may reference either, so register both
      // under the same AssetInfo. Local config.json entries still win.
      for (const candidate of [addr, info.asset]) {
        if (!candidate) continue;
        // Only EVM/ICON hex addresses are case-insensitive — lowercasing them
        // normalises checksum vs all-lowercase variants from different sources.
        // Base58/bech32/etc. (Solana, Stellar, Stacks, Sui, Bitcoin) are
        // case-sensitive; lowercasing destroys them and breaks the runtime
        // lookup (where decoders return the canonical mixed-case form).
        const isHexAddress = /^(0x|cx)[0-9a-fA-F]+$/.test(candidate);
        const key = isHexAddress ? candidate.toLowerCase() : candidate;
        if (key in chainEntry.Assets) continue;
        chainEntry.Assets[key] = entry;
        added++;
      }
    }
  }
  console.log(`enrichChainsFromApi: added ${added} asset entries from hub/assets API.`);
}
