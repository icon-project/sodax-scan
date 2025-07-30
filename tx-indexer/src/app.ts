import cron from 'node-cron';
import dotenv from 'dotenv';
import { processingService } from './services/processingService';
import { chainService } from './services/chainService';
import { databaseService } from './services/database';
import { notificationService } from './services/notificationService';
import { logger } from './middlewares/logger';

dotenv.config();

// Simple service to process blockchain transaction data
class TxInfoService {
  private isShuttingDown = false;
  private processedCount = 0;

  async start(): Promise<void> {
    logger.info('=== Starting TX-Info Service ===');
    logger.info(`Supported chains: ${chainService.getSupportedChains().join(', ')}`);

    // Step 1: Listen for new messages from database
    await this.startDatabaseListener();
    
    // Step 2: Process existing messages and set up hourly backup
    await this.startBackupProcessing();
    
    // Step 3: Handle shutdown gracefully
    this.handleShutdown();

    logger.info('✅ Service started successfully');
    logger.info('📡 Listening for new messages...');
  }

  // Listen for database notifications when new messages arrive
  private async startDatabaseListener(): Promise<void> {
    await notificationService.connect();
    
    // When a new message arrives, process it immediately
    notificationService.onMessage(async (messageId: string) => {
      logger.info(`📥 New message received: ${messageId}`);
      await this.processMessage(messageId);
    });
  }

  // Process a single message
  private async processMessage(messageId: string): Promise<void> {
    try {
      const result = await processingService.processSingleMessage(messageId);
      
      if (result.success && result.updated) {
        this.processedCount++;
        logger.info(`✅ Processed message ${messageId} successfully`);
      } else if (result.error) {
        logger.error(`❌ Failed to process ${messageId}: ${result.error}`);
      }
    } catch (error) {
      logger.error(`💥 Error processing ${messageId}:`, error);
    }
  }

  // Backup processing runs every hour to catch any missed messages
  private async startBackupProcessing(): Promise<void> {
    // Run immediately on startup to process any existing messages
    logger.info('🚀 Running initial processing for existing messages...');
    
    try {
      const stats = await processingService.processAllPendingMessages();
      
      if (stats.totalProcessed > 0) {
        logger.info(`✅ Initial processing completed: ${stats.successful} updated, ${stats.skipped} skipped`);
      } else {
        logger.info('✅ No messages needed processing');
      }
    } catch (error) {
      logger.error('❌ Initial processing failed:', error);
    }

    // Schedule hourly backup processing
    const hourly = '0 * * * *'; // Every hour at minute 0
    
    cron.schedule(hourly, async () => {
      if (this.isShuttingDown) return;
      
      logger.info('🔄 Running backup processing...');
      
      try {
        const stats = await processingService.processAllPendingMessages();
        
        if (stats.successful > 0) {
          logger.warn(`⚠️ Backup found ${stats.successful} missed messages`);
        } else {
          logger.info('✅ No missed messages found');
        }
      } catch (error) {
        logger.error('❌ Backup processing failed:', error);
      }
    });

    logger.info('⏰ Backup processing scheduled (every hour)');
  }

  // Handle shutdown gracefully
  private handleShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`🛑 Shutting down (${signal})...`);
      this.isShuttingDown = true;

      // Close connections
      await notificationService.disconnect();
      await databaseService.close();

      logger.info(`✅ Shutdown complete. Processed ${this.processedCount} messages`);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

// Start the service
const service = new TxInfoService();
service.start().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});