import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

export function normalizeHttpUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('A website URL is required');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid http:// or https:// URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }
  if (url.username || url.password) {
    throw new Error('URLs with credentials are not allowed');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) throw new Error('URL host is missing');
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('That host is not allowed');
  }
  if (isBlockedIp(host)) {
    throw new Error('Private or internal network addresses are not allowed');
  }
  url.hash = '';
  return url;
}

export function originKey(input) {
  const url = typeof input === 'string' ? normalizeHttpUrl(input) : input;
  return `${url.protocol}//${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ''}`;
}

export function sameSite(a, b) {
  const ha = stripWww(new URL(a).hostname.toLowerCase());
  const hb = stripWww(new URL(b).hostname.toLowerCase());
  return ha === hb;
}

function stripWww(host) {
  return host.startsWith('www.') ? host.slice(4) : host;
}

export function isBlockedIp(value) {
  if (net.isIP(value) === 4) return isPrivateIPv4(value);
  if (net.isIP(value) === 6) return isPrivateIPv6(value);
  return false;
}

function isPrivateIPv4(ip) {
  const p = ip.split('.').map((n) => Number(n));
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export async function assertPublicHost(url, lookupImpl = dns.lookup) {
  const parsed = url instanceof URL ? url : normalizeHttpUrl(url);
  if (isBlockedIp(parsed.hostname)) {
    throw new Error('Private or internal network addresses are not allowed');
  }
  const results = await lookupImpl(parsed.hostname, { all: true }).catch(() => {
    throw new Error(`Could not resolve host ${parsed.hostname}`);
  });
  const addresses = Array.isArray(results) ? results : [results];
  if (!addresses.length) throw new Error(`Could not resolve host ${parsed.hostname}`);
  for (const row of addresses) {
    const address = row.address || row;
    if (isBlockedIp(address)) {
      throw new Error('Private or internal network addresses are not allowed');
    }
  }
  return parsed;
}

export async function fetchPublic(urlString, {
  fetchImpl = fetch,
  lookupImpl = dns.lookup,
  timeoutMs = 12000,
  maxBodyBytes = 1000000,
  maxRedirects = 3,
  userAgent = 'AIAnswerChecker/0.1',
  headers = {},
} = {}) {
  let current = await assertPublicHost(normalizeHttpUrl(urlString), lookupImpl);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(current.href, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': userAgent,
          ...headers,
        },
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = headerGet(response.headers, 'location');
        if (!location) throw new Error(`Redirect with no Location from ${current.href}`);
        const next = new URL(location, current);
        current = await assertPublicHost(normalizeHttpUrl(next.href), lookupImpl);
        continue;
      }
      const length = Number(headerGet(response.headers, 'content-length') || 0);
      if (length > maxBodyBytes) {
        throw new Error(`Response too large (${length} bytes)`);
      }
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length > maxBodyBytes) {
        throw new Error(`Response too large (${buf.length} bytes)`);
      }
      return {
        url: current.href,
        status: response.status,
        headers: Object.fromEntries(headerEntries(response.headers)),
        body: buf.toString('utf8'),
      };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error(`Timed out fetching ${current.href}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects');
}

function headerGet(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
}

function headerEntries(headers) {
  if (!headers) return [];
  if (typeof headers.entries === 'function') return [...headers.entries()];
  return Object.entries(headers);
}
