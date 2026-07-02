/**
 * Ensure PostgreSQL sequences exist on the target database.
 *
 * This script is designed to be run:
 *   - Locally against Railway's TCP proxy
 *   - On Railway as a prestart hook (using DATABASE_URL env var)
 *   - Locally for development database
 *
 * Usage:
 *   node scripts/ensure-sequences.js
 *   node scripts/ensure-sequences.js --proxy    (uses Railway proxy)
 */

const { Pool } = require('pg');
const { loadEnvFile, requireEnv, getDatabaseUrl } = require('./lib/env');

loadEnvFile();

const SEQUENCES = [
  {
    name: 'product_sku_seq',
    sql: 'CREATE SEQUENCE IF NOT EXISTS product_sku_seq START 1',
  },
];

const ALLOWED_SEQUENCE_NAMES = new Set(SEQUENCES.map((seq) => seq.name));

// ── Connection configs ─────────────────────────────────────────────

function getPool() {
  // Explicit proxy mode — local TCP proxy to Railway database.
  if (process.argv.includes('--proxy')) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      throw new Error('DATABASE_URL or RAILWAY_PROXY_URL must be set for --proxy mode');
    }
    return new Pool({ connectionString });
  }

  // Railway runtime.
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  // Local dev.
  return new Pool({
    host: requireEnv('DATABASE_HOST'),
    port: parseInt(requireEnv('DATABASE_PORT'), 10),
    database: requireEnv('DATABASE_NAME'),
    user: requireEnv('DATABASE_USERNAME'),
    password: requireEnv('DATABASE_PASSWORD'),
  });
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const pool = getPool();

  try {
    for (const seq of SEQUENCES) {
      // Check if sequence exists
      const check = await pool.query(
        'SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = $2) AS exists',
        [seq.name, 'S'],
      );

      if (check.rows[0].exists) {
        if (!ALLOWED_SEQUENCE_NAMES.has(seq.name)) {
          throw new Error(`Sequence name "${seq.name}" is not in the allowlist`);
        }
        const val = await pool.query(`SELECT last_value FROM ${seq.name}`);
        console.log(`[OK] Sequence "${seq.name}" EXISTS, last_value = ${val.rows[0].last_value}`);
      } else {
        console.log(`[MISSING] Sequence "${seq.name}" NOT found. Creating...`);
        await pool.query(seq.sql);
        console.log(`[CREATED] Sequence "${seq.name}" created successfully.`);
      }
    }

    console.log('\nAll sequences verified.');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
