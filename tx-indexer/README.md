# TX-indexer Service

A simple service that automatically finds blockchain transaction fees and action types for messages in the SODAX Scanner database.

## What it does

1. **Initial processing** - When started, processes all existing messages that need updating
2. **Listens for new messages** - Gets notified instantly when new messages are added to the database
3. **Identifies incomplete data** - Finds messages missing fee, action_type, or with default "SendMsg" action_type
4. **Fetches transaction data** - Gets fee and action type information from Sui and Solana blockchains  
5. **Updates the database** - Saves the transaction data back to the database
6. **Backup processing** - Runs every hour to catch any missed messages

## Supported Blockchains

- **Sui** - Gets gas fees and transaction methods
- **Solana** - Gets transaction fees and transfer details

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure database** - Copy `.env.example` to `.env` and add your database credentials

3. **Set up database triggers** (one-time setup)
   ```bash
   npm run setup-database
   ```

4. **Start the service**
   ```bash
   npm start
   ```

## Commands

- `npm start` - Start the service
- `npm run dev` - Start with auto-restart for development  
- `npm run test-notifications` - Test the notification system
- `npm run manual-test` - Process all pending messages once

## How it works

**On startup:**
1. Service processes all existing messages that need updating
2. Starts listening for new message notifications

**When a new message arrives:**
1. Database automatically sends a notification
2. Service receives the notification instantly  
3. Service fetches transaction data from the blockchain
4. Service updates the database with the fee and action type

**Backup system:**
- Every hour, processes any messages that might have been missed
- Ensures no messages are left incomplete

## Adding new blockchains

To add support for a new blockchain, create a file in `src/chains/` and register it in `chainService.ts`. See existing Sui and Solana implementations as examples. 