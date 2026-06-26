const pg = require('pg');
const pool = new pg.Pool({
  host: '127.0.0.1', port: 5432, database: 'b2bcms',
  user: 'strapi_user', password: 'strapi_pass'
});

async function check() {
  // All roles
  const roles = await pool.query("SELECT id, name, type, description FROM up_roles ORDER BY id");
  console.log('=== ALL Roles ===');
  roles.rows.forEach(r => console.log(`  id=${r.id} name=${r.name} type=${r.type}`));

  // For each role, list ALL permissions
  for (const role of roles.rows) {
    const perms = await pool.query(`
      SELECT p.action FROM up_permissions p
      JOIN up_permissions_role_lnk lnk ON lnk.permission_id = p.id
      WHERE lnk.role_id = $1 ORDER BY p.action
    `, [role.id]);

    const uploadPerms = perms.rows.filter(p => p.action.includes('upload'));
    const productPerms = perms.rows.filter(p => p.action.includes('product'));

    console.log(`\n  Role "${role.name}" (id=${role.id}):`);
    console.log(`    Product perms: ${productPerms.map(p => p.action).join(', ') || '(none)'}`);
    console.log(`    Upload perms:  ${uploadPerms.map(p => p.action).join(', ') || '(none)'}`);
    console.log(`    Total perms:   ${perms.rows.length}`);
  }

  // Check full-access token type permissions
  const fullTokenPerms = await pool.query(`
    SELECT DISTINCT atp.action FROM strapi_api_token_permissions atp
    ORDER BY atp.action
  `);
  const uploadToken = fullTokenPerms.rows.filter(p => p.action.includes('upload'));
  const productToken = fullTokenPerms.rows.filter(p => p.action.includes('product'));
  console.log(`\n=== Full Access Token Upload Perms: ${uploadToken.length} ===`);
  uploadToken.forEach(p => console.log('  ' + p.action));
  console.log(`\n=== Full Access Token Product Perms: ${productToken.length} ===`);
  productToken.forEach(p => console.log('  ' + p.action));

  await pool.end();
}

check().catch(e => { console.error(e.message); pool.end(); });
