// Starts the PredictDx AI service (FastAPI + TensorFlow) on port 8000 as part of `npm run dev`.
// Python is looked up in: $AI_PYTHON, ai-service/.venv, then D:\PredictDx-AI\venv (where it was set up).
// It shares AI_INTERNAL_KEY with the backend through backend/.env.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.AI_PYTHON,
  join(here, '.venv', 'Scripts', 'python.exe'),
  join(here, '.venv', 'bin', 'python'),
  'D:\\PredictDx-AI\\venv\\Scripts\\python.exe',
].filter(Boolean);
const python = candidates.find((p) => existsSync(p));

const model = join(here, 'models', 'predictdx_densenet121_v1.keras');
if (!python || !existsSync(model)) {
  console.log(!python
    ? '[ai] Python environment for the AI service not found. See ai-service/README.md. The rest of PredictDx keeps running.'
    : '[ai] Model file ai-service/models/predictdx_densenet121_v1.keras is missing. The rest of PredictDx keeps running.');
  setInterval(() => {}, 1 << 30); // stay alive so `concurrently` does not stop the other servers
} else {
  const env = { ...process.env, TF_CPP_MIN_LOG_LEVEL: '2', PYTHONUNBUFFERED: '1' };
  const backendEnv = resolve(here, '..', 'backend', '.env');
  if (existsSync(backendEnv)) {
    const key = readFileSync(backendEnv, 'utf8').match(/^AI_INTERNAL_KEY="?([^"\r\n]*)"?/m)?.[1];
    if (key) env.INTERNAL_API_KEY = key;
  }
  console.log('[ai] loading the DenseNet-121 model (about 20 s)...');
  const child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd: here, env, stdio: 'inherit' });
  const stop = () => child.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => process.exit(code ?? 0));
}
