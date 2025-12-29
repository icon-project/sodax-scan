
export type Action = "Supply" | "Borrow" | "Repay" | "Transfer" | "SendMsg" | "Deposit" | "Withdraw" | "CreateIntent" | "CancelIntent" | "IntentFilled" | "Migration"


export const SendMessage = "SendMsg"
export const Transfer = "Transfer"
export type actionType = {
  action: Action
  amount?: string
  tokenAddress?: string
  denom?: string
  swapInputToken?: string
  swapOutputToken?: string
  actionText?: string
  intentTxHash?: string
}

export interface TxPayload {
  txnFee: string
  payload: string
  intentFilled?: boolean
  intentCancelled?: boolean
  reverseSwap?: boolean
  dstAddress?: string,
  swapInputToken?: string
  swapOutputToken?: string
  actionText?: string
  slippage?: string
  intentTxHash?: string
}

export interface SodaxScannerResponse {
  data: Datum[];
}

export interface Datum {
  id:                       number;
  sn:                       string;
  status:                   string;
  src_network:              string;
  src_tx_hash:              string;
  src_address:              string;
  dest_network:             string;
  dest_block_timestamp:     string;
  dest_tx_hash:             string;
  dest_address:             string;
  fee:                      string;
  action_type:              string;
  action_detail:            string;
  created_at:               string;
  updated_at:               string;
  intent_tx_hash:           string;
}
