import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg');

/** Admin connection to the running PostgreSQL server, taken from backend/.env. */
export function adminUrl() {
  const env = require('fs').readFileSync(resolve(__dirname, '..', '.env'), 'utf8');
  const url = new URL(env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)[1]);
  url.pathname = '/postgres';
  url.search = '';
  return url;
}

/**
 * Every test run gets its own brand-new PostgreSQL database (predictdx_test_<timestamp>),
 * pushed from the schema and seeded with the demo data. The demo database is never touched.
 */
export default async function globalSetup() {
  const cwd = resolve(__dirname, '..');
  const admin = adminUrl();
  const name = `predictdx_test_${Date.now()}`;
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  await client.query(`CREATE DATABASE ${name}`);
  await client.end();

  const url = new URL(admin.toString());
  url.pathname = `/${name}`;
  url.search = '?schema=public';
  writeFileSync(resolve(__dirname, '.db-url'), url.toString());
  const env = { ...process.env, DATABASE_URL: url.toString() };
  execSync('npx prisma db push --skip-generate', { cwd, env, stdio: 'ignore' });
  execSync('npx ts-node prisma/seed.ts', { cwd, env, stdio: 'ignore' });
}
