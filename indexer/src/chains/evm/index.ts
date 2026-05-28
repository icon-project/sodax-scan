import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { ethers } from 'ethers';
import { TxPayload } from "../../types";
import { chains, idToChainNameMap, sonic } from "../../configs";
import { bigintDivisionToDecimalString } from "../../utils";
import RLP from "rlp";
import { getHandler } from "../../handler";

const calculateTopicHash = (signature: string) => ethers.keccak256(ethers.toUtf8Bytes(signature));

const MESSAGE_EVENT_TOPIC = calculateTopicHash('Message(uint256,bytes,uint256,uint256,bytes,bytes)')
const INTENT_FILLED_TOPIC = calculateTopicHash('IntentFilled(bytes32,(bool,uint256,uint256,bool))')
const INTENT_CANCELLED_TOPIC = calculateTopicHash('IntentCancelled(bytes32)')
const INTENT_CREATED_TOPIC = calculateTopicHash('IntentCreated(bytes32,(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))')
const REVERSE_SWAP_TOPIC = calculateTopicHash('ReverseSwap(address,uint256,uint256)')
const STORED_CALL_REVERTED_TOPIC = calculateTopicHash('StoredCallReverted(bytes32)')
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
  async fetchPayload(txHash: string, txConnSn: string): Promise<TxPayload> {
    const { data: tx } = await axios.post(this.rpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
    const logs = tx.result?.logs ?? [];
    const storedCallReverted = logs.some((log: { topics?: string[] }) => log.topics?.[0] === STORED_CALL_REVERTED_TOPIC);
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
    let intentHash = ""
    for (const log of tx.result.logs ?? []) {
      const topics: string[] = log.topics;
      if (topics.includes(INTENT_CREATED_TOPIC)) {
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const intentTuple = "(bytes32)";
        const decoded = abi.decode([intentTuple], log.data);
        return {
          txnFee: '0',
          payload: '0x',
          intentTxHash: decoded[0][0],
          blockNumber: Number.parseInt(tx.result.blockNumber, 16),
          storedCallReverted,
        }
      }
      if (topics.includes(INTENT_FILLED_TOPIC)) {
        intentFilled = true
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const intentTuple = "(bytes32,bool,uint256,uint256,bool)";
        const decoded = abi.decode([intentTuple], log.data);
        intentFilledAction = `IntentFilled ${decoded[0]}`
        intentFilledValue = decoded[0][3]
        intentHash = decoded[0][0]
      }
      if (topics.includes(INTENT_CANCELLED_TOPIC)) {
        intentCancelled = true
        const abi = ethers.AbiCoder.defaultAbiCoder();
        const decoded = abi.decode(['bytes32'], log.data);
        intentCancelAction = `IntentCancelled ${decoded[0]}`
        intentHash = decoded[0]
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
            dstAddress: tx.result.to,
            blockNumber: Number.parseInt(tx.result.blockNumber, 16),
            storedCallReverted,
          };
        }
      }
    }
    else if (reverseSwap) {
      return {
        txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
        payload: "0x",
        reverseSwap: reverseSwap,
        actionText: reverseSwapAction,
        blockNumber: Number.parseInt(tx.result.blockNumber, 16),
        storedCallReverted,
      };
    }
    else {
      const { data: intx } = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash],
      });
      try {
        const inputData = intx.result.input
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
            intentTxHash: intentHash,
            actionText: intentFilled ? `IntentFilled ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})` : `IntentCancelled ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})`,
            blockNumber: Number.parseInt(tx.result.blockNumber, 16),
            storedCallReverted,
          };
        } catch {
          try {
            const calls = this.decodeExecuteCalldata(inputData)
            let intentMinOutput = 0n
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
                  intentMinOutput = result[5]
                  const dstToken = result[3]
                  for (const log of tx.result.logs ?? []) {
                    const topics: string[] = log.topics;
                    if (topics.includes(MESSAGE_EVENT_TOPIC)) {
                      const abi = ethers.AbiCoder.defaultAbiCoder();
                      const decoded = abi.decode(['uint256', 'bytes', 'uint256', 'uint256', 'bytes', 'bytes'], log.data);
                      const payload = decoded[5];
                      const connSn = decoded[2]
                      const msgDstChainId = decoded[3]
                      const intentDenom = getTokenDenom(dstToken.toLowerCase(), BigInt(dstChainId).toString(), BigInt(srcChainId).toString())
                      const payloadDenom = this.parsePayloadData(payload, BigInt(dstChainId).toString(), BigInt(srcChainId).toString())
                      if (BigInt(connSn).toString() === BigInt(txConnSn).toString()) {
                        if (intentDenom !== payloadDenom || msgDstChainId !== dstChainId) {
                          if (intentDenom.includes("USDC") && payloadDenom.includes("USDC")) {
                            continue
                          }
                          if (intentDenom.includes("BTCB") && payloadDenom.includes("BTCB")) {
                            continue
                          }
                          intentFilled = false
                          return {
                            txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
                            payload: payload,
                            intentFilled,
                            intentCancelled,
                            dstAddress: tx.result.to,
                            intentTxHash: intentHash,
                            blockNumber: Number.parseInt(tx.result.blockNumber, 16),
                            storedCallReverted,
                          };
                        }
                      }
                    }
                  }
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
                  let slippageScaled = ""
                  if (intentMinOutput > 0n) {
                    slippageScaled = this.slippagePercent(intentMinOutput, BigInt(intentFilledValue))
                  }
                  return {
                    txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
                    payload: "0x",
                    intentFilled: intentFilled,
                    intentCancelled: intentCancelled,
                    swapInputToken: result[2],
                    swapOutputToken: result[3],
                    actionText: intentFilled ? `IntentFilled ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})` : `IntentCancelled ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})`,
                    slippage: slippageScaled,
                    intentTxHash: intentHash,
                    blockNumber: Number.parseInt(tx.result.blockNumber, 16),
                    storedCallReverted,
                  }
                }
              }
            }

          } catch (err) {
            // FALLBACK: scan raw input for the fillIntent selector to handle
            // compressed/router calldata that neither direct decode nor
            // decodeExecuteCalldata can parse.
            if (intentFilled) {
              const parsed = this.parseFilledIntentFromInput(
                inputData,
                tx.result.logs ?? [],
                txConnSn,
                tx.result.to,
                intentFilledValue,
                intentHash,
                intentCancelled,
                txFee,
                Number.parseInt(tx.result.blockNumber, 16),
                storedCallReverted,
              );
              if (parsed) {
                return parsed;
              }
            }
            console.log("decode intent fill error", err)
          }

          return {
            txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
            payload: "0x",
            intentFilled: intentFilled,
            intentCancelled: intentCancelled,
            intentTxHash: intentHash,
            ...(intentFilled ? { filledOutputAmount: intentFilledValue.toString() } : {}),
            actionText: intentFilled ? intentFilledAction : intentCancelAction,
            blockNumber: Number.parseInt(tx.result.blockNumber, 16),
            storedCallReverted,
          };

        }

      } catch (err) {
        console.log("decode err", err)
      }
    }
    return {
      txnFee: "0",
      payload: "0x",
      blockNumber: 0,
      storedCallReverted: false,
    }
  }

  slippagePercent(expected: bigint, actual: bigint): string {
    const decimals = 4
    const diff = actual - expected;
    const isNegative = diff < 0n; 
    const absDiff = diff < 0n ? -diff : diff;
    const SCALE = BigInt(10 ** decimals);
    const scaled = (absDiff * SCALE * 100n) / expected;
    let s = scaled.toString();
    if (s.length <= decimals) { 
      s = s.padStart(decimals + 1, "0"); 
    }
    const intPart = s.slice(0, s.length - decimals);
    const decPart = s.slice(s.length - decimals);
    return `${isNegative ? "-" : ""}${intPart}.${decPart}%`;
  }

  private parseFilledIntentFromInput(
    inputData: string,
    logs: Array<{ topics: string[]; data: string }>,
    txConnSn: string,
    dstAddress: string,
    intentFilledValue: number,
    intentHash: string,
    intentCancelled: boolean,
    txFee: bigint,
    blockNumber: number,
    storedCallReverted: boolean,
  ): TxPayload | null {
    const marker = fillIntentSelector.slice(2).toLowerCase();
    const input = (inputData ?? "0x").toLowerCase();
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const intentTuple =
      "(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)";
    for (let at = input.indexOf(marker); at !== -1; at = input.indexOf(marker, at + 1)) {
      try {
        const decoded = abi.decode(
          [intentTuple, "uint256", "uint256", "uint256"],
          `0x${input.slice(at + marker.length)}`,
        );
        const intent = decoded[0];
        const srcChainId = intent[8];
        const dstChainId = intent[9];
        const srcChain = chains[srcChainId];
        const dstChain = chains[dstChainId];
        if (!srcChain || !dstChain) {
          continue;
        }
        // Cross-check the Message log: if the intent's dst token denom or
        // dstChainId doesn't match the message payload for this connSn, this
        // tx is actually a regular message (multi-intent fill case), not an
        // intent fill for the current message.
        const dstToken = intent[3];
        for (const log of logs) {
          if (!log.topics?.includes(MESSAGE_EVENT_TOPIC)) continue;
          const msgDecoded = abi.decode(['uint256', 'bytes', 'uint256', 'uint256', 'bytes', 'bytes'], log.data);
          const payload = msgDecoded[5];
          const connSn = msgDecoded[2];
          const msgDstChainId = msgDecoded[3];
          if (BigInt(connSn).toString() !== BigInt(txConnSn).toString()) continue;
          const intentDenom = getTokenDenom(dstToken.toLowerCase(), BigInt(dstChainId).toString(), BigInt(srcChainId).toString());
          const payloadDenom = this.parsePayloadData(payload, BigInt(dstChainId).toString(), BigInt(srcChainId).toString());
          if (intentDenom !== payloadDenom || msgDstChainId !== dstChainId) {
            if (intentDenom.includes("USDC") && payloadDenom.includes("USDC")) continue;
            if (intentDenom.includes("BTCB") && payloadDenom.includes("BTCB")) continue;
            return {
              txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
              payload,
              intentFilled: false,
              intentCancelled,
              dstAddress,
              intentTxHash: intentHash,
              blockNumber,
              storedCallReverted,
            };
          }
        }
        let inputToken = intent[2].toLowerCase();
        let decimals = 18;
        if (inputToken in srcChain.Assets) {
          const inputTokenInfo = srcChain.Assets[inputToken];
          inputToken = inputTokenInfo.name;
          decimals = inputTokenInfo.decimals;
        }
        let outputToken = intent[3].toLowerCase();
        let outputDecimals = 18;
        if (outputToken in dstChain.Assets) {
          const outputTokenInfo = dstChain.Assets[outputToken];
          outputToken = outputTokenInfo.name;
          outputDecimals = outputTokenInfo.decimals;
        }
        const filledOutput = BigInt(intentFilledValue);
        const inputAmount = bigintDivisionToDecimalString(decoded[1], decimals);
        const outputAmount = bigintDivisionToDecimalString(filledOutput, outputDecimals);
        const minOutput: bigint = intent[5];
        const slippage = minOutput > 0n ? this.slippagePercent(minOutput, filledOutput) : "";
        return {
          txnFee: `${bigintDivisionToDecimalString(txFee, 18)} ${this.denom}`,
          payload: "0x",
          intentFilled: true,
          intentCancelled: false,
          swapInputToken: intent[2],
          swapOutputToken: intent[3],
          actionText: `IntentFilled ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})`,
          ...(slippage ? { slippage } : {}),
          intentTxHash: intentHash,
          blockNumber,
          storedCallReverted,
        };
      } catch {
        // Try next selector match.
      }
    }
    return null;
  }

  decodeExecuteCalldata(calldata: string) {
    const data = `0x${calldata.slice(10)}`;
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [calls] = abiCoder.decode(["tuple(address to, bytes[] args, bytes6 storeAs)[]"], data);
    return calls as { to: string; args: string[] }[];
  }

  parsePayloadData = (data: string, srcChainId: string, dstChainId: string): string => {
    const payloadBuffer = Buffer.from(data.replace(/^0x/, ''), 'hex');
    try {
      const rlp = RLP.decode(payloadBuffer);
      if (Array.isArray(rlp) && rlp.length === 5) {
        const tokenAddress = `0x${Buffer.from(rlp[0] as Uint8Array).toString('hex')}`.toLowerCase()
        const decodedAddress = decodeTokenAddress(tokenAddress, srcChainId, dstChainId)
        return getTokenDenom(decodedAddress, srcChainId, dstChainId)
      }
    } catch {
    }
    return ""
  };
}

function getTokenDenom(decodedAddress: string, srcChainId: string, dstChainId: string) {
  let chainId = srcChainId
  if (chainId === sonic) {
    chainId = dstChainId
  }
  const srcAssetsInformation = chains[chainId].Assets
  if (decodedAddress in srcAssetsInformation) {
    const denom = srcAssetsInformation[decodedAddress].name
    return denom
  }
  return ""
}


function decodeTokenAddress(
  tokenAddress: string,
  srcChainId: string,
  dstChainId: string,
): string {
  const chainId = srcChainId === sonic ? dstChainId : srcChainId;
  return getHandler(chainId).decodeAddress(tokenAddress);
}