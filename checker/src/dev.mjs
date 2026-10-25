import { spawn } from 'node:child_process';

function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code ?? 0));
  return child;
}

const api = run('node', ['--watch', 'src/api/server.js']);
const web = run('npx', ['vite']);

function shutDown() {
  api.kill();
  web.kill();
  process.exit(0);
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
