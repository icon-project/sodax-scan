import { solana } from "./configs";

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
  return srcChainId === solana; // todo: add bitcoin when supported
}