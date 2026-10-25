import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

function start(name, cwd, args) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    console.error(`[${name}] exited with code ${code}`);
  });
  return child;
}

const trafficDir = path.join(root, 'tools/traffic-dashboard');
const compareDir = path.join(root, 'tools/comparison-dashboard');
const analyticsDir = path.join(root, 'tools/analytics');

if (!(await isListening(3456))) {
  const envFile = path.join(trafficDir, '.env');
  const args = fs.existsSync(envFile) ? ['--env-file=.env', 'server.js'] : ['server.js'];
  console.log('Starting Traffic Lens on :3456');
  start('traffic', trafficDir, args);
} else {
  console.log('Traffic Lens already running on :3456');
}

if (!(await isListening(3457))) {
  console.log('Starting LLM Comparison on :3457');
  start('comparison', compareDir, ['server.js']);
} else {
  console.log('LLM Comparison already running on :3457');
}

if (!(await isListening(3460))) {
  console.log('Starting Tatvic Analytics on :3460');
  start('analytics', analyticsDir, ['server.js']);
} else {
  console.log('Tatvic Analytics already running on :3460');
}

console.log('Open http://localhost:3460');
