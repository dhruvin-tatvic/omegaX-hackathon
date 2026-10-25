import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceId = process.argv[2] || process.env.RENDER_SERVICE_ID;

if (!serviceId) {
  console.error('Save Render service logs to docs/evidence/ locally.\n');
  console.error('Usage: node scripts/save-render-logs.mjs <render-service-id>');
  console.error('   or: set RENDER_SERVICE_ID=srv-... && npm run logs:save');
  console.error('\nInstall CLI: npm i -g @render/cli  then  render login');
  process.exit(1);
}

const evidenceDir = path.resolve(__dirname, '../../docs/evidence');
fs.mkdirSync(evidenceDir, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const outFile = path.join(evidenceDir, `render-logs-${date}.txt`);

const child = spawn('render', ['logs', '--resources', serviceId, '--output', 'text'], {
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
});

let body = '';
child.stdout.on('data', chunk => {
  body += chunk;
});

child.on('close', code => {
  if (code !== 0) {
    console.error(`render logs exited with code ${code}`);
    process.exit(code ?? 1);
  }
  fs.writeFileSync(outFile, body, 'utf8');
  console.log(`Saved ${body.length} bytes → ${outFile}`);
});
