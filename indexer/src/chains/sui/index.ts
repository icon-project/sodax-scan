import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";
import { bigintDivisionToDecimalString } from "../../utils";

export class SuiHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }

    decodeAddress(address: string): string {
        return Buffer.from(address.replace("0x", ""), 'hex').toString()
    }

    async fetchPayload(txHash: string,_dstChainId:string): Promise<TxPayload> {
        const jsonRpcRequest = {
            jsonrpc: "2.0",
            method: "sui_getTransactionBlock",
            params: [
                txHash,
                {
                    "showInput": false,
                    "showRawInput": false,
                    "showEffects": true,
                    "showEvents": true,
                    "showObjectChanges": false,
                    "showBalanceChanges": false,
                    "showRawEffects": false
                }
            ],
            id: 1
        };
        const parsedResponse = (await axios.post(this.rpcUrl, jsonRpcRequest)).data;
        const totalGas = Number(parsedResponse.result.effects.gasUsed.computationCost) + Number(parsedResponse.result.effects.gasUsed.storageCost) - Number(parsedResponse.result.effects.gasUsed.storageRebate)
        for (const event of parsedResponse.result.events) {
            if(event.type !== "0xf3b1e696a66d02cb776dc15aae73c68bc8f03adcb6ba0ec7f6332d9d90a6a3d2::connectionv3::Message"){
                continue
            }
            const parsedJson = event.parsedJson
            return {
                txnFee: `${bigintDivisionToDecimalString(BigInt(totalGas),9)} SUI`,
                payload: Buffer.from(parsedJson.payload).toString("hex"),
            };
        }
        return {
            txnFee: "0",
            payload: "0x"
        }
    }
}
