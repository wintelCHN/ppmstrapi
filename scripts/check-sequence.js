const { Pool } = require('pg')
const { loadEnvFile, requireEnv, getDatabaseUrl } = require('./lib/env')

loadEnvFile()

async function main() {
  const connectionString = getDatabaseUrl()
  const pool = connectionString
    ? new Pool({ connectionString })
    : new Pool({
        host: requireEnv('DATABASE_HOST'),
        port: parseInt(requireEnv('DATABASE_PORT'), 10),
        database: requireEnv('DATABASE_NAME'),
        user: requireEnv('DATABASE_USERNAME'),
        password: requireEnv('DATABASE_PASSWORD'),
      })

  try {
    const res = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'product_sku_seq' AND relkind = 'S') AS exists",
    )
    console.log('product_sku_seq exists:', res.rows[0].exists)
  } catch (err) {
    console.error('ERROR:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
