import axios from 'axios';

export async function getSolanaTxByHash(hash: string) {
  const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || '';
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [hash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
  };
  
  const { data } = await axios.post(SOLANA_RPC_URL, body);
  if (!data.result) return null;
  
  const tx = data.result;
  
  const accountKeys = tx.transaction?.message?.accountKeys || [];
  const innerInstructions = tx.meta?.innerInstructions || [];
  
  let method = 'unknown';
  
  for (const innerInstruction of innerInstructions) {
    for (const instruction of innerInstruction.instructions || []) {
      if (instruction.parsed?.type === 'transfer') {
        method = 'transfer';
        break;
      }
    }
    if (method === 'transfer') break;
  }
  const gasFee = tx.meta?.fee ? tx.meta.fee / 1e9 : 'unknown';
  const status = tx.meta?.err ? 'failed' : 'success';
  const timestamp = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'unknown';
  
  return {
    chain: 'solana',
    txHash: hash,
    status,
    method,
    gasFee,
    timestamp,
  };
}