/**
 * Shared helpers for the project's own PostgreSQL server.
 *
 * PredictDx ships the official PostgreSQL binaries through the `embedded-postgres`
 * package, so no installer, admin rights or Docker are needed. Data lives in
 * backend/.pgdata and survives restarts. To use any other PostgreSQL instead
 * (installed, Docker or cloud), just point DATABASE_URL in backend/.env at it and
 * set USE_EMBEDDED_POSTGRES=false.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
export const BACKEND = resolve(here, '..');

/** Reads backend/.env without extra dependencies (only what we need). */
export function loadEnv() {
  const file = join(BACKEND, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function settings() {
  loadEnv();
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://predictdx:predictdx@localhost:5433/predictdx');
  return {
    enabled: process.env.USE_EMBEDDED_POSTGRES !== 'false',
    user: decodeURIComponent(url.username || 'predictdx'),
    password: decodeURIComponent(url.password || 'predictdx'),
    port: Number(url.port || 5433),
    database: url.pathname.replace(/^\//, '') || 'predictdx',
  };
}

export async function startPostgres({ quiet = false } = {}) {
  const s = settings();
  if (!s.enabled) return null;
  const dataDir = join(BACKEND, '.pgdata');
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: s.user,
    password: s.password,
    port: s.port,
    persistent: true,
    authMethod: 'scram-sha-256',
    // PostgreSQL 18 otherwise starts separate I/O worker processes, which Windows can leave
    // behind holding the port after a stop. Synchronous I/O is plenty for this workload.
    postgresFlags: ['-c', 'io_method=sync'],
    onLog: () => {},
    onError: (e) => !quiet && console.error('[postgres]', String(e).trim()),
  });
  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    console.log('[postgres] creating a new PostgreSQL cluster in backend/.pgdata …');
    await pg.initialise();
  }
  try {
    await pg.start();
  } catch (e) {
    // Another PredictDx terminal may already be running it - that's fine.
    const probe = pg.getPgClient('postgres');
    try {
      await probe.connect();
      await probe.end();
      if (!quiet) console.log(`[postgres] already running on port ${s.port}`);
      return { pg: null, s };
    } catch {
      throw e;
    }
  }
  const client = pg.getPgClient('postgres');
  await client.connect();
  const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [s.database]);
  await client.end();
  if (!found.rowCount) await pg.createDatabase(s.database);
  if (!quiet) console.log(`[postgres] PostgreSQL ready on localhost:${s.port} (database "${s.database}")`);
  return { pg, s };
}
