-- PostgreSQL trigger to notify when messages need processing
-- This will send notifications when messages are inserted or updated with missing fee/action_type

-- Create or replace the notification function
CREATE OR REPLACE FUNCTION notify_message_needs_processing()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if fee or action_type is missing/default AND we have transaction hashes
    IF (NEW.fee IS NULL OR NEW.action_type IS NULL OR NEW.action_type = 'SendMsg') AND 
       (NEW.src_tx_hash IS NOT NULL OR NEW.dest_tx_hash IS NOT NULL OR 
        NEW.response_tx_hash IS NOT NULL OR NEW.rollback_tx_hash IS NOT NULL) THEN
        
        -- Send notification with message ID
        PERFORM pg_notify('message_needs_processing', NEW.id::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_message_insert_notify ON messages;
DROP TRIGGER IF EXISTS trigger_message_update_notify ON messages;

-- Create trigger for INSERT operations
CREATE TRIGGER trigger_message_insert_notify
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_message_needs_processing();

-- Create trigger for UPDATE operations
CREATE TRIGGER trigger_message_update_notify
    AFTER UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_message_needs_processing();

-- Grant necessary permissions (adjust user as needed)
-- GRANT USAGE ON SCHEMA public TO xcallv3;
-- GRANT SELECT, INSERT, UPDATE ON messages TO xcallv3;