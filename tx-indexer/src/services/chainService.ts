import { getSuiTxByHash } from '../chains/sui';
import { getSolanaTxByHash } from '../chains/solana';
import { logger } from '../middlewares/logger';

export interface TransactionData {
  chain: string;
  txHash: string;
  status: string;
  method: string;
  gasFee: number | string;
  timestamp: string;
}

export interface ChainFetcher {
  (hash: string): Promise<TransactionData | null>;
}

export class ChainService {
  private chainFetchers: Map<string, ChainFetcher> = new Map();
  
  // Map network IDs to chain names (from mainnet_deployment.json)
  private networkIdToChain: Map<string, string> = new Map([
    ['1', 'solana'],
    ['21', 'sui'],
    ['6', 'avax'],
    ['15', 'near'],
    ['146', 'sonic'],
    ['1768124270', 'icon'],
    ['19', 'injective'],
    ['27', 'stellar'],
    ['1634886504', 'archway'],
    ['10002', 'stacks'],
    ['30', 'base'],
    ['24', 'optimism'],
    ['5', 'polygon'],
    ['23', 'arbitrum'],
    ['4', 'bsc'],
    ['7235938', 'nibiru'],
    ['26745', 'hyperliquid']
  ]);

  constructor() {
    this.registerChain('sui', getSuiTxByHash);
    this.registerChain('solana', getSolanaTxByHash);
  }

  registerChain(chainName: string, fetcher: ChainFetcher): void {
    this.chainFetchers.set(chainName, fetcher);
    logger.info(`Registered chain fetcher for: ${chainName}`);
  }

  getSupportedChains(): string[] {
    return Array.from(this.chainFetchers.keys());
  }

  async fetchTransactionData(networkIdOrName: string, txHash: string): Promise<TransactionData | null> {
    if (!txHash || txHash === 'null' || txHash.length === 0) {
      return null;
    }

    // Convert network ID to chain name if needed
    const chainName = this.getChainName(networkIdOrName);
    if (!chainName) {
      logger.warn(`Unsupported network: ${networkIdOrName}`);
      return null;
    }

    const fetcher = this.chainFetchers.get(chainName);
    if (!fetcher) {
      logger.warn(`No fetcher available for chain: ${chainName}`);
      return null;
    }

    try {
      logger.info(`Fetching transaction data for ${chainName} (${networkIdOrName}):${txHash}`);
      const data = await fetcher(txHash);
      
      if (data) {
        logger.info(`Successfully fetched data for ${chainName}:${txHash} - Fee: ${data.gasFee}, Method: ${data.method}`);
      } else {
        logger.warn(`No data returned for ${chainName}:${txHash}`);
      }
      
      return data;
    } catch (error) {
      logger.error(`Error fetching transaction data for ${chainName}:${txHash}:`, error);
      return null;
    }
  }

  async fetchTransactionDataWithFallback(
    srcNetwork: string,
    destNetwork: string,
    srcTxHash: string,
    destTxHash: string,
    responseTxHash: string,
    rollbackTxHash: string
  ): Promise<{ fee: string | null; action_type: string | null }> {
    const txHashes = [
      { hash: srcTxHash, network: srcNetwork },
      { hash: destTxHash, network: destNetwork },
      { hash: responseTxHash, network: destNetwork },
      { hash: rollbackTxHash, network: srcNetwork }
    ].filter(item => item.hash && item.hash !== 'null' && item.hash.length > 0);

    for (const { hash, network } of txHashes) {
      try {
        const data = await this.fetchTransactionData(network, hash);
        if (data && (data.gasFee !== 'unknown' || data.method !== 'unknown')) {
          return {
            fee: data.gasFee !== 'unknown' ? String(data.gasFee) : null,
            action_type: data.method !== 'unknown' ? data.method : null
          };
        }
      } catch (error) {
        logger.error(`Failed to fetch from ${network}:${hash}:`, error);
        continue;
      }
    }

    logger.warn(`Could not fetch transaction data for any hash in networks: ${srcNetwork}, ${destNetwork}`);
    return { fee: null, action_type: null };
  }

  isChainSupported(networkIdOrName: string): boolean {
    // Check if it's a network ID first, then convert to chain name
    const chainName = this.networkIdToChain.get(networkIdOrName) || networkIdOrName;
    return this.chainFetchers.has(chainName);
  }

  // Convert network ID to chain name (for internal use)
  private getChainName(networkIdOrName: string): string | null {
    return this.networkIdToChain.get(networkIdOrName) || (this.chainFetchers.has(networkIdOrName) ? networkIdOrName : null);
  }
}

export const chainService = new ChainService();