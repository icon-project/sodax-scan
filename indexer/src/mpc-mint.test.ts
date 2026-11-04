import { describe, it, expect } from 'bun:test';
import { ethers } from 'ethers';
import { decodeMintPayload, formatMintText } from './mpc-mint';

const SPOKE_TOKEN = '0x0728126428000000000000000000000000000002';
const HUB_TOKEN = '0xa71e3e927baf32eb5f1678a3b13c2fffee3973d7';
const SENDER = '0xf8d1ccdb88569092466c3ae201c77976d17a1cf6';
const RECIPIENT = '0xa5439289bafba09e5c5e2f5ef6701fee79f1b23e';
const abi = ethers.AbiCoder.defaultAbiCoder();
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const addrTopic = (a: string) => ethers.zeroPadValue(a, 32);
const ASSETS = { [HUB_TOKEN]: { name: 'USDT', decimals: 6 } } as any;

const payload = ethers.encodeRlp([SPOKE_TOKEN, SENDER, RECIPIENT, ethers.toBeHex(3_000_000n), '0x']);
const transfer = (token: string, from: string, to: string, amount: bigint) => ({
  address: token,
  topics: [TRANSFER_TOPIC, addrTopic(from), addrTopic(to)],
  data: abi.encode(['uint256'], [amount]),
});

describe('decodeMintPayload', () => {
  it('extracts the RLP payload from the hub mint calldata', () => {
    const args = abi.encode(
      ['uint256', 'bytes32', 'bytes', 'bytes'],
      [728126428n, ethers.ZeroHash, '0x0728126428000000000000000000000000000000', payload],
    );
    expect(decodeMintPayload('0x7a062d0b' + args.slice(2))).toBe(payload);
  });

  it('returns null for any other hub call', () => {
    expect(decodeMintPayload('0x095ea7b3' + '00'.repeat(64))).toBeNull();
  });
});

describe('formatMintText', () => {
  it('describes the tokens minted to the recipient', () => {
    const logs = [transfer(HUB_TOKEN, ethers.ZeroAddress, RECIPIENT, 3_000_000n)];
    expect(formatMintText(payload, logs, ASSETS, 'tron')).toBe('Deposit 3.0 USDT(tron)');
  });

  it('ignores later vault mints and plain transfers of the same amount', () => {
    const vault = '0x' + 'bd'.repeat(20);
    const logs = [
      transfer(vault, SENDER, RECIPIENT, 3_000_000n),
      transfer(vault, ethers.ZeroAddress, RECIPIENT, 3_000_000_000_000_000_000n),
      transfer(HUB_TOKEN, ethers.ZeroAddress, RECIPIENT, 3_000_000n),
    ];
    expect(formatMintText(payload, logs, ASSETS, 'tron')).toBe('Deposit 3.0 USDT(tron)');
  });

  it('skips ERC-721 mints, whose Transfer has an empty data field', () => {
    const nft = { address: '0x' + 'cc'.repeat(20), topics: [...transfer(HUB_TOKEN, ethers.ZeroAddress, RECIPIENT, 0n).topics, ethers.ZeroHash], data: '0x' };
    const logs = [nft, transfer(HUB_TOKEN, ethers.ZeroAddress, RECIPIENT, 3_000_000n)];
    expect(formatMintText(payload, logs, ASSETS, 'tron')).toBe('Deposit 3.0 USDT(tron)');
  });

  it('falls back to the raw amount and hub token when the asset is not configured', () => {
    const logs = [transfer(HUB_TOKEN, ethers.ZeroAddress, RECIPIENT, 3_000_000n)];
    expect(formatMintText(payload, logs, {}, 'tron')).toBe(`Deposit 3000000 ${HUB_TOKEN}(tron)`);
  });

  it('returns null when no log mints the payload amount to the recipient', () => {
    const logs = [transfer(HUB_TOKEN, ethers.ZeroAddress, SENDER, 3_000_000n)];
    expect(formatMintText(payload, logs, ASSETS, 'tron')).toBeNull();
  });

  it('rejects a payload that is not RLP [token, from, to, amount, calls]', () => {
    expect(() => formatMintText(ethers.encodeRlp(['0x01']), [], ASSETS, 'tron')).toThrow('MPC mint payload');
  });
});
