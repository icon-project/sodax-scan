import axios from 'axios';


export async function getSuiTxByHash(hash: string) {

  const SUI_RPC_URL = process.env.SUI_RPC_URL || '';
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sui_getTransactionBlock',
    params: [hash, { showInput: true, showEffects: true, showEvents: true, }],
  };
  const { data } = await axios.post(SUI_RPC_URL, body);
  if (!data.result) return null;
  const tx = data.result;

  const method = tx.transaction?.data?.transaction?.transactions?.[0]?.MoveCall?.function || 'unknown';
  const gasFee = tx.transaction?.data?.gasData?.budget / 1e9 || 'unknown';
  const status = tx.effects?.status?.status || 'unknown';
  const timestamp = tx.timestampMs ? new Date(Number(tx.timestampMs)).toISOString() : 'unknown';
  return {
    chain: 'sui',
    txHash: hash,
    status,
    method,
    gasFee,
    timestamp,
  };
} 