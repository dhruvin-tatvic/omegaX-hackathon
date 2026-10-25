import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

export function findChromePath() {
  return CHROME_CANDIDATES.find((candidate) => existsSync(candidate)) || null;
}

export async function renderWithChrome(url, { timeoutMs = 12000, chromePath } = {}) {
  const bin = chromePath || findChromePath();
  if (!bin) {
    throw new Error('No local Chrome/Chromium binary was found to render the page');
  }
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      '--virtual-time-budget=8000',
      '--dump-dom',
      String(url),
    ];
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out rendering ${url}`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `Chrome exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function renderPage(url, options = {}) {
  if (typeof options.renderImpl === 'function') {
    try {
      const result = await options.renderImpl(url, options);
      if (result && typeof result === 'object' && 'ok' in result) return result;
      return { ok: true, html: String(result || ''), error: null, skipped: false };
    } catch (err) {
      return { ok: false, html: '', error: err.message, skipped: false };
    }
  }
  const chromePath = options.chromePath || findChromePath();
  if (!chromePath) {
    return {
      ok: false,
      html: '',
      error: 'No local Chrome/Chromium was available, so browser-rendered DOM was not captured.',
      skipped: true,
    };
  }
  try {
    const html = await renderWithChrome(url, { timeoutMs: options.timeoutMs, chromePath });
    if (!String(html || '').trim()) {
      return { ok: false, html: '', error: `Rendered DOM for ${url} was empty.`, skipped: false };
    }
    return { ok: true, html, error: null, skipped: false };
  } catch (err) {
    return { ok: false, html: '', error: err.message, skipped: false };
  }
}
