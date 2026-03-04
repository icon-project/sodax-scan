import { ethers } from "ethers";
import { actionType, SendMessage, Transfer } from "./types";
import { getHandler } from "./handler";
import { RLP } from '@ethereumjs/rlp';
import { chains, idToChainNameMap, sonic } from "./configs";
import { bigintDivisionToDecimalString } from "./utils";
import axios from "axios";

const calculateSelector = (signature: string) => ethers.keccak256(ethers.toUtf8Bytes(signature)).slice(0, 10);
const zeroAddress = "0x0000000000000000000000000000000000000000"
const SELECTORS = {
    deposit: calculateSelector('deposit(address,uint256)'),
    supply: calculateSelector('supply(address,uint256,address,uint16)'),
    withdraw: calculateSelector('withdraw(address,uint256,address)'),
    borrow: calculateSelector('borrow(address,uint256,uint256,uint16,address)'),
    repay: calculateSelector('repay(address,uint256,uint256,address)'),
    aaveDeposit: calculateSelector('deposit(address,uint256,address,uint16)'),
    tokenDeposit: calculateSelector('deposit(uint256,address)'),
    createIntent: calculateSelector('createIntent((uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))'),
    swap: calculateSelector('swap(uint256,address)'),
};

export const finalActionTypes = ["Supply", "Borrow", "Withdraw", "Repay", "CreateIntent", "CancelIntent", "Reverted"]
export const decodeCallData = (callData: string, srcChainId: string, _: string): actionType => {
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const selector = callData.slice(0, 10);
    const data = `0x${callData.slice(10)}`;
    console.log("SELECTOR", selector);
    console.log("DATA", data);
    switch (selector) {
        case SELECTORS.supply:
            {
                const supply = abi.decode(['address', 'uint256', 'address', 'uint16'], data);
                const assetsInformation = chains[srcChainId].Assets
                const tokenAddress = supply[0].toLowerCase()
                const tokenAmount = supply[1]
                return {
                    action: 'Supply',
                    tokenAddress: tokenAddress,
                    amount: tokenAmount,
                    actionText: tokenAddress in assetsInformation ? `Supply ${bigintDivisionToDecimalString(supply[1], assetsInformation[tokenAddress].decimals)} ${assetsInformation[tokenAddress].name}` : `Supply ${bigintDivisionToDecimalString(tokenAmount, 18)} ${tokenAddress}`
                };
            }
        case SELECTORS.withdraw:
            {
                const withdraw = abi.decode(['address', 'uint256', 'address'], data);
                const amount = withdraw[1]
                const tokenAddress = withdraw[0].toLowerCase()
                const assetsInformation = chains[srcChainId].Assets
                return {
                    action: 'Withdraw',
                    amount: amount,
                    tokenAddress: tokenAddress,
                    actionText: tokenAddress in assetsInformation ? `Withdraw ${bigintDivisionToDecimalString(withdraw[1], assetsInformation[tokenAddress].decimals)} ${assetsInformation[tokenAddress].name}` : `Withdraw ${bigintDivisionToDecimalString(withdraw[1], 18)} ${tokenAddress}`
                };
            }
        case SELECTORS.borrow:
            {
                const borrow = abi.decode(['address', 'uint256', 'uint256', 'uint16', 'address'], data);
                const assetsInformation = chains[srcChainId].Assets
                const tokenAddress = borrow[0].toLowerCase()
                return {
                    action: 'Borrow',
                    amount: borrow[1],
                    tokenAddress: tokenAddress,
                    actionText: tokenAddress in assetsInformation ? `Borrow ${bigintDivisionToDecimalString(borrow[1], assetsInformation[tokenAddress].decimals)} ${assetsInformation[tokenAddress].name}` : `Borrow ${bigintDivisionToDecimalString(borrow[1], 18)} ${tokenAddress}`
                };
            }
        case SELECTORS.repay:
            {
                const repay = abi.decode(['address', 'uint256', 'uint256', 'address'], data);
                const assetsInformation = chains[srcChainId].Assets
                const tokenAddress = repay[0].toLowerCase()
                return {
                    action: 'Repay',
                    amount: repay[1],
                    tokenAddress: tokenAddress,
                    actionText: tokenAddress in assetsInformation ? `Repay ${bigintDivisionToDecimalString(repay[1], assetsInformation[tokenAddress].decimals)} ${assetsInformation[tokenAddress].name}` : `Repay ${bigintDivisionToDecimalString(repay[1], 18)} ${tokenAddress}`
                };
            }
        case SELECTORS.createIntent:
            {
                const intentTuple = "(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)";
                const intentDecoded = abi.decode([intentTuple], data);
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
                const outputAmount = bigintDivisionToDecimalString(result[5], outputDecimals)
                const actionText = `IntentSwap ${inputAmount} ${inputToken}(${idToChainNameMap[srcChainId]}) -> ${outputAmount} ${outputToken}(${idToChainNameMap[dstChainId]})`
                return {
                    action: 'CreateIntent',
                    swapInputToken: result[2],
                    swapOutputToken: result[3],
                    actionText: actionText,
                    intentTxHash: result[0].toString()
                }
            }
        // case SELECTORS.cancelIntent:
        //     {
        //         console.log("Cancelling intent...")
        //         const intentTuple = "(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)";
        //         const intentDecoded = abi.decode([intentTuple], data);
        //         const result = intentDecoded[0]
        //         return {
        //             action: 'CancelIntent',
        //             swapInputToken: result[2],
        //             swapOutputToken: result[3]
        //         }
        //     }
        // case SELECTORS.tokenDeposit:
        //     {
        //         const tokenDeposit = abi.decode(['uint256', 'address'], data);
        //         const assetsInformation = chains[srcChainId].Assets
        //         const tokenAddress = tokenDeposit[1].toLowerCase()
        //         return {
        //             action: 'Deposit',
        //             amount: tokenDeposit[0],
        //             actionText: tokenAddress in assetsInformation ? `Deposit ${bigintDivisionToDecimalString(tokenDeposit[0], assetsInformation[tokenAddress].decimals)} ${assetsInformation[tokenAddress].name}` : `deposit ${bigintDivisionToDecimalString(tokenDeposit[0], 18)} ${tokenAddress}`
        //         };
        //     }

        case SELECTORS.deposit:
            {
                const deposit = abi.decode(['address', 'uint256'], data);
                const assetsInformation = chains[srcChainId].Assets
                const tokenAddress = deposit[0].toLowerCase()
                return {
                    action: 'Deposit',
                    amount: deposit[1],
                    actionText: tokenAddress in assetsInformation ? `Deposit ${bigintDivisionToDecimalString(deposit[1], assetsInformation[tokenAddress].decimals)} ${assetsInformation[tokenAddress].name}` : `Deposit ${bigintDivisionToDecimalString(deposit[1], 18)} ${tokenAddress}`
                };
            }
        case SELECTORS.swap:
            {
                const swap = abi.decode(['uint256','address'], data);
                return {
                    action: 'Migration',
                    amount: swap[0],
                    actionText: `Migrated ${bigintDivisionToDecimalString(swap[0], 18)} ICX`
                };
            }
        default:
    }
    return {
        action: SendMessage
    };
};

export const parseSolanaTransaction = async (txnHash: string, connSn: string): Promise<string> => {
    const data = JSON.stringify({
        "action": "get_packet",
        "params": {
            "chain_id": "1",
            "tx_hash": txnHash,
            "conn_sn": connSn
        }
    });
    const response = (await axios.post(process.env.RELAY_URL || "",
        data
    )).data
    const payloadData = JSON.parse(response.data.data) || {}
    if ("payload" in payloadData) {
        return payloadData.payload
    }
    return "0x"
}

export const parseBitcoinTransaction = async (txnHash: string, connSn: string): Promise<string> => {
    const data = JSON.stringify({
        "action": "get_packet",
        "params": {
            "chain_id": "627463",
            "tx_hash": txnHash,
            "conn_sn": connSn
        }
    });
    const response = (await axios.post(process.env.RELAY_URL || "",
        data
    )).data
    console.log('Bitcoin response 000000', response)
    const payloadData = JSON.parse(response.data.data) || {}
    if ("payload" in payloadData) {
        return payloadData.payload
    }
    return "0x"
}

const BTC_TOKEN_ID = "0:0";

export interface BitcoinDecodedPayload {
    tokenId: string;
    from: string;
    to: string;
    amount: bigint;
    data: string;
}

export function decodeBitcoinPayload(payloadHex: string): BitcoinDecodedPayload | null {
    try {
        const normalized = payloadHex.replace(/^0x/, '');
        const payloadBuffer = Buffer.from(normalized, 'hex');
        const decoded = RLP.decode(payloadBuffer);

        if (!Array.isArray(decoded) || decoded.length < 4) {
            return null;
        }

        const toBuffer = (x: unknown): Buffer =>
            Buffer.isBuffer(x) ? x : Buffer.from(x as Uint8Array);

        const tokenBuf = toBuffer(decoded[0]);
        const fromBuf = toBuffer(decoded[1]);
        const toBuf = toBuffer(decoded[2]);
        const amountBuf = toBuffer(decoded[3]);
        const dataBuf = decoded.length > 4 ? toBuffer(decoded[4]) : Buffer.alloc(0);

        const tokenId = tokenBuf.length > 0 ? tokenBuf.toString('utf8') : BTC_TOKEN_ID;
        // from is 20 bytes when source is EVM (Ethereum address); decode as hex, else UTF-8
        const from =
            fromBuf.length === 20
                ? '0x' + fromBuf.toString('hex')
                : fromBuf.length > 0
                    ? fromBuf.toString('utf8') || '0x' + fromBuf.toString('hex')
                    : '';
        const to = toBuf.length > 0 ? toBuf.toString('utf8') || toBuf.toString('hex') : '';
        const amountHex = amountBuf.length > 0 ? amountBuf.toString('hex') : '0';
        const amount = BigInt('0x' + amountHex);
        const data = dataBuf.length > 0 ? '0x' + dataBuf.toString('hex') : '0x';

        return { tokenId, from, to, amount, data };
    } catch {
        return null;
    }
}

export function getBitcoinPayloadDenom(payloadHex: string, chainId: string): string {
    const decoded = decodeBitcoinPayload(payloadHex);
    if (!decoded || !(chainId in chains)) return "";
    const assets = chains[chainId].Assets;
    return assets[decoded.tokenId]?.name ?? "";
}

export function mapBitcoinPayloadToActionType(
    decoded: BitcoinDecodedPayload,
    srcChainId: string,
    _dstChainId: string
): actionType {
    const amountStr = decoded.amount.toString();
    const tokenAddress = decoded.tokenId;
    const result: actionType = {
        action: Transfer,
        amount: amountStr,
        tokenAddress,
    };
    if (srcChainId in chains) {
        const assetsInformation = chains[srcChainId].Assets;
        if (tokenAddress in assetsInformation) {
            const { name, decimals } = assetsInformation[tokenAddress];
            result.denom = name;
            result.actionText = `Transfer ${bigintDivisionToDecimalString(decoded.amount, decimals)} ${name}`;
        } else {
            result.actionText = `Transfer ${amountStr} ${tokenAddress}`;
        }
    } else {
        result.actionText = `Transfer ${amountStr} ${tokenAddress}`;
    }
    return result;
}

export const parsePayloadData = (data: string, srcChainId: string, dstChainId: string): actionType => {
    // console.log("PARSING PAYLOAD DATA", data, srcChainId, dstChainId);
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const payloadBuffer = Buffer.from(data.replace(/^0x/, ''), 'hex');
    let tmpResult: actionType = {
        action: Transfer
    }
    try {
        const rlp = RLP.decode(payloadBuffer);
        if (Array.isArray(rlp) && rlp.length === 5) {
            // console.log("RLP", rlp);
            const tokenAddress = `0x${Buffer.from(rlp[0] as Uint8Array).toString('hex')}`.toLowerCase()
            const tokenAmount = rlp[3] && (rlp[3] as Uint8Array).length > 0
                ? BigInt(`0x${Buffer.from(rlp[3] as Uint8Array).toString('hex')}`)
                : 0n
            const callDataHex = `0x${Buffer.from(rlp[4] as Uint8Array).toString('hex')}`;
            // console.log("CALL DATA HEX", callDataHex);
            let denom = ""

            if (dstChainId in chains) {
                // console.log("DST CHAIN ID", dstChainId);
                const assetsInformation = chains[dstChainId].Assets
                if (tokenAddress in assetsInformation) {
                    denom = assetsInformation[tokenAddress].name
                }
                const srcAssetsInformation = chains[srcChainId].Assets
                if (tokenAddress === "0x0000000000000000000000000000000000000000") {
                    denom = srcAssetsInformation[tokenAddress].name
                }
            }
            if (callDataHex !== "0x") {
                // console.log("CALL DATA HEX", callDataHex);
                const innerCalls = abi.decode(['(address,uint256,bytes)[]'], callDataHex);
                for (const call of innerCalls[0]) {
                    const result = decodeCallData(call[2], srcChainId, dstChainId);
                    // console.log("RESULT", result);
                    if (!result.tokenAddress) {
                        result.tokenAddress = tokenAddress
                    }
                    if (result.action !== SendMessage) {
                        tmpResult = result
                        tmpResult.denom = denom
                        if (!tmpResult.amount) {
                            tmpResult.amount = bigintDivisionToDecimalString(tokenAmount, 18)
                        }
                    }
                    if (finalActionTypes.includes(result.action)) {
                        result.tokenAddress = decodeTokenAddress(result.tokenAddress, srcChainId, dstChainId)
                        // console.log("RESULT TOKEN ADDRESS", result.tokenAddress);
                        return result;
                    }
                }
            } else {
                tmpResult.tokenAddress = decodeTokenAddress(tokenAddress, srcChainId, dstChainId)
                // console.log("TMP RESULT TOKEN ADDRESS", tmpResult.tokenAddress);
                tmpResult.denom = denom
            }
            if (!tmpResult.amount) {
                tmpResult.amount = bigintDivisionToDecimalString(tokenAmount, 18)
                tmpResult.tokenAddress = decodeTokenAddress(tokenAddress, srcChainId, dstChainId)
                tmpResult.denom = denom
                // console.log("TMP RESULT DENOM", tmpResult.denom);
            }
            if (tmpResult.tokenAddress && tmpResult.action === Transfer) {
                // console.log("TMP RESULT TOKEN ADDRESS", tmpResult.tokenAddress);
                let chainId = srcChainId
                if (chainId === sonic) {
                    chainId = dstChainId
                }
                const srcAssetsInformation = chains[chainId].Assets
                if (tmpResult.tokenAddress in srcAssetsInformation) {
                    const denom = srcAssetsInformation[tmpResult.tokenAddress].name
                    const decimals = srcAssetsInformation[tmpResult.tokenAddress].decimals
                    const inputAmount = tmpResult.amount || "0"
                    tmpResult.actionText = `Transfer ${processAmount(inputAmount, decimals)} ${denom}`
                    // console.log("TMP RESULT ACTION TEXT", tmpResult.actionText);
                } else {
                    tmpResult.actionText = `Transfer ${processAmount(tmpResult.amount, srcAssetsInformation[zeroAddress].decimals)} ${tmpResult.tokenAddress}`
                    // console.log("TMP RESULT ACTION TEXT", tmpResult.actionText);
                }
            }

            // console.log("TMP RESULT **** ", tmpResult);
        }
    } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        console.log("error with fallback ABI decode", errMessage)
        try {
            const innerCalls = abi.decode(['(address,uint256,bytes)[]'], payloadBuffer);
            for (const call of innerCalls[0]) {

                const result = decodeCallData(call[2], srcChainId, dstChainId);
                if (result.action !== SendMessage) {
                    tmpResult = result
                    if (!tmpResult.amount) {
                        tmpResult.amount = call[1]
                        tmpResult.tokenAddress = call[0]
                    }
                }
                if (finalActionTypes.includes(result.action)) {
                    if (result.tokenAddress) {
                        result.tokenAddress = decodeTokenAddress(result.tokenAddress, srcChainId, dstChainId)
                    }
                    return result;
                }
            }
            // if (tmpResult.tokenAddress) {
            //     let chainId = srcChainId
            //     if (chainId === sonic) {
            //         chainId = dstChainId
            //     }
            //     tmpResult.tokenAddress = getHandler(chainId).decodeAddress(tmpResult.tokenAddress)
            //     if (tmpResult.action === Transfer) {
            //         const srcAssetsInformation = chains[chainId].Assets
            //         if (tmpResult.tokenAddress in srcAssetsInformation) {
            //             const denom = srcAssetsInformation[tmpResult.tokenAddress].name
            //             const decimals = srcAssetsInformation[tmpResult.tokenAddress].decimals
            //             const inputAmount = tmpResult.amount || "0"
            //             tmpResult.actionText = `Transfer ${processAmount(inputAmount, decimals)} ${denom}`
            //         } else {
            //             tmpResult.actionText = `Transfer ${processAmount(tmpResult.amount || 0, srcAssetsInformation[zeroAddress].decimals)} ${tmpResult.tokenAddress}`
            //         }
            //     }
            // }
        } catch (err) {
            const errMessage = err instanceof Error ? err.message : String(err);
            console.log("error occurred parsing payload", errMessage)
            return {
                action: SendMessage
            }
        }
    }

    // console.log("TMP RESULT ****///// ", tmpResult);
    return tmpResult;
};

function processAmount(amountStr: string, scale: number): string {
    const decimals = 18
    const [intPart, fracPart = ""] = amountStr.split(".");
    const paddedFrac = (fracPart + "0".repeat(decimals)).slice(0, decimals);
    const fullNumberStr = intPart + paddedFrac;
    const fullNumber = BigInt(fullNumberStr);

    const divisor = BigInt(10 ** scale);
    const quotient = fullNumber / divisor;
    const remainder = fullNumber % divisor;

    // Construct decimal result
    const quotientStr = quotient.toString();

    const fractionalPart = (remainder * BigInt(10 ** 18) / divisor)
        .toString()
        .padStart(18, '0')
        .replace(/0+$/, '');

    return fractionalPart ? `${quotientStr}.${fractionalPart}` : quotientStr;
}

function decodeTokenAddress(
    tokenAddress: string,
    srcChainId: string,
    dstChainId: string,
): string {
    const chainId = srcChainId === sonic ? dstChainId : srcChainId;
    return getHandler(chainId).decodeAddress(tokenAddress);
}