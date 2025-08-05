import axios from 'axios';
import { decodePayload } from "../utils";
import { ethers } from 'ethers';
import { AvaxTransactionResult, TransactionReceipt } from '../types/avax'

// Constants
const CROSS_CHAIN_EVENT_TOPIC = '0x0fcc8c448c97c08d0304a9eb321a5ffb209618d28a85dbc8d7a7a592124538ef';
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

function findCrossChainLog(logs: TransactionReceipt['logs']) {
    return logs.find(log =>
        log.topics.includes(CROSS_CHAIN_EVENT_TOPIC)
    );
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

    const crossChainLog = findCrossChainLog(receipt.logs);
    if (!crossChainLog) {
        return null;
    }

    const decodedData = decodeLogData(crossChainLog.data);
    if (decodedData) {
        console.log({ decodedData });
    }

    return decodedData;
}

async function fetchTransactionReceipt(hash: string): Promise<TransactionReceipt> {
    const AVAX_RPC_URL = process.env.AVAX_RPC_URL;

    if (!AVAX_RPC_URL) {
        throw new Error('AVAX_RPC_URL environment variable is not set');
    }

    const receiptBody = {
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getTransactionReceipt',
        params: [hash],
    };

    try {
        const { data: receiptData } = await axios.post(AVAX_RPC_URL, receiptBody);

        if (!receiptData.result) {
            throw new Error(`Transaction receipt not found for hash: ${hash}`);
        }

        return receiptData.result;
    } catch (error) {
        console.error('Error fetching transaction receipt:', error);
        throw error;
    }
}

export async function getAvaxTxByHash(hash: string): Promise<AvaxTransactionResult | null> {
    try {
        const receipt = await fetchTransactionReceipt(hash);
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