import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";
import { bigintDivisionToDecimalString } from "../../utils";

export class IconHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }
    decodeAddress(address: string): string {
        if (address.startsWith("0x01")) {
            return address.replace("0x01", "cx");
        }
        return address.replace("0x00", "hx");
    }
    async fetchPayload(txHash: string,_txConnSn:string): Promise<TxPayload> {
        const jsonRpcRequest = {
            "jsonrpc": "2.0",
            "method": "icx_getTransactionResult",
            "id": 2,
            "params": {
                "txHash": txHash
            }
        };
        const response = (await axios.post(this.rpcUrl, jsonRpcRequest)).data;
        for (const event of response.result.eventLogs) {
            if (!(event.indexed.length > 0)) {
                continue
            }
            if (event.scoreAddress.toLocaleLowerCase() !== "cxe5cdf3b0f26967b0efc72d470d57bbf534268f94") {
                continue
            }
            const stepsUsed = BigInt(response.result.stepUsed)
            const stepsPrice = BigInt(response.result.stepPrice)
            const fee = stepsUsed * stepsPrice
            return {
                txnFee: `${bigintDivisionToDecimalString(fee,18)} ICX`,
                payload: event.data[2],
                blockNumber: Number.parseInt(response.result.blockHeight,16)
            };
        }
        return {
            txnFee: "0",
            payload: "0x",
            blockNumber:0
        }
    }
}
