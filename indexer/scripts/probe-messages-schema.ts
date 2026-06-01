/**
 * Read-only pre-check for the hub-events → messages unification.
 *
 * Answers the four blockers we need to know before writing the migration:
 *   1. Is messages.sn nullable? Are the other columns hub-poller-will-write
 *      compatible types?
 *   2. Does our DB role have INSERT on messages?
 *   3. Does our DB role have USAGE+SELECT on messages_id_seq (or whichever
 *      sequence backs the id column)?
 *   4. Are there CHECK constraints on `status` (or any other column) that
 *      would reject 'executed' / 'rollbacked' values?
 *
 * Strictly read-only: only information_schema and pg_catalog queries; no
 * INSERT, UPDATE, DELETE, or DDL. Safe to run against prod.
 *
 * Usage:
 *   bun run scripts/probe-messages-schema.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

async function main(): Promise<void> {
  const dbUser = process.env.DB_USER!;
  console.log(`Probing as role: ${dbUser}\n`);

  // 1. Column types + nullability for the columns we plan to write
  console.log('=== messages columns we plan to write ===');
  const cols = await pool.query(
    `
    SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'messages'
       AND column_name IN (
         'id', 'sn', 'status', 'src_network', 'src_block_number',
         'src_block_timestamp', 'src_tx_hash', 'src_app', 'dest_network',
         'dest_app', 'action_type', 'action_detail', 'intent_tx_hash',
         'slippage', 'created_at', 'updated_at'
       )
     ORDER BY ordinal_position
    `,
  );
  for (const r of cols.rows) {
    console.log(
      `  ${r.column_name.padEnd(24)} ${r.data_type.padEnd(20)} nullable=${r.is_nullable.padEnd(3)} default=${r.column_default ?? '∅'}`,
    );
  }

  // 2. INSERT privilege on messages
  console.log('\n=== INSERT privilege on messages ===');
  const ins = await pool.query(`SELECT has_table_privilege($1, 'messages', 'INSERT') AS allowed`, [dbUser]);
  console.log(`  has_table_privilege('${dbUser}', 'messages', 'INSERT') = ${ins.rows[0].allowed}`);

  // 3. Sequence privileges — first discover the sequence name from the id column default
  console.log('\n=== sequence backing messages.id ===');
  const seqLookup = await pool.query(
    `
    SELECT pg_get_serial_sequence(quote_ident(current_schema()) || '.messages', 'id') AS seq
    `,
  );
  const seqName: string | null = seqLookup.rows[0].seq;
  console.log(`  pg_get_serial_sequence → ${seqName ?? '∅ (no sequence — maybe identity? or no default)'}`);

  if (seqName) {
    const seqPriv = await pool.query(
      `
      SELECT has_sequence_privilege($1, $2, 'USAGE') AS usage_ok,
             has_sequence_privilege($1, $2, 'SELECT') AS select_ok,
             has_sequence_privilege($1, $2, 'UPDATE') AS update_ok
      `,
      [dbUser, seqName],
    );
    const r = seqPriv.rows[0];
    console.log(`  USAGE=${r.usage_ok}  SELECT=${r.select_ok}  UPDATE=${r.update_ok}`);
  } else {
    // Maybe it's an IDENTITY column
    const ident = await pool.query(
      `
      SELECT is_identity, identity_generation
        FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'messages'
         AND column_name = 'id'
      `,
    );
    if (ident.rows.length > 0) {
      console.log(`  id column is_identity=${ident.rows[0].is_identity} generation=${ident.rows[0].identity_generation}`);
    }
  }

  // 4. CHECK constraints on messages
  console.log('\n=== CHECK constraints on messages ===');
  const checks = await pool.query(
    `
    SELECT con.conname AS name, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE rel.relname = 'messages'
       AND nsp.nspname = current_schema()
       AND con.contype = 'c'
    `,
  );
  if (checks.rows.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of checks.rows) {
      console.log(`  ${r.name}: ${r.def}`);
    }
  }

  // 5. Bonus: list all UNIQUE constraints / indexes on messages so we don't
  //    miss a constraint that would block our inserts.
  console.log('\n=== UNIQUE constraints and indexes on messages ===');
  const idx = await pool.query(
    `
    SELECT i.relname AS index_name,
           idx.indisunique AS is_unique,
           pg_get_indexdef(idx.indexrelid) AS def
      FROM pg_index idx
      JOIN pg_class i ON i.oid = idx.indexrelid
      JOIN pg_class t ON t.oid = idx.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE t.relname = 'messages'
       AND n.nspname = current_schema()
     ORDER BY i.relname
    `,
  );
  for (const r of idx.rows) {
    const tag = r.is_unique ? '[UNIQUE]' : '         ';
    console.log(`  ${tag} ${r.def}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
