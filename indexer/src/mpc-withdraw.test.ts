import { describe, it, expect } from 'bun:test';
import { ethers } from 'ethers';
import { BRIDGE_REQUEST_TOPIC, findBridgeWithdrawal, formatWithdrawText } from './mpc-withdraw';

const SPOKE_TOKEN = '0x1815000000000000000000000000000000000001';
const HUB_TOKEN = '0xb1ee2a6920e335f5544ec6a8070a1d92dcf25fa6';
const SENDER = '0x' + '11'.repeat(20);
const abi = ethers.AbiCoder.defaultAbiCoder();
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const addrTopic = (a: string) => ethers.zeroPadValue(a, 32);

// BridgeRequest(uint256 indexed dstChainId, bytes dstAddress, bytes payload),
// payload = RLP [token, from, to, amount], as the hub emits for an MPC withdrawal.
function bridgeRequestLog(dstChainId: bigint, token: string, amount: bigint) {
  const payload = ethers.encodeRlp([token, SENDER, '0x01' + '22'.repeat(56), ethers.toBeHex(amount)]);
  return {
    address: '0x60c5681bd1db4e50735c4ca3386005a4ba4937c0',
    topics: [BRIDGE_REQUEST_TOPIC, ethers.zeroPadValue(ethers.toBeHex(dstChainId), 32)],
    data: abi.encode(['bytes', 'bytes'], ['0x1815000000000000000000000000000000000000', payload]),
  };
}
const transfer = (token: string, from: string, to: string, amount: bigint) => ({
  address: token,
  topics: [TRANSFER_TOPIC, addrTopic(from), addrTopic(to)],
  data: abi.encode(['uint256'], [amount]),
});
const burn = transfer(HUB_TOKEN, SENDER, ethers.ZeroAddress, 1900434n);

describe('findBridgeWithdrawal', () => {
  it('decodes dst chain, spoke token and amount, and takes the hub token from the matching burn', () => {
    const logs = [transfer(HUB_TOKEN, '0x' + '33'.repeat(20), SENDER, 1900434n), burn, bridgeRequestLog(1815n, SPOKE_TOKEN, 1900434n)];
    expect(findBridgeWithdrawal(logs)).toEqual({ dstChainId: '1815', token: SPOKE_TOKEN, hubToken: HUB_TOKEN, amount: 1900434n });
  });

  it('leaves hubToken null when no burn matches the sender and amount', () => {
    const otherAmount = transfer(HUB_TOKEN, SENDER, ethers.ZeroAddress, 5n);
    const otherSender = transfer(HUB_TOKEN, '0x' + '44'.repeat(20), ethers.ZeroAddress, 1900434n);
    const w = findBridgeWithdrawal([otherAmount, otherSender, bridgeRequestLog(1815n, SPOKE_TOKEN, 1900434n)]);
    expect(w?.hubToken).toBeNull();
  });

  it('returns null when the receipt has no BridgeRequest log', () => {
    expect(findBridgeWithdrawal([burn])).toBeNull();
    expect(findBridgeWithdrawal([])).toBeNull();
  });

  it('throws when the payload is not RLP [token, from, to, amount]', () => {
    const log = { ...bridgeRequestLog(1815n, SPOKE_TOKEN, 1n), data: abi.encode(['bytes', 'bytes'], ['0x', ethers.encodeRlp(['0x01'])]) };
    expect(() => findBridgeWithdrawal([log])).toThrow('BridgeRequest payload is not RLP [token, from, to, amount]');
  });
});

describe('formatWithdrawText', () => {
  const withdrawal = { dstChainId: '1815', token: SPOKE_TOKEN, hubToken: HUB_TOKEN, amount: 1900434n };

  it('scales the amount by the hub asset decimals and names it', () => {
    expect(formatWithdrawText(withdrawal, { [HUB_TOKEN]: { name: 'ADA', decimals: 6 } }, 'cardano')).toBe('Withdraw 1.900434 ADA(cardano)');
  });

  it('shows the raw amount and spoke token hex when the hub asset is not configured or unknown', () => {
    expect(formatWithdrawText(withdrawal, {}, 'cardano')).toBe(`Withdraw 1900434 ${SPOKE_TOKEN}(cardano)`);
    expect(formatWithdrawText({ ...withdrawal, hubToken: null }, { [HUB_TOKEN]: { name: 'ADA', decimals: 6 } }, 'cardano')).toBe(
      `Withdraw 1900434 ${SPOKE_TOKEN}(cardano)`,
    );
  });
});
