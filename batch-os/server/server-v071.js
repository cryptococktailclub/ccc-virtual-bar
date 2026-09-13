import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) throw new Error('DATABASE_URL is required for Batch OS persistence.');

// Bootstrap the core account/persistence schema before the v0.7 access gateway
// creates entitlement and trial-usage tables that reference batch_users.
const schemaUrl = new URL('./schema.sql', import.meta.url);
const schema = await readFile(schemaUrl, 'utf8');
const bootstrapPool = new Pool({ connectionString: DATABASE_URL, max: 1 });
try {
  await bootstrapPool.query(schema);
  console.log('Batch OS core schema bootstrap complete.');
} finally {
  await bootstrapPool.end();
}

await import('./server-v07.js');
