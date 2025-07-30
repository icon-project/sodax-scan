import dotenv from 'dotenv';
import { processingService } from './services/processingService';
import { chainService } from './services/chainService';
import { databaseService } from './services/database';
import { logger } from './middlewares/logger';

dotenv.config();

async function manualRun() {
  try {
    logger.info('=== Manual Processing Run ===');
    logger.info(`Supported chains: ${chainService.getSupportedChains().join(', ')}`);
    
    const messageCount = await databaseService.getMessageCount();
    logger.info(`Found ${messageCount} messages with missing fee/action_type data`);
    
    if (messageCount === 0) {
      logger.info('No messages to process');
      return;
    }

    // Run the processing
    const stats = await processingService.processAllPendingMessages();
    
    logger.info('=== Processing Complete ===');
    logger.info(`Total processed: ${stats.totalProcessed}`);
    logger.info(`Successful: ${stats.successful}`);
    logger.info(`Failed: ${stats.failed}`);
    logger.info(`Skipped: ${stats.skipped}`);
    
    const duration = stats.endTime && stats.startTime ? 
      stats.endTime.getTime() - stats.startTime.getTime() : 0;
    logger.info(`Duration: ${duration}ms`);
    
  } catch (error) {
    logger.error('Manual run failed:', error);
  } finally {
    await databaseService.close();
    process.exit(0);
  }
}

// Handle command line arguments for testing specific features
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
Usage: npm run manual-test [options]

Options:
  --help          Show this help message
  --dry-run       Show what would be processed without updating database
  --limit N       Limit processing to N messages (default: all)
  --chain NAME    Only process messages from specific chain
  
Examples:
  npm run manual-test
  npm run manual-test -- --limit 10
  npm run manual-test -- --chain sui
  `);
  process.exit(0);
}

// TODO: Implement additional command line options as needed

logger.info('Starting manual processing run...');
manualRun();