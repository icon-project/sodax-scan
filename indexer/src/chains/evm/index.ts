import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { ethers } from 'ethers';
import { TxPayload } from "../../types";
import { chains, idToChainNameMap } from "../../configs";
import { bigintDivisionToDecimalString } from "../../utils";

const calculateTopicHash = (signature: string) => ethers.keccak256(ethers.toUtf8Bytes(signature));

const MESSAGE_EVENT_TOPIC = calculateTopicHash('Message(uint256,bytes,uint256,uint256,bytes,bytes)')
const INTENT_FILLED_TOPIC = calculateTopicHash('IntentFilled(bytes32,(bool,uint256,uint256,bool))')
const INTENT_CANCELLED_TOPIC = calculateTopicHash('IntentCancelled(bytes32)')
const REVERSE_SWAP_TOPIC = calculateTopicHash('ReverseSwap(address,uint256,uint256)')
const fillIntentSelector = "0xd971729f"

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
    const effectiveGasPrice = tx.result.effectiveGasPrice ? BigInt(tx.result.effectiveGasPrice) : 100000000n;
    const txFee = gasUsed * effectiveGasPrice;
    let intentFilled = false
    let intentCancelled = false
    let reverseSwap = false
    let intentCancelAction = ""
    let reverseSwapAction = ""
    let intentFilledAction = ""
    let intentFilledValue = 0
    for (const log of tx.result.logs ?? []) {
      const topics: string[] = log.topics;
      if (topics.includes(INTENT_FILLED_TOPIC)) {
        intentFilled = true
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const intentTuple = "(bytes32,bool,uint256,uint256,bool)";
        const decoded = abi.decode([intentTuple], log.data);
        intentFilledAction = `IntentFilled ${decoded[0]}`
        intentFilledValue = decoded[0][3]
      }
      if (topics.includes(INTENT_CANCELLED_TOPIC)) {
        intentCancelled = true
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const decoded = abi.decode(['bytes32'], log.data);
        intentCancelAction = `IntentCancelled ${decoded[0]}`
      }
      if (topics.includes(REVERSE_SWAP_TOPIC)) {
        reverseSwap = true
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const decoded = abi.decode(['uint256', 'uint256'], log.data);
        reverseSwapAction = `Migrated ${bigintDivisionToDecimalString(decoded[1], 18)} Soda`
      }
    }
    if (!intentFilled && !intentCancelled && !reverseSwap) {
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
    else if (reverseSwap) {
      return {
        txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
        payload: "0x",
        reverseSwap: reverseSwap,
        actionText: reverseSwapAction
      };
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
        try {
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
            actionText: intentFilled ? `IntentFilled ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})` : `IntentCancelled ${inputAmount} ${inputToken} -> ${outputAmount}`
          };
        } catch {
          try {
            const calls = this.decodeExecuteCalldata(inputData)
            for (const c of calls) {
              for (const arg of c.args) {
                const selector = arg.slice(0, 10);
                const intentInput = `0x${arg.slice(10)}`;
                if (selector === fillIntentSelector) {
                  const intentTuple = "(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)";
                  const intentDecoded = abi.decode([intentTuple], intentInput);
                  const result = intentDecoded[0]
                  const srcChainId = result[8]
                  const dstChainId = result[9]
                  const assetsInformation = chains[srcChainId].Assets
                  let inputToken = result[2].toLowerCase()
                  let decimals = 18
                  if (inputToken in assetsInformation) {
                    const inputTokenInfo = assetsInformation[inputToken]
                    inputToken = inputTokenInfo.name
                    decimals = inputTokenInfo.decimals
                  }
                  const outputAssetsInformation = chains[dstChainId].Assets
                  let outputToken = result[3].toLowerCase()
                  let outputDecimals = 18
                  if (outputToken in outputAssetsInformation) {
                    const outputTokenInfo = outputAssetsInformation[outputToken]
                    outputToken = outputTokenInfo.name
                    outputDecimals = outputTokenInfo.decimals
                  }
                  const inputAmount = bigintDivisionToDecimalString(result[4], decimals)
                  const outputAmount = bigintDivisionToDecimalString(BigInt(intentFilledValue), outputDecimals)
                  const actionText = `IntentFilled ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})`
                  return {
                    txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
                    payload: "0x",
                    intentFilled: intentFilled,
                    intentCancelled: intentCancelled,
                    swapInputToken: result[2],
                    swapOutputToken: result[3],
                    actionText: intentFilled ? actionText : `IntentCancelled ${inputAmount} ${inputToken} -> ${outputAmount} ${outputToken}`
                  }
                }
              }
            }

          } catch { }
          return {
            txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
            payload: "0x",
            intentFilled: intentFilled,
            intentCancelled: intentCancelled,
            actionText: intentFilled ? intentFilledAction : intentCancelAction
          };

        }

      } catch (err) {
        console.log("decode err", err)
      }
    }
    return {
      txnFee: "0",
      payload: "0x"
    }
  }

  decodeExecuteCalldata(calldata: string) {
    const data = `0x${calldata.slice(10)}`;
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [calls] = abiCoder.decode(["tuple(address to, bytes[] args, bytes6 storeAs)[]"], data);
    return calls as { to: string; args: string[] }[];
  }
}
