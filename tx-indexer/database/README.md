# Database Setup

This directory contains SQL scripts for setting up PostgreSQL triggers and notifications for the tx-indexer service.

## Setup Instructions

1. Connect to your PostgreSQL database as a superuser or database owner:
   ```bash
   psql -U xcallv3 -d xcallv3 -h localhost
   ```

2. Run the trigger setup script:
   ```sql
   \i database/setup_triggers.sql
   ```

3. Verify the triggers are created:
   ```sql
   SELECT trigger_name, event_manipulation, event_object_table 
   FROM information_schema.triggers 
   WHERE event_object_table = 'messages';
   ```

## How It Works

- **Trigger Function**: `notify_message_needs_processing()` checks if a message needs processing
- **Conditions**: Only sends notifications for messages with:
  - Missing `fee` OR `action_type` OR `action_type` = 'SendMsg' (default value)
  - At least one non-null transaction hash
- **Notification Channel**: `message_needs_processing`
- **Payload**: Message ID as text

## Testing the Trigger

You can test the trigger manually:

```sql
-- Insert a test message that needs processing
INSERT INTO messages (id, src_network, src_tx_hash, fee, action_type) 
VALUES ('test-123', 'sui', '0xabc123', NULL, NULL);

-- Listen for notifications (in another session)
LISTEN message_needs_processing;
```

## Removing the Triggers

If you need to remove the triggers:

```sql
DROP TRIGGER IF EXISTS trigger_message_insert_notify ON messages;
DROP TRIGGER IF EXISTS trigger_message_update_notify ON messages;
DROP FUNCTION IF EXISTS notify_message_needs_processing();
```