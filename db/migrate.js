const fs = require('fs');
const path = require('path');
const { pool } = require('../lib/db');

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
module.exports = { runSchema };

if (require.main === module) {
  runSchema()
    .then(() => console.log('Schema ready'))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
