const { Pool } = require('pg');

// Local
async function checkLocal() {
  const p = new Pool({
    host: '127.0.0.1', port: 5432, database: 'b2bcms',
    user: 'strapi_user', password: 'strapi_pass',
  });
  try {
    const r = await p.query('SELECT last_value FROM product_sku_seq');
    console.log('LOCAL: sequence EXISTS, last_value =', r.rows[0].last_value);
  } catch (e) {
    console.log('LOCAL: sequence NOT found:', e.message);
  }
  await p.end();
}

// Railway
async function checkRailway() {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await p.query('SELECT last_value FROM product_sku_seq');
    console.log('RAILWAY: sequence EXISTS, last_value =', r.rows[0].last_value);
  } catch (e) {
    console.log('RAILWAY: sequence NOT found:', e.message);
  }
  await p.end();
}

(async () => {
  await checkLocal();
  console.log('---');
  await checkRailway();
})();
