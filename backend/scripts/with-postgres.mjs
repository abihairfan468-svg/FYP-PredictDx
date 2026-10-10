/**
 * Starts PostgreSQL (if it is not already running), runs one command, then stops it again.
 *   node scripts/with-postgres.mjs "npx prisma db push"
 */
import { spawnSync } from 'child_process';
import { BACKEND, startPostgres } from './pg.mjs';

const command = process.argv.slice(2).join(' ');
const started = await startPostgres({ quiet: true });
const r = spawnSync(command, { cwd: BACKEND, stdio: 'inherit', shell: true, env: process.env });
if (started?.pg) await started.pg.stop();
process.exit(r.status ?? 1);
