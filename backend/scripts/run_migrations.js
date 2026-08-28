#!/usr/bin/env node
/**
 * Simple SQL migration runner for this project.
 * - Reads SQL files from backend/migrations (lexical order)
 * - Creates a `migrations` table to track applied files
 * - Runs each unapplied SQL file inside a transaction and records it as applied
 *
 * Usage:
 *  DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... node backend/scripts/run_migrations.js
 * Or set DATABASE_URL and omit the DB_* vars:
 *  DATABASE_URL=postgres://user:pass@host:port/dbname node backend/scripts/run_migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const migrationsDir = path.join(__dirname, '..', 'migrations');

function getClientConfigFromEnv() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || undefined,
  };
  return cfg;
}

async function main() {
  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  const client = new Client(getClientConfigFromEnv());
  await client.connect();

  try {
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.toLowerCase().endsWith('.sql'))
      .sort();

    for (const file of files) {
      const already = await client.query('SELECT 1 FROM migrations WHERE filename = $1', [file]);
      if (already.rows.length > 0) {
        console.log('Skipping (already applied):', file);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      console.log('Applying migration:', file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        // Execute the SQL file. It may contain multiple statements.
        await client.query(sql);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('Applied:', file);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Failed to apply', file, '\n', err.message || err);
        throw err;
      }
    }

    console.log('All migrations processed.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Migration runner failed:', err.message || err);
  process.exit(1);
});
