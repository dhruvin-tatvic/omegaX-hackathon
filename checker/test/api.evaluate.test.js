import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createMemoryStore } from '../src/store.js';
import { createCrawlRegistry } from '../src/crawl/registry.js';
import { crawlSite } from '../src/crawl/crawler.js';
import { mockFetch, pagesA, pagesB, publicLookup, SITE_A, SITE_B } from './helpers/mockFetch.js';
import { loadConfig, loadReference } from '../src/config.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

describe('website evaluate API', () => {
  it('requires a crawl and isolates domains', async () => {
    const config = loadConfig();
    config.referencePack = loadReference(config);
    const registry = createCrawlRegistry();
    const crawlFn = (url) =>
      crawlSite(url, {
        fetchImpl: mockFetch(url.startsWith(SITE_B) ? pagesB : pagesA),
        lookupImpl: publicLookup(),
        limits: { delayMs: 0 },
      });
    const app = createApp({
      config,
      store: createMemoryStore(),
      crawlRegistry: registry,
      crawlFn,
    });
    const { server, url } = await listen(app);
    try {
      const missing = await fetch(`${url}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${SITE_A}/`,
          questionText: 'Price of Helios Lamp?',
          answerText: '₹12,500',
        }),
      });
      expect(missing.status).toBe(400);

      await fetch(`${url}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${SITE_A}/` }),
      });
      const ok = await fetch(`${url}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${SITE_A}/`,
          questionText: 'What is the price of the Helios Lamp?',
          answerText: 'The Helios Lamp costs ₹12,500.',
        }),
      }).then((r) => r.json());
      expect(ok.evaluation.overall_category).toBe('correct');

      await fetch(`${url}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${SITE_B}/` }),
      });
      const other = await fetch(`${url}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${SITE_B}/`,
          questionText: 'What is the price of the Helios Lamp?',
          answerText: 'The Helios Lamp costs ₹12,500.',
        }),
      }).then((r) => r.json());
      expect(other.evaluation.overall_category).not.toBe('correct');
      expect(other.evidence_origin).toBe(SITE_B);
    } finally {
      server.close();
    }
  });
});
