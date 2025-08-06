import axios from 'axios';
import { decodePayload } from "../utils";
import { ethers } from 'ethers';
import { AvaxTransactionResult, TransactionReceipt } from '../types/avax'
import { fetchEvmTransactionReceipt } from '../utils/fetchEvmTransactionReceipt'

// Constants
const DEFAULT_ACTION_TYPE = 'SendMsg';
const WEI_TO_AVAX_DIVISOR = 1e18;

function calculateGasCost(receipt: TransactionReceipt): number {
    const gasUsedHex = receipt.gasUsed;
    const gasPriceHex = receipt.effectiveGasPrice || receipt.gasPrice;

    if (!gasPriceHex) {
        throw new Error('No gas price found in transaction receipt');
    }

    const gasUsed = parseInt(gasUsedHex, 16);
    const gasPrice = parseInt(gasPriceHex, 16);
    const totalWei = gasUsed * gasPrice;
    return totalWei / WEI_TO_AVAX_DIVISOR;
}


function decodeLogData(logData: string): { function: string; [key: string]: string | number | boolean | object | undefined } | null {
    try {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const decoded = abiCoder.decode(
            ['uint256', 'bytes', 'uint256', 'uint256', 'bytes', 'bytes'],
            logData
        );

        const payload = decoded[5] as string;
        const payloadBytes = payload.startsWith('0x') ? payload.slice(2) : payload;
        const payloadBuffer = Buffer.from(payloadBytes, 'hex');

        return decodePayload(payloadBuffer);
    } catch (error) {
        console.error('Error decoding log data:', error);
        return null;
    }
}

function extractDecodedData(receipt: TransactionReceipt): { function: string; [key: string]: string | number | boolean | object | undefined } | null {
    if (!receipt?.logs?.length) {
        return null;
    }

    for (const log of receipt.logs) {
        const decodedData = decodeLogData(log.data);
        if (decodedData) {
            return decodedData;
        }
    }

    return null;
}

export async function getAvaxTxByHash(hash: string): Promise<AvaxTransactionResult | null> {
    try {
        const URL = process.env.AVAX_RPC_URL
        const receipt = await fetchEvmTransactionReceipt(hash, URL);
        const totalAvax = calculateGasCost(receipt);
        const decodedData = extractDecodedData(receipt);

        return {
            chain: 'avax',
            method: decodedData?.function || DEFAULT_ACTION_TYPE,
            gasFee: totalAvax,
            txHash: hash,
        };
    } catch (error) {
        console.error(`Error processing transaction ${hash}:`, error);
        throw error;
    }
}