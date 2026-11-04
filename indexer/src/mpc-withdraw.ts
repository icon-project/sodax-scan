import { ethers } from 'ethers';
import type { AssetInfo } from './configs';

// MPC withdrawals have no mint leg: the hub tx burns the hub asset and emits
// BridgeRequest(uint256 indexed dstChainId, bytes dstAddress, bytes payload),
// payload = RLP [spoke token, sender, recipient, amount]. Kept free of runtime
// config imports so it can be tested without RPC env vars.

export const BRIDGE_REQUEST_TOPIC = ethers.id('BridgeRequest(uint256,bytes,bytes)');
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ZERO_TOPIC = ethers.zeroPadValue(ethers.ZeroAddress, 32);

export interface ReceiptLog {
  address: string;
  topics: string[];
  data: string;
}

export interface BridgeWithdrawal {
  dstChainId: string;
  /** Token id on the destination chain, from the payload. */
  token: string;
  /** Hub asset burned for this withdrawal (sender -> 0x0, same amount); null when not found. */
  hubToken: string | null;
  amount: bigint;
}

const abi = ethers.AbiCoder.defaultAbiCoder();

/** First BridgeRequest in a hub receipt's logs, or null when there is none. */
export function findBridgeWithdrawal(logs: ReceiptLog[]): BridgeWithdrawal | null {
  const log = logs.find((l) => l.topics[0] === BRIDGE_REQUEST_TOPIC && l.topics.length > 1);
  if (!log) return null;
  const [, payload] = abi.decode(['bytes', 'bytes'], log.data);
  const fields = ethers.decodeRlp(payload);
  if (!Array.isArray(fields) || fields.length < 4 || typeof fields[0] !== 'string' || typeof fields[1] !== 'string' || typeof fields[3] !== 'string') {
    throw new Error('BridgeRequest payload is not RLP [token, from, to, amount]');
  }
  const amount = fields[3] === '0x' ? 0n : BigInt(fields[3]);
  const senderTopic = ethers.zeroPadValue(fields[1], 32).toLowerCase();
  const burn = logs.find(
    (l) =>
      l.topics[0] === TRANSFER_TOPIC &&
      l.topics[1]?.toLowerCase() === senderTopic &&
      l.topics[2]?.toLowerCase() === ZERO_TOPIC &&
      BigInt(l.data) === amount,
  );
  return {
    dstChainId: BigInt(log.topics[1]).toString(),
    token: fields[0].toLowerCase(),
    hubToken: burn ? burn.address.toLowerCase() : null,
    amount,
  };
}

/** "Withdraw 1.900434 ADA(cardano)"; raw amount + spoke token hex when the hub asset is not configured. */
export function formatWithdrawText(w: BridgeWithdrawal, hubAssets: Record<string, AssetInfo>, chainName: string): string {
  const asset = w.hubToken ? hubAssets[w.hubToken] : undefined;
  return asset
    ? `Withdraw ${ethers.formatUnits(w.amount, asset.decimals)} ${asset.name}(${chainName})`
    : `Withdraw ${w.amount} ${w.token}(${chainName})`;
}
