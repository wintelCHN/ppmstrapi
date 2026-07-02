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
    const roles = await pool.query(
      'SELECT id, name, type, description FROM up_roles ORDER BY id',
    )
    console.log('=== ALL Roles ===')
    for (const role of roles.rows) {
      console.log(`  id=${role.id} name=${role.name} type=${role.type}`)
    }

    for (const role of roles.rows) {
      const perms = await pool.query(
        `
        SELECT p.action
        FROM up_permissions p
        JOIN up_permissions_role_lnk lnk ON lnk.permission_id = p.id
        WHERE lnk.role_id = $1
        ORDER BY p.action
        `,
        [role.id],
      )

      const uploadPerms = perms.rows.filter((p) => p.action.includes('upload'))
      const productPerms = perms.rows.filter((p) => p.action.includes('product'))

      console.log(`\n  Role "${role.name}" (id=${role.id}):`)
      console.log(
        `    Product perms: ${productPerms.map((p) => p.action).join(', ') || '(none)'}`,
      )
      console.log(
        `    Upload perms:  ${uploadPerms.map((p) => p.action).join(', ') || '(none)'}`,
      )
      console.log(`    Total perms:   ${perms.rows.length}`)
    }

    const fullTokenPerms = await pool.query(
      'SELECT DISTINCT action FROM strapi_api_token_permissions ORDER BY action',
    )
    const uploadToken = fullTokenPerms.rows.filter((p) => p.action.includes('upload'))
    const productToken = fullTokenPerms.rows.filter((p) => p.action.includes('product'))

    console.log(`\n=== Full Access Token Upload Perms: ${uploadToken.length} ===`)
    for (const p of uploadToken) {
      console.log('  ' + p.action)
    }
    console.log(`\n=== Full Access Token Product Perms: ${productToken.length} ===`)
    for (const p of productToken) {
      console.log('  ' + p.action)
    }
  } catch (err) {
    console.error('ERROR:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
