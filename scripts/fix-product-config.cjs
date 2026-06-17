const { execSync } = require('child_process');
const env = { ...process.env, PGPASSWORD: 'strapi_pass' };
const psql = '"D:/Program Files/PostgreSQL/18/bin/psql" -h 127.0.0.1 -p 5432 -U strapi_user -d b2bcms';
const KEY = 'plugin_content_manager_configuration_content_types::api::product.product';
const HIDDEN = ['sku', 'status'];

const raw = execSync(
  `${psql} -t -A -c "SELECT value FROM strapi_core_store_settings WHERE key = '${KEY}';"`,
  { env }
).toString().trim();

if (!raw) { console.log('No config found'); process.exit(0); }

const config = JSON.parse(raw);
let changed = false;

HIDDEN.forEach(f => {
  const m = config.metadatas?.[f];
  if (m) {
    if (m.edit?.visible !== false) { m.edit.visible = false; changed = true; }
    if (m.list?.searchable !== false) { m.list.searchable = false; changed = true; }
    if (m.list?.sortable !== false) { m.list.sortable = false; changed = true; }
  }
});

const editsBefore = JSON.stringify(config.layouts.edit);
config.layouts.edit = config.layouts.edit
  .map(row => row.filter(col => !HIDDEN.includes(col.name)))
  .filter(row => row.length > 0);
if (JSON.stringify(config.layouts.edit) !== editsBefore) changed = true;

const listBefore = JSON.stringify(config.layouts.list);
config.layouts.list = config.layouts.list.filter(col => !HIDDEN.includes(col));
if (JSON.stringify(config.layouts.list) !== listBefore) changed = true;

if (changed) {
  const newVal = JSON.stringify(config).replace(/'/g, "''");
  execSync(
    `${psql} -c "UPDATE strapi_core_store_settings SET value = '${newVal}' WHERE key = '${KEY}';"`,
    { env }
  );
  console.log('OK — sku, status hidden');
} else {
  console.log('Already correct');
}
