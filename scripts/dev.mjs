import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = new Set();
let shuttingDown = false;

function stop(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exitCode = exitCode;
}

function run(args, name, env = process.env) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env });
  children.add(child);
  child.on('exit', (code) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`${name} finalizou (${code ?? 'sinal'}).`);
      stop(code || 1);
    }
  });
  child.on('error', (error) => {
    console.error(`Não foi possível iniciar ${name}: ${error.message}`);
    stop(1);
  });
}

run(['--env-file-if-exists=.env.local', 'server/index.mjs'], 'API', { ...process.env, NUTRI_DEV: '1' });
run(['node_modules/vite/bin/vite.js'], 'Vite');
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
