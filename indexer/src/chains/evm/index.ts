import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { ethers } from 'ethers';
import { TxPayload } from "../../types";
import { chains } from "../../configs";
import { bigintDivisionToDecimalString } from "../../utils";

const calculateTopicHash = (signature: string) => ethers.keccak256(ethers.toUtf8Bytes(signature));

const MESSAGE_EVENT_TOPIC = calculateTopicHash('Message(uint256,bytes,uint256,uint256,bytes,bytes)')
const INTENT_FILLED_TOPIC = calculateTopicHash('IntentFilled(bytes32,(bool,uint256,uint256,bool))')
const INTENT_CANCELLED_TOPIC = calculateTopicHash('IntentCancelled(bytes32)')


export class EvmHandler implements ChainHandler {
  private rpcUrl: string;
  private denom: string

  constructor(config: { rpcUrl: string, denom?: string }) {
    this.rpcUrl = config.rpcUrl;
    this.denom = config.denom || "ETH"
  }
  decodeAddress(address: string): string {
    return address
  }
  async fetchPayload(txHash: string): Promise<TxPayload> {
    const { data: tx } = await axios.post(this.rpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
    const gasUsed = BigInt(tx.result.gasUsed);
    const effectiveGasPrice = BigInt(tx.result.effectiveGasPrice);
    const txFee = gasUsed * effectiveGasPrice;
    let intentFilled = false
    let intentCancelled = false
    let intentCancelAction = ""
    for (const log of tx.result.logs ?? []) {
      const topics: string[] = log.topics;
      if (topics.includes(INTENT_FILLED_TOPIC)) {
        intentFilled = true
      }
      if (topics.includes(INTENT_CANCELLED_TOPIC)) {
        intentCancelled = true
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const decoded = abi.decode(['bytes32'], log.data);
        intentCancelAction = `IntentCancelled ${decoded[0]}`
      }
    }
    if (!intentFilled && !intentCancelled) {
      for (const log of tx.result.logs ?? []) {
        const topics: string[] = log.topics;
        if (topics.includes(MESSAGE_EVENT_TOPIC)) {
          const abi = ethers.AbiCoder.defaultAbiCoder();
          const decoded = abi.decode(['uint256', 'bytes', 'uint256', 'uint256', 'bytes', 'bytes'], log.data);
          const payload = decoded[5];
          return {
            txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
            payload: payload,
            intentFilled,
            intentCancelled,
            dstAddress: tx.result.to
          };
        }
      }
    }
    else {
      const { data: tx } = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash],
      });
      try {
        const inputData = tx.result.input
        const input = `0x${inputData.slice(10)}`;
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const intentTuple = "(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)";
        const intentFillTuple = [
          intentTuple,
          "uint256",
          "uint256",
          "uint256"
        ];
        const decodedIntentFill = abi.decode(intentFillTuple, input);
        const decoded = decodedIntentFill[0]
        const srcChainId = decoded[8]
        const dstChainId = decoded[9]
        const assetsInformation = chains[srcChainId].Assets
        let inputToken = decoded[2].toLowerCase()
        let decimals = 18
        if (inputToken in assetsInformation) {
          const tokenInfo = assetsInformation[inputToken]
          inputToken = tokenInfo.name
          decimals = tokenInfo.decimals
        }
        const outputAssetsInformation = chains[dstChainId].Assets
        let outputToken = decoded[3].toLowerCase()
        let outputDecimals = 18
        if (outputToken in outputAssetsInformation) {
          const outputTokenInfo = outputAssetsInformation[outputToken]
          outputToken = outputTokenInfo.name
          outputDecimals = outputTokenInfo.decimals
        }
        let inputAmount = bigintDivisionToDecimalString(decodedIntentFill[1], decimals)
        let outputAmount = bigintDivisionToDecimalString(decodedIntentFill[2], outputDecimals)
        if (intentCancelled) {
          inputAmount = bigintDivisionToDecimalString(decoded[4], decimals)
          outputAmount = bigintDivisionToDecimalString(decoded[5], outputDecimals)
        }
        return {
          txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
          payload: "0x",
          intentFilled: intentFilled,
          intentCancelled: intentCancelled,
          swapInputToken: decoded[2],
          swapOutputToken: decoded[3],
          actionText: intentFilled ? `IntentFilled ${inputAmount} ${inputToken} -> ${outputAmount} ${outputToken}` : `IntentCancelled ${inputAmount} ${inputToken} -> ${outputAmount} ${outputToken}`
        };
      } catch (err) {
        console.log("decode err", err)
      }
    }
    return {
      txnFee: "0",
      payload: "0x"
    }
  }
}
