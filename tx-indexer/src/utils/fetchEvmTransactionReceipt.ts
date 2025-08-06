import axios from "axios";
import { TransactionReceipt } from '../types/avax'

export async function fetchEvmTransactionReceipt(hash: string, URL: string | undefined): Promise<TransactionReceipt> {
    if (!URL) {
        throw new Error(`RPC_URL not found.`);
    }

    const receiptBody = {
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getTransactionReceipt',
        params: [hash],
    };

    try {
        const { data: receiptData } = await axios.post(URL, receiptBody);

        if (!receiptData.result) {
            throw new Error(`Transaction receipt not found for hash: ${hash}`);
        }

        return receiptData.result;
    } catch (error) {
        console.error('Error fetching transaction receipt:', error);
        throw error;
    }
}