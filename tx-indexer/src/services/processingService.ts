import { databaseService, Message, UpdateData } from './database';
import { chainService } from './chainService';
import { logger } from '../middlewares/logger';

export interface ProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
}

// Simple service to process transaction messages
export class ProcessingService {
  private batchSize = 100; // Process 100 messages at a time
  private maxConcurrent = 5; // Maximum 5 concurrent API calls

  // Process all messages that need fee/action_type data (batch mode for backup)
  async processAllPendingMessages(): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime: new Date(),
    };

    try {
      // Find out how many messages need processing
      const totalMessages = await databaseService.getMessageCount();
      
      if (totalMessages === 0) {
        stats.endTime = new Date();
        return stats;
      }

      logger.info(`Processing ${totalMessages} messages in batches...`);

      // Process messages in batches
      let lastProcessedId: number | undefined;
      while (true) {
        const messages = await databaseService.getMessagesWithMissingData(this.batchSize, lastProcessedId);
        
        if (messages.length === 0) break;

        const batchStats = await this.processBatch(messages);
        
        stats.totalProcessed += batchStats.totalProcessed;
        stats.successful += batchStats.successful;
        stats.failed += batchStats.failed;
        stats.skipped += batchStats.skipped;

        lastProcessedId = parseInt(messages[messages.length - 1].id);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      stats.endTime = new Date();
      return stats;
      
    } catch (error) {
      logger.error('Batch processing failed:', error);
      stats.endTime = new Date();
      throw error;
    }
  }

  // Process a batch of messages
  private async processBatch(messages: Message[]): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      totalProcessed: messages.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime: new Date(),
    };

    const updates: Array<{ id: string; data: UpdateData }> = [];

    // Process messages in small groups to avoid overwhelming APIs
    const chunks = this.splitIntoChunks(messages, this.maxConcurrent);

    for (const chunk of chunks) {
      // Process all messages in this chunk at the same time
      const promises = chunk.map(message => this.processMessage(message));
      const results = await Promise.allSettled(promises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const message = chunk[i];

        if (result.status === 'fulfilled' && result.value) {
          logger.info(`✅ Got update data for message ${message.id}: ${JSON.stringify(result.value)}`);
          updates.push({ id: message.id, data: result.value });
        } else if (result.status === 'rejected') {
          logger.warn(`❌ Failed to process message ${message.id}: ${result.reason}`);
          stats.failed++;
        } else {
          logger.info(`⏭️ Skipping message ${message.id} (no data)`);
          stats.skipped++;
        }
      }
    }

    // Update database with all the collected data
    if (updates.length > 0) {
      logger.info(`📝 Updating ${updates.length} messages in database...`);
      try {
        const updatedCount = await databaseService.batchUpdateMessages(updates);
        logger.info(`✅ Successfully updated ${updatedCount} messages in database`);
        stats.successful = updatedCount;
      } catch (error) {
        logger.error('Database update failed:', error);
        stats.failed += updates.length;
        stats.successful = 0;
      }
    } else {
      logger.info('No messages to update in this batch');
    }

    stats.endTime = new Date();
    return stats;
  }

  // Process a single message and get fee/action_type data
  private async processMessage(message: Message): Promise<UpdateData | null> {
    try {
      const needsFee = !message.fee;
      const needsActionType = !message.action_type || message.action_type === 'SendMsg';

      if (!needsFee && !needsActionType) {
        return null;
      }

      const srcSupported = chainService.isChainSupported(String(message.src_network));
      const destSupported = chainService.isChainSupported(String(message.dest_network));

      if (!srcSupported && !destSupported) {
        return null;
      }

      // Try to get transaction data from the blockchain (convert to string in case DB returns numbers)
      const result = await chainService.fetchTransactionDataWithFallback(
        String(message.src_network),
        String(message.dest_network),
        message.src_tx_hash,
        message.dest_tx_hash,
        message.response_tx_hash,
        message.rollback_tx_hash
      );

      const updateData: UpdateData = {};

      if (needsFee && result.fee) {
        updateData.fee = result.fee;
      }

      if (needsActionType && result.action_type) {
        updateData.action_type = result.action_type;
      }

      return Object.keys(updateData).length > 0 ? updateData : null;
      
    } catch (error) {
      logger.error(`Failed to process message ${message.id}:`, error);
      throw error;
    }
  }

  private splitIntoChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async processSingleMessage(messageId: string): Promise<{ success: boolean; updated: boolean; error?: string }> {
    try {
      const message = await databaseService.getMessageById(messageId);
      if (!message) {
        return { success: false, updated: false, error: 'Message not found' };
      }

      const needsFee = !message.fee;
      const needsActionType = !message.action_type || message.action_type === 'SendMsg';

      if (!needsFee && !needsActionType) {
        return { success: true, updated: false };
      }

      const updateData = await this.processMessage(message);
      if (!updateData) {
        return { success: true, updated: false };
      }

      const updated = await databaseService.updateMessageData(messageId, updateData);
      return { success: true, updated };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, updated: false, error: errorMsg };
    }
  }
}

export const processingService = new ProcessingService();