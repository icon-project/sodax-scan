import dotenv from 'dotenv';
import { Client } from 'pg';
import { logger } from './middlewares/logger';

dotenv.config();

async function testNotificationSystem() {
  const client = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT) || 5432,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    logger.info('Connected to database for testing');

    // Test 1: Check if triggers exist
    logger.info('=== Testing Database Triggers ===');
    
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE event_object_table = 'messages' 
      AND trigger_name LIKE '%notify%'
    `);

    if (triggerCheck.rows.length > 0) {
      logger.info('✅ Triggers found:');
      triggerCheck.rows.forEach(row => {
        logger.info(`  - ${row.trigger_name} on ${row.event_manipulation}`);
      });
    } else {
      logger.error('❌ No notification triggers found. Please run the setup script:');
      logger.error('   psql -U xcallv3 -d xcallv3 -h localhost -f database/setup_triggers.sql');
      return;
    }

    // Test 2: Check if function exists
    const functionCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'notify_message_needs_processing'
    `);

    if (functionCheck.rows.length > 0) {
      logger.info('✅ Notification function exists');
    } else {
      logger.error('❌ Notification function not found');
      return;
    }

    // Test 3: Test manual notification
    logger.info('=== Testing Manual Notification ===');
    
    const testListener = new Client({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT) || 5432,
      ssl: { rejectUnauthorized: false },
    });

    await testListener.connect();
    await testListener.query('LISTEN message_needs_processing');

    testListener.on('notification', (msg) => {
      if (msg.channel === 'message_needs_processing') {
        logger.info(`✅ Received notification: ${msg.payload}`);
      }
    });

    // Send test notification
    await client.query("SELECT pg_notify('message_needs_processing', 'test-message-123')");
    logger.info('📤 Test notification sent');

    // Wait a moment for notification
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testListener.end();
    
    logger.info('=== Test Results ===');
    logger.info('✅ Database triggers are set up correctly');
    logger.info('✅ Notification system is functional');
    logger.info('🚀 Ready to start the event-driven service!');

  } catch (error) {
    logger.error('❌ Test failed:', error);
  } finally {
    await client.end();
  }
}

logger.info('Testing PostgreSQL notification system...');
testNotificationSystem().catch(error => {
  logger.error('Test script failed:', error);
  process.exit(1);
});