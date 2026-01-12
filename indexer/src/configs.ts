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

export type AssetInfo = {
  name: string;
  decimals: number;
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
  [kaia]: requireEnv("KAIA_URL")
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
