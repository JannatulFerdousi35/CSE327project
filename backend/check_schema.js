const {Pool} = require('pg');
require('dotenv').config({path: __dirname + '/.env'});
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

async function check() {
  try {
    const r = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'issues' ORDER BY ordinal_position"
    );
    console.log('=== issues table columns ===');
    console.log(JSON.stringify(r.rows, null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}
check();
