const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
});

// Quick connection check at startup. Log success/failure but do not crash the process.
pool.query('SELECT NOW()')
  .then(() => {
    console.log('PostgreSQL connected successfully (backend/db/pg.js)');
  })
  .catch((err) => {
    console.error('PostgreSQL connection failed (backend/db/pg.js):', err.message);
  });

module.exports = pool;
