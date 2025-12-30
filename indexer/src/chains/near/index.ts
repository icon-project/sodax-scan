import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";
import { bigintDivisionToDecimalString } from "../../utils";

export class NearHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }

    decodeAddress(address: string): string {
        return Buffer.from(address.replace("0x", ""), 'hex').toString()
    }

    async fetchPayload(txHash: string, _txConnSn: string): Promise<TxPayload> {
        const nearTxnRequest = {
            method: 'get',
            url: `${process.env.NEAR_URL}/txns/${txHash}`,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
            },
        };;
        const parsedResponse = (await axios.request(nearTxnRequest)).data;
        const totalGas = Number(parsedResponse.txns[0].outcomes_agg.transaction_fee)
        for (const action of parsedResponse.txns[0].actions) {
            const argsStr = JSON.parse(action.args);
            if ("msg" in argsStr) {
                let msg = argsStr.msg
                msg = msg.replaceAll("\\\\\\", "")
                const msgObj = JSON.parse(msg);
                const dataBytes = msgObj.data;
                return {
                    txnFee: `${bigintDivisionToDecimalString(BigInt(totalGas), 24)} Near`,
                    payload: Buffer.from(dataBytes).toString("hex"),
                    blockNumber: parsedResponse.txns[0].block.block_height

                };
            }
            if ("payload" in argsStr) {
                const dataBytes = argsStr.payload;
                return {
                    txnFee: `${bigintDivisionToDecimalString(BigInt(totalGas), 24)} Near`,
                    payload: Buffer.from(dataBytes).toString("hex"),
                    blockNumber: parsedResponse.txns[0].block.block_height
                };
            }
            const dataBytes = argsStr.data;
            return {
                txnFee: `${bigintDivisionToDecimalString(BigInt(totalGas), 24)} Near`,
                payload: Buffer.from(dataBytes).toString("hex"),
                blockNumber: parsedResponse.txns[0].block.block_height
            };
        }
        return {
            txnFee: "0",
            payload: "0x",
            blockNumber: 0
        }
    }
}
