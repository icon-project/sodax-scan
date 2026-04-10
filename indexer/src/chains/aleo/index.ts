import axios from "axios";
import { TxPayload } from "../../types";
import { ChainHandler } from "../../types/ChainHandler";

const RPC_TIMEOUT_MS = 10_000;

interface AleoTransaction {
    type: string;
    id: string;
    fee_value?: number;
    block_height?: number;
    block_timestamp?: string;
    status?: string;
    execution?: {
        transitions?: AleoTransition[];
    };
}

interface AleoTransition {
    id: string;
    program: string;
    function: string;
    inputs?: { type: string; id: string; value: string }[];
    outputs?: { type: string; id: string; value: string }[];
}

export class AleoHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl.replace(/\/+$/, "");
    }

    decodeAddress(address: string): string {
        return address;
    }

    async fetchPayload(txHash: string, _txConnSn: string): Promise<TxPayload> {
        const result: TxPayload = {
            txnFee: "0",
            payload: "0x",
            blockNumber: null,
        };

        try {
            const { data } = await axios.get<AleoTransaction>(
                `${this.rpcUrl}/transactions/${txHash}`,
                { timeout: RPC_TIMEOUT_MS }
            );

            if (data.fee_value != null) {
                // fee_value is in microcredits (1 credit = 1_000_000 microcredits)
                const credits = data.fee_value / 1_000_000;
                result.txnFee = `${credits} ALEO`;
            }

            if (data.block_height != null) {
                result.blockNumber = data.block_height;
            }

            // Extract payload from execution transitions if available
            if (data.execution?.transitions) {
                for (const transition of data.execution.transitions) {
                    if (/^connection_v\d+\.aleo$/.test(transition.program) && transition.function === "send_message") {
                        // Extract the payload from transition inputs/outputs
                        const inputs = transition.inputs ?? [];
                        for (const input of inputs) {
                            if (input.type === "private" && input.value) {
                                result.payload = input.value;
                                break;
                            }
                        }
                        break;
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[Aleo] fetchPayload error:", msg);
        }

        return result;
    }
}
