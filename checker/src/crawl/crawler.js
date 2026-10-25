import { extractPage } from './extract.js';
import { detectConflicts } from './facts.js';
import { isPathAllowed, parseSitemapLocs } from './robots.js';
import { fetchPublic, normalizeHttpUrl, originKey, sameSite } from '../security/urlGuard.js';

export { detectConflicts };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyUrl(href, base) {
  const url = new URL(href, base);
  url.hash = '';
  const path = url.pathname.toLowerCase();
  if (/\.pdf$/i.test(path)) return { kind: 'pdf', href: url.href };
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(path)) return { kind: 'image', href: url.href };
  if (/\.(zip|css|js|mp4|woff2?)$/i.test(path)) return { kind: 'skip', href: url.href };
  return { kind: 'html', href: url.href };
}

function normalizePageUrl(href, base) {
  const classified = classifyUrl(href, base);
  if (classified.kind !== 'html') return null;
  return classified.href;
}

export async function crawlSite(startUrl, options = {}) {
  const startedAt = new Date().toISOString();
  const start = normalizeHttpUrl(startUrl);
  const origin = originKey(start);
  const limits = {
    maxPages: 24,
    maxBodyBytes: 1000000,
    timeoutMs: 12000,
    delayMs: 120,
    maxRedirects: 3,
    maxDurationMs: 50000,
    userAgent: 'AIAnswerChecker/0.1',
    ...(options.limits || {}),
  };
  const fetchOpts = {
    fetchImpl: options.fetchImpl,
    lookupImpl: options.lookupImpl,
    timeoutMs: limits.timeoutMs,
    maxBodyBytes: limits.maxBodyBytes,
    maxRedirects: limits.maxRedirects,
    userAgent: limits.userAgent,
  };

  const queue = [start.href];
  const seen = new Set();
  const pages = [];
  const failed = [];
  const evidence = [];
  const robotsBlocked = [];
  const linkedResources = [];
  const seenResources = new Set();
  let robotsText = '';
  let sitemapFound = false;
  const deadline = Date.now() + limits.maxDurationMs;

  const rememberResource = (resource, sourceUrl) => {
    if (!resource?.url || seenResources.has(resource.url)) return;
    seenResources.add(resource.url);
    linkedResources.push({ ...resource, source_url: sourceUrl });
  };

  try {
    const robotsRes = await fetchPublic(new URL('/robots.txt', origin).href, fetchOpts);
    if (robotsRes.status === 200) robotsText = robotsRes.body;
  } catch {
    robotsText = '';
  }

  try {
    const sitemapRes = await fetchPublic(new URL('/sitemap.xml', origin).href, fetchOpts);
    if (sitemapRes.status === 200) {
      sitemapFound = true;
      for (const loc of parseSitemapLocs(sitemapRes.body)) {
        if (sameSite(loc, origin)) queue.push(loc);
      }
    }
  } catch {
    sitemapFound = false;
  }

  while (queue.length && pages.length < limits.maxPages && Date.now() < deadline) {
    const next = queue.shift();
    let href;
    try {
      href = normalizePageUrl(next, origin);
    } catch {
      continue;
    }
    let classified;
    try {
      classified = classifyUrl(next, origin);
    } catch {
      continue;
    }
    if (classified.kind === 'pdf' || classified.kind === 'image') {
      rememberResource({ url: classified.href, kind: classified.kind, context: 'linked from crawl queue' }, start.href);
      continue;
    }
    if (classified.kind !== 'html') continue;
    if (!href || seen.has(href) || !sameSite(href, origin)) continue;
    seen.add(href);
    const path = new URL(href).pathname;
    if (!isPathAllowed(path, robotsText, limits.userAgent)) {
      robotsBlocked.push(href);
      continue;
    }

    try {
      const res = await fetchPublic(href, fetchOpts);
      if (res.status >= 400) {
        failed.push({ url: href, status: res.status, error: `HTTP ${res.status}` });
        continue;
      }
      const extracted = extractPage(res.url, res.body);
      pages.push({
        url: res.url,
        status: res.status,
        title: extracted.title,
        canonical: extracted.canonical,
        jsLikely: extracted.jsLikely,
      });
      extracted.evidence.forEach((item, index) => {
        evidence.push({
          id: `ev-${pages.length}-${index}`,
          origin,
          ...item,
        });
      });
      for (const resource of extracted.linkedResources || []) {
        rememberResource(resource, res.url);
      }
      for (const link of extracted.links) {
        if (sameSite(link, origin)) queue.push(link);
      }
    } catch (err) {
      failed.push({ url: href, status: null, error: err.message });
    }
    if (limits.delayMs) await sleep(limits.delayMs);
  }

  const conflicts = detectConflicts(evidence);
  const jsLikely = pages.filter((p) => p.jsLikely).map((p) => p.url);

  return {
    origin,
    start_url: start.href,
    crawled_at: startedAt,
    finished_at: new Date().toISOString(),
    sitemap_found: sitemapFound,
    robots_found: Boolean(robotsText),
    pages_visited: pages,
    pages_failed: failed,
    robots_blocked: robotsBlocked,
    js_likely_urls: jsLikely,
    evidence,
    conflicts,
    linked_resources: linkedResources,
    truncated: queue.length > 0 || pages.length >= limits.maxPages,
    label: 'website-sourced evidence',
    note: 'Extracted from publicly fetched HTML. This is not independently verified ground truth. JavaScript-only content may be missing.',
  };
}

export function suggestQuestions(session) {
  const suggestions = [];
  const seen = new Set();
  for (const item of session.evidence || []) {
    if (item.kind !== 'heading' && item.kind !== 'title' && item.kind !== 'price') continue;
    const name = item.text.replace(/\s+/g, ' ').trim();
    if (name.length < 4 || name.length > 80) continue;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    if (item.numbers.length) {
      suggestions.push(`What is the listed price related to “${name}”?`);
    } else if (item.kind === 'heading') {
      suggestions.push(`What does the site say about ${name}?`);
    }
    if (suggestions.length >= 8) break;
  }
  if (!suggestions.length && session.start_url) {
    suggestions.push(`What is this website about?`);
  }
  return suggestions;
}
