import { readFileSync } from 'fs';
import { resolve } from 'path';
import { adminUrl } from './global-setup';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg');

/** Removes the throwaway database this test run created (and only that one). */
export default async function globalTeardown() {
  const name = new URL(readFileSync(resolve(__dirname, '.db-url'), 'utf8').trim()).pathname.slice(1);
  if (!/^predictdx_test_\d+$/.test(name)) return;
  const client = new Client({ connectionString: adminUrl().toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await client.end();
}
