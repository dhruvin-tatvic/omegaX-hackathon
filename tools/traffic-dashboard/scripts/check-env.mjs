import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  console.error('\nMissing .env file.');
  console.error(`Create: ${envPath}`);
  console.error('Copy from .env.example and set RENDER_API_KEY + RENDER_SERVICE_ID.\n');
  process.exit(1);
}

dotenv.config({ path: envPath });
const key = (process.env.RENDER_API_KEY || '').trim();
const svc = (process.env.RENDER_SERVICE_ID || '').trim();

if (!key || !svc) {
  console.error('\n.env is incomplete. Required:');
  console.error('  RENDER_API_KEY=rnd_...');
  console.error('  RENDER_SERVICE_ID=srv-...  (not usr-...)\n');
  process.exit(1);
}

if (!svc.startsWith('srv-')) {
  console.error('\nRENDER_SERVICE_ID must start with srv- (web service id).\n');
  process.exit(1);
}

console.log(`[check-env] OK — service ${svc}`);
