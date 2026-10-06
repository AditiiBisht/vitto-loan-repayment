const { Pool, types } = require('pg');
// BIGINT(20) and NUMERIC(1700) come back as strings by default; DATE(1082) as Date objects.
// Paise values stay below 2^53, so Number is safe. Dates stay as 'YYYY-MM-DD' strings.
types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);
types.setTypeParser(1082, (v) => v);

// Reuse one pool (avoids creating many pools during dev hot reload)
const pool = global.__pgPool || (global.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
module.exports = { pool, withTransaction };
