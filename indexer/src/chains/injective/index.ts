import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";
import { bigintDivisionToDecimalString } from "../../utils";

export class InjectiveHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }

    decodeAddress(address: string): string {
        return Buffer.from(address.replace("0x", ""), 'hex').toString()
    }

    ensureHexPrefix(str: string): string {
        return str.startsWith("0x") ? str : `0x${str}`;
    }

    async fetchPayload(txHash: string,_txConnSn:string): Promise<TxPayload> {
        const txHashWithHex = this.ensureHexPrefix(txHash)
        const tx = (await axios.get(`${this.rpcUrl}/tx?hash=${txHashWithHex}`)).data.result;
        let txFee = BigInt(0)
        for (const event of tx.tx_result.events) {
            if (event.type === "tx") {
                for (const attr of event.attributes) {
                    if (attr.key === "fee") {
                        txFee = BigInt(attr.value.replace("inj", ""))
                    }
                }
            }
        }
        for (const event of tx.tx_result.events) {
            if (event.type === "wasm-Message") {
                for (const attr of event.attributes) {
                    if (attr.key === "payload") {
                        return {
                            txnFee: `${bigintDivisionToDecimalString(txFee, 18)} INJ`,
                            payload: attr.value,
                            blockNumber: 0
                        }
                    }
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