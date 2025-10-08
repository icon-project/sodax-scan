import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { getMessageFromValue, stringToEncodedScVal } from "./utils";
import { Message } from "./types";
import { Address, xdr } from "@stellar/stellar-sdk";
import { TxPayload } from "../../types";
import { bigintDivisionToDecimalString } from "../../utils";

export class StellarHandler implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }

    decodeAddress(address: string): string {
        try {
            const cleanHex = address.startsWith("0x") ? address.slice(2) : address;
            const scVal = xdr.ScVal.fromXDR(cleanHex, "hex");
            const addr = Address.fromScVal(scVal);
            return addr.toString();
        } catch {
            return address
        }
    }

    async getTxnFee(txHash: string): Promise<string> {
        const config = {
            method: 'get',
            url: `${process.env.HORIZON_URL}/transactions/${txHash}`,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
            },
        };
        const response = (await axios.request(config)).data;
        const fee = response.fee_charged
        return `${bigintDivisionToDecimalString(BigInt(fee), 7)} XLM`


    }

    async fetchPayload(txHash: string,_dstChainId:string): Promise<TxPayload> {
        const jsonRpcRequest = {
            "jsonrpc": "2.0",
            "id": crypto.randomUUID(),
            "method": "getTransaction",
            "params": {
                "hash": txHash
            }
        };
        const response = (await axios.post(this.rpcUrl, jsonRpcRequest)).data;
        const txLedger = response.result.ledger
        const jsonEventRequest = {
            "id": crypto.randomUUID(),
            "jsonrpc": "2.0",
            "method": "getEvents",
            "params": {
                "startLedger": txLedger,
                "pagination": {
                    "limit": 1
                },
                "filters": [
                    {
                        "type": "contract",
                        "topics": [
                            [
                                stringToEncodedScVal("Message")
                            ]
                        ]
                    }
                ]
            }
        };
        const events = (await axios.post(this.rpcUrl, jsonEventRequest)).data;
        for (const event of events.result.events) {
            const msg: Message = getMessageFromValue(txHash, event.value)
            return {
                txnFee: await this.getTxnFee(txHash),
                payload: Buffer.from(msg.payload, 'base64').toString('hex')
            }
        }
        return {
            txnFee: "0",
            payload: "0x"

        }
    }
}

