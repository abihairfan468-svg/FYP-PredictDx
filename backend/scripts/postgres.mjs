/** Runs the project's PostgreSQL server until Ctrl+C.  npm run db:server */
import { startPostgres } from './pg.mjs';

const started = await startPostgres();
if (!started) {
  console.log('[postgres] USE_EMBEDDED_POSTGRES=false - using the external database in DATABASE_URL');
} else if (started.pg) {
  const stop = async () => {
    console.log('\n[postgres] stopping …');
    await started.pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30); // keep the process alive
}
