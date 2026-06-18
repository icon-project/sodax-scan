import { chains, idToChainNameMap, solana, sonic, bitcoin } from "./configs";
import type { AssetInfo } from "./configs";

export function bigintDivisionToDecimalString(num: bigint, decimals: number) {
    const denom = BigInt(10 ** decimals)
    const integerPart = num / denom;
    const remainder = num % denom;
    const scaledRemainder = remainder * (10n ** BigInt(decimals)) / denom;
    let decimalPart = scaledRemainder.toString().padStart(decimals, '0');
    decimalPart = decimalPart.replace(/0+$/, '');
    if(!decimalPart){
        decimalPart = "0"
    }
    return `${integerPart.toString()}.${decimalPart}`;
}


export function multiplyDecimalBy10Pow18(decimalStr: string): bigint {
  const noDot = decimalStr.replace(".", "");
  const decimals = (decimalStr.split(".")[1] || "").length;
  const scale = 18;
  let adjusted = noDot;

  if (decimals > scale) {
    adjusted = noDot.slice(0, noDot.length - (decimals - scale));
  } else if (decimals < scale) {
    adjusted = noDot + "0".repeat(scale - decimals);
  }
  return BigInt(adjusted);
}

/**
 * For some chains, like Solana, the relay payload is hashed. 
 */
export function srcHasHashedPayload(srcChainId: string): boolean {
  return srcChainId === solana || srcChainId === bitcoin;
}

/**
 * Extracts the connection sn from the relay response, keeping it as a string
 * @param input - The relay response
 * @returns The connection sn
 */
export function extractConnSn(input: string): string | null {
  const m = input.match(/"conn_sn"\s*:\s*(\d+)/)
  return m ? m[1] : null
}

export function getErc20Decimals(asset: AssetInfo): number {
  return asset.isSodaWrap ? 18 : asset.decimals;
}

/**
 * Symbol to render for a swap leg, disambiguating hub representations by their
 * origin chain: "USDT.bsc" for the BSC-origin hub USDT, plain "USDT" for
 * native/spoke-side assets. `origin` is set only on hub entries (see
 * AssetInfo.origin). Falls back to `fallback` (typically the raw address) when
 * the asset isn't known.
 */
export function symbolWithOrigin(
  asset: { name: string; origin?: string } | undefined,
  fallback: string,
): string {
  if (!asset) return fallback;
  return asset.origin ? `${asset.name}.${asset.origin}` : asset.name;
}

export function resolveMoneyMarketActionText(
  action: string,
  amount: bigint,
  tokenAddress: string,
  srcChainId: string,
): string {
  const srcHit = chains[srcChainId]?.Assets?.[tokenAddress];
  if (srcHit) {
    return `${action} ${bigintDivisionToDecimalString(amount, getErc20Decimals(srcHit))} ${srcHit.name}`;
  }
  const hubHit = chains[sonic]?.Assets?.[tokenAddress];
  if (hubHit) {
    const srcName = idToChainNameMap[srcChainId] ?? srcChainId;
    return `${action} ${bigintDivisionToDecimalString(amount, getErc20Decimals(hubHit))} ${hubHit.name} (Sonic) ← initiated from ${srcName}`;
  }
  return `${action} ${bigintDivisionToDecimalString(amount, 18)} ${tokenAddress}`;
}