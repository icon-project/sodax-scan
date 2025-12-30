import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import {  scvMapToMap } from "./utils";
import { Message } from "./types";
import { Address, scValToNative, StrKey, xdr } from "@stellar/stellar-sdk";
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

    contractEventData(contractEvent: string) {
        const event = xdr.ContractEvent.fromXDR(contractEvent, "base64");
        // Extract fields
        const contractAddress = StrKey.encodeContract(event.contractId() as Buffer)

        const type = event.type().name; // e.g. CONTRACT, SYSTEM
        const body = event.body().v0();

        const topics = body.topics().map((t) => scValToNative(t));
        const data = body.data();
        return {
            contractAddress,
            type,
            topics,
            data,
        };
    }

    async fetchPayload(txHash: string, _txConnSn: string): Promise<TxPayload> {
        const jsonRpcRequest = {
            "jsonrpc": "2.0",
            "id": crypto.randomUUID(),
            "method": "getTransaction",
            "params": {
                "hash": txHash
            }
        };
        const response = (await axios.post(this.rpcUrl, jsonRpcRequest)).data;
        const txEvents = response.result.events.contractEventsXdr
        if (txEvents) {
            for (const contractEvents of txEvents) {
                for (const contractEvent of contractEvents) {
                    const eventData = this.contractEventData(contractEvent)
                    if (eventData) {
                        const isMessageEvent = eventData.topics.includes("Message")
                        if (isMessageEvent) {
                            const map = scvMapToMap(eventData.data)
                            const msg: Message = {
                                srcChainId: map.get("src_chain_id") as string,
                                srcAddress: map.get("src_address") as string,
                                dstAddress: map.get("dst_address") as string,
                                connSn: map.get("conn_sn") as string,
                                dstChainId: map.get("dst_chain_id") as string,
                                payload: map.get("payload") as string,
                                txHash: txHash
                            }
                            return {
                                txnFee: await this.getTxnFee(txHash),
                                payload: Buffer.from(msg.payload, 'base64').toString('hex'),
                                blockNumber: response.result.ledger
                            }
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

