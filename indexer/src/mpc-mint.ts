import { ethers } from 'ethers';
import type { AssetInfo } from './configs';
import type { ReceiptLog } from './mpc-withdraw';

// MPC deposit mints emit no Message log: the hub call carries the payload in
// calldata as (uint256 srcChainId, bytes32, bytes, bytes payload), payload = RLP
// [spoke token, sender, recipient, amount, calls]. Kept free of runtime config
// imports so it can be tested without RPC env vars.

const MINT_SELECTOR = '0x7a062d0b';
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ZERO_TOPIC = ethers.zeroPadValue(ethers.ZeroAddress, 32);

const abi = ethers.AbiCoder.defaultAbiCoder();

/** RLP payload of a hub mint call, or null when the input is another call. */
export function decodeMintPayload(input: string): string | null {
  if (!input.startsWith(MINT_SELECTOR)) return null;
  const [, , , payload] = abi.decode(['uint256', 'bytes32', 'bytes', 'bytes'], `0x${input.slice(MINT_SELECTOR.length)}`);
  return payload;
}

/** "Deposit 3.0 USDT(tron)" from the mint to the payload's recipient; null when no log matches. */
export function formatMintText(payload: string, logs: ReceiptLog[], hubAssets: Record<string, AssetInfo>, chainName: string): string | null {
  const fields = ethers.decodeRlp(payload);
  if (!Array.isArray(fields) || fields.length !== 5 || typeof fields[2] !== 'string' || typeof fields[3] !== 'string') {
    throw new Error(`MPC mint payload is not RLP [token, from, to, amount, calls]: ${payload}`);
  }
  const amount = fields[3] === '0x' ? 0n : BigInt(fields[3]);
  const recipientTopic = ethers.zeroPadValue(fields[2], 32).toLowerCase();
  const mint = logs.find(
    (l) =>
      l.topics.length === 3 &&
      l.topics[0] === TRANSFER_TOPIC &&
      l.topics[1].toLowerCase() === ZERO_TOPIC &&
      l.topics[2].toLowerCase() === recipientTopic &&
      BigInt(l.data) === amount,
  );
  if (!mint) return null;
  const hubToken = mint.address.toLowerCase();
  const asset = hubAssets[hubToken];
  return asset
    ? `Deposit ${ethers.formatUnits(amount, asset.decimals)} ${asset.name}(${chainName})`
    : `Deposit ${amount} ${hubToken}(${chainName})`;
}
