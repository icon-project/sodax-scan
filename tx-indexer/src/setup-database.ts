import dotenv from 'dotenv';
import { Client } from 'pg';
import { logger } from './middlewares/logger';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function setupDatabase() {
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
    logger.info('Connected to database for setup');

    // Read the SQL setup file
    const sqlPath = path.join(__dirname, '..', 'database', 'setup_triggers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    logger.info('Executing trigger setup SQL...');
    
    // Execute the SQL commands
    await client.query(sql);
    
    logger.info('✅ Database triggers and functions created successfully');

    // Verify the setup
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE event_object_table = 'messages' 
      AND trigger_name LIKE '%notify%'
    `);

    if (triggerCheck.rows.length > 0) {
      logger.info('✅ Triggers verified:');
      triggerCheck.rows.forEach(row => {
        logger.info(`  - ${row.trigger_name} on ${row.event_manipulation}`);
      });
    }

    const functionCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'notify_message_needs_processing'
    `);

    if (functionCheck.rows.length > 0) {
      logger.info('✅ Notification function verified');
    }

    logger.info('🎉 Database setup complete!');
    
  } catch (error) {
    logger.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

logger.info('Setting up PostgreSQL triggers and functions...');
setupDatabase().catch(error => {
  logger.error('Setup script failed:', error);
  process.exit(1);
});