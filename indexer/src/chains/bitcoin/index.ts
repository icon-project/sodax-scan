import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";

const BTC_CHAIN_ID = "627463";

export class BitcoinHandler implements ChainHandler {
    private relayUrl: string;

    constructor(config: { relayUrl: string }) {
        this.relayUrl = config.relayUrl;
    }

    decodeAddress(address: string): string {
        return address;
    }

    async fetchPayload(txHash: string, connSn: string): Promise<TxPayload> {
        const data = JSON.stringify({
            action: "get_packet",
            params: {
                chain_id: BTC_CHAIN_ID,
                tx_hash: txHash,
                conn_sn: connSn,
            },
        });
        const response = (await axios.post(this.relayUrl, data)).data;
        if (!response.success || !response.data) {
            return {
                txnFee: "0",
                payload: "0x",
                blockNumber: 0,
            };
        }
        const d = response.data;
        let payloadHex = d.payload ?? "0x";
        if (typeof payloadHex === "string" && !payloadHex.startsWith("0x")) {
            payloadHex = "0x" + payloadHex;
        }
        const result: TxPayload = {
            txnFee: "0",
            payload: payloadHex,
            blockNumber: 0,
        };
        if (d.dst_address != null) {
            result.dstAddress = typeof d.dst_address === "string" ? d.dst_address : String(d.dst_address);
        }
        return result;
    }
}
