const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});

const email = `backenddebug${Date.now()}@example.com`;
const password = 'TempPass123!';

async function main() {
  const signupRes = await fetch('http://localhost:5000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Backend Debug', email, password, phone: '1234567890' }),
  });
  const signupJson = await signupRes.json();
  console.log('signup_status=' + signupRes.status);
  console.log('signup_success=' + !!signupJson.success);

  const row = await pool.query(
    `SELECT id, email, role, (password_hash IS NULL) AS password_hash_is_null, length(password_hash) AS password_hash_length, left(password_hash, 4) AS password_hash_prefix
     FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id DESC LIMIT 1`,
    [email]
  );
  console.log('db_user_metadata=' + JSON.stringify(row.rows[0] || null));

  const duplicateCount = await pool.query(
    `SELECT COUNT(*)::int AS duplicate_count FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  console.log('duplicate_count=' + duplicateCount.rows[0].duplicate_count);

  const directHash = await require('bcryptjs').hash(password, 12);
  const directCompare = await require('bcryptjs').compare(password, directHash);
  console.log('direct_compare=' + directCompare);

  const dbHash = row.rows[0]?.password_hash;
  const dbCompare = dbHash ? await require('bcryptjs').compare(password, dbHash) : false;
  console.log('db_compare=' + dbCompare);

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  console.log('login_status=' + loginRes.status);
  console.log('login_success=' + !!loginJson.success);
  console.log('login_message=' + (loginJson.message || ''));

  await pool.end();
}

main().catch((error) => {
  console.error('debug_error=' + error.message);
  process.exit(1);
});
