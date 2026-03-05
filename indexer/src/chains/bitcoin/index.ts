import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";

const RPC_TIMEOUT_MS = 8_000;
const FETCH_PAYLOAD_TIMEOUT_MS = 15_000;

function withTimeout<T>(ms: number, label: string, p: Promise<T>): Promise<T> {
    return Promise.race([
        p,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`BitcoinHandler timeout: ${label} (${ms}ms)`)), ms)
        ),
    ]);
}

/** Decoded tx from getrawtransaction(txid, 2). */
interface BitcoinTxVin {
    prevout?: { value: number };
}
interface BitcoinTxVout {
    value: number;
    scriptPubKey?: { address?: string; addresses?: string[] };
}

interface BitcoinRawTx {
    vin?: BitcoinTxVin[];
    vout?: BitcoinTxVout[];
    blockhash?: string;
    blockheight?: number;
}

async function fetchRawTransaction(
    rpcUrl: string,
    txHash: string
): Promise<BitcoinRawTx | null> {
    try {
        const { data } = await axios.post(
            rpcUrl,
            {
                jsonrpc: "2.0",
                id: 1,
                method: "getrawtransaction",
                params: [txHash, 2],
            },
            { timeout: RPC_TIMEOUT_MS }
        );
        if (data.error) {
            return null;
        }
        return data.result ?? null;
    } catch (err) {
        return null;
    }
}

async function fetchBlockHeight(rpcUrl: string, blockHash: string): Promise<number | null> {
    try {
        const { data } = await axios.post(
            rpcUrl,
            {
                jsonrpc: "2.0",
                id: 1,
                method: "getblock",
                params: [blockHash, 1],
            },
            { timeout: RPC_TIMEOUT_MS }
        );
        if (data.error || !data.result) {
            return null;
        }
        const height = data.result.height;
        return typeof height === "number" ? height : null;
    } catch (err) {
        return null;
    }
}

function computeFeeBtc(tx: BitcoinRawTx): number {
    let sumIn = 0;
    let sumOut = 0;
    for (const inp of tx.vin ?? []) {
        if (inp.prevout?.value != null) sumIn += inp.prevout.value;
    }
    for (const out of tx.vout ?? []) {
        if (out.value != null) sumOut += out.value;
    }
    return Math.max(0, sumIn - sumOut);
}

function formatBtcFee(btc: number): string {
    return `${btc.toFixed(8)} BTC`;
}

export class BitcoinHandler implements ChainHandler {
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
            blockNumber: 0,
        };

        const run = async (): Promise<TxPayload> => {
            const rawTx = await fetchRawTransaction(this.rpcUrl, txHash);
            if (rawTx) {
                result.txnFee = formatBtcFee(computeFeeBtc(rawTx));
                const blockHeight =
                    rawTx.blockheight ??
                    (rawTx.blockhash ? await fetchBlockHeight(this.rpcUrl, rawTx.blockhash) : null);
                if (blockHeight != null) {
                    result.blockNumber = blockHeight;
                }
            }
            return result;
        };

        try {
            return await withTimeout(FETCH_PAYLOAD_TIMEOUT_MS, "fetchPayload", run());
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[Bitcoin] fetchPayload error:", msg);
            return result;
        }
    }
}
