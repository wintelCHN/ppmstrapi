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

const SEQUENCES = [
  {
    name: 'product_sku_seq',
    sql: 'CREATE SEQUENCE IF NOT EXISTS product_sku_seq START 1',
  },
];

// ── Connection configs ─────────────────────────────────────────────

function getPool() {
  // Explicit proxy mode
  if (process.argv.includes('--proxy')) {
    return new Pool({
      host: 'zephyr.proxy.rlwy.net',
      port: 40028,
      user: 'postgres',
      password: 'krQCYxQUeneMhJpScWGIJbETrqqtiOsg',
      database: 'railway',
      ssl: false,
    });
  }

  // DATABASE_URL env var (Railway runtime)
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  // Local dev (from .env)
  return new Pool({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'b2bcms',
    user: process.env.DATABASE_USERNAME || 'strapi_user',
    password: process.env.DATABASE_PASSWORD || 'strapi_pass',
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
