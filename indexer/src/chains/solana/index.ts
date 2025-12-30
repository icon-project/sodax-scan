import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";
import bs58 from 'bs58';
import * as borsh from "@coral-xyz/borsh";
const eventLogPrefix = "Program data: "
import { msg } from "./types"
import { bigintDivisionToDecimalString } from "../../utils";
export class SolanaHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }

    decodeAddress(address: string): string {
        try {
            const bytes = Uint8Array.from(Buffer.from(address.replace(/^0x/, ""), "hex"));
            return bs58.encode(bytes);
        } catch {
            return address
        }
    }

    async fetchPayload(txHash: string,_txConnSn:string): Promise<TxPayload> {
        const jsonRpcRequest = {
            jsonrpc: "2.0",
            method: "getTransaction",
            params: [
                txHash,
                {
                    "commitment": "finalized",
                    "maxSupportedTransactionVersion": 0
                }
            ],
            id: crypto.randomUUID()
        };
        const parsedResponse = (await axios.post(this.rpcUrl, jsonRpcRequest)).data;
        for (let log of parsedResponse.result.meta.logMessages) {
            if (log.startsWith(eventLogPrefix)) {
                log = log.replace(eventLogPrefix, "").trim()
                const eventSchema = borsh.struct<msg>([
                    borsh.u64("discriminator"),
                    borsh.u128("srcChainId"),
                    borsh.vecU8("srcAddress"),
                    borsh.u128("connSn"),
                    borsh.u128("dstChainId"),
                    borsh.vecU8("dstAddress"),
                    borsh.vecU8("payload"),
                ])
                try {
                    const buffer = Buffer.from(log, 'base64');
                    const ds: msg = eventSchema.decode(buffer)
                    const payload = Buffer.from(ds.payload).toString("hex")
                    return {
                        txnFee: `${bigintDivisionToDecimalString(BigInt(parsedResponse.result.meta.fee), 9)} SOL`,
                        payload: payload,
                        blockNumber: parsedResponse.result.slot
                    };
                } catch (err) {
                    console.log(err)
                }
            }
        }
        return {
            txnFee: "0",
            payload: "0x",
            blockNumber: 0
        }
    }
}
