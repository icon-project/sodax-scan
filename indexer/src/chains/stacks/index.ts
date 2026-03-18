import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";

const RPC_TIMEOUT_MS = 8_000;
const FETCH_PAYLOAD_TIMEOUT_MS = 15_000;

function withTimeout<T>(ms: number, label: string, p: Promise<T>): Promise<T> {
    return Promise.race([
        p,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`StacksHandler timeout: ${label} (${ms}ms)`)), ms)
        ),
    ]);
}

interface StacksTxResult {
    block_height?: number;
    fee_rate?: string;
    tx_status?: string;
}

async function fetchTransaction(
    rpcUrl: string,
    txHash: string
): Promise<StacksTxResult | null> {
    try {
        const { data } = await axios.get(
            `${rpcUrl.replace(/\/+$/, "")}/extended/v1/tx/${txHash}`,
            { timeout: RPC_TIMEOUT_MS }
        );
        return data ?? null;
    } catch (err) {
        return null;
    }
}

function formatStxFee(microStx: string | undefined): string {
    if (!microStx) return "0 STX";
    const stx = Number(microStx) / 1_000_000;
    return `${stx.toFixed(6)} STX`;
}

export class StacksHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }

    decodeAddress(address: string): string {
        return address;
    }

    async fetchPayload(txHash: string, _connSn: string): Promise<TxPayload> {
        const result: TxPayload = {
            txnFee: "0",
            payload: "0x",
            blockNumber: null,
        };

        const run = async (): Promise<TxPayload> => {
            const tx = await fetchTransaction(this.rpcUrl, txHash);
            if (tx) {
                result.txnFee = formatStxFee(tx.fee_rate);
                if (tx.tx_status === "success" && tx.block_height != null) {
                    result.blockNumber = tx.block_height;
                } else {
                    result.blockNumber = null; // clearly unconfirmed
                }
            }
            return result;
        };

        try {
            return await withTimeout(FETCH_PAYLOAD_TIMEOUT_MS, "fetchPayload", run());
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[Stacks] fetchPayload error:", msg);
            return result;
        }
    }
}
