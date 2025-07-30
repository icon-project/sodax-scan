import { Client } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../middlewares/logger';

dotenv.config();

// Simple service to listen for database notifications
export class NotificationService {
  private client: Client | null = null;
  private isConnected = false;
  private messageHandler: ((messageId: string) => Promise<void>) | null = null;

  async connect(): Promise<void> {
    this.client = new Client({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT) || 5432,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await this.client.connect();
      
      await this.client.query('LISTEN message_needs_processing');
      
      this.client.on('notification', async (msg) => {
        if (msg.channel === 'message_needs_processing' && msg.payload) {
          await this.handleNotification(msg.payload);
        }
      });

      this.client.on('error', (error) => {
        logger.error('Database connection error:', error);
        this.isConnected = false;
      });

      this.isConnected = true;
      logger.info('✅ Connected to database notifications');
      
    } catch (error) {
      logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  onMessage(handler: (messageId: string) => Promise<void>): void {
    this.messageHandler = handler;
  }

  // Handle a notification from the database
  private async handleNotification(messageId: string): Promise<void> {
    if (this.messageHandler) {
      try {
        await this.messageHandler(messageId);
      } catch (error) {
        logger.error(`Error handling notification for ${messageId}:`, error);
      }
    }
  }

  // Disconnect from the database
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.query('UNLISTEN message_needs_processing');
        await this.client.end();
        this.isConnected = false;
        logger.info('✅ Disconnected from database notifications');
      } catch (error) {
        logger.error('Error disconnecting:', error);
      }
    }
    this.client = null;
  }

  isListening(): boolean {
    return this.isConnected;
  }

  // Send a test notification (for testing)
  async testNotification(): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Not connected to database');
    }

    try {
      await this.client.query("SELECT pg_notify('message_needs_processing', 'test-message-123')");
      logger.info('📤 Test notification sent');
    } catch (error) {
      logger.error('Failed to send test notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();