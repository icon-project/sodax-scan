export interface TransactionReceipt {
    gasUsed: string;
    effectiveGasPrice?: string;
    gasPrice?: string;
    logs: Array<{
        topics: string[];
        data: string;
    }>;
}

export interface AvaxTransactionResult {
    chain: string;
    method: string;
    gasFee: number;
    txHash: string;
}