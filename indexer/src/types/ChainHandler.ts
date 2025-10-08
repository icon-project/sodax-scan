import { TxPayload } from "../types";

export interface ChainHandler {
  fetchPayload(txHash: string,dstChainId:string): Promise<TxPayload>;
  decodeAddress(address: string): string
}
