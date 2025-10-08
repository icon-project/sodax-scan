import { TxPayload } from "../types";

export interface ChainHandler {
  fetchPayload(txHash: string,txConnSn:string): Promise<TxPayload>;
  decodeAddress(address: string): string
}
