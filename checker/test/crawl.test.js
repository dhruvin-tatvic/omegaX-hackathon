import { describe, expect, it } from 'vitest';
import { crawlSite } from '../src/crawl/crawler.js';
import { createCrawlRegistry } from '../src/crawl/registry.js';
import { mockFetch, pagesA, pagesB, publicLookup, SITE_A, SITE_B } from './helpers/mockFetch.js';

describe('crawlSite', () => {
  it('crawls internal links on the selected domain', async () => {
    const session = await crawlSite(`${SITE_A}/`, {
      fetchImpl: mockFetch(pagesA),
      lookupImpl: publicLookup(),
      limits: { delayMs: 0, maxPages: 10 },
    });
    expect(session.origin).toBe(SITE_A);
    expect(session.pages_visited.some((p) => p.url.includes('/about'))).toBe(true);
    expect(session.evidence.some((e) => e.numbers.includes(12500))).toBe(true);
    expect(session.evidence.every((e) => e.url.startsWith(SITE_A))).toBe(true);
    expect(session.label).toBe('website-sourced evidence');
  });

  it('does not mix facts between domains', async () => {
    const registry = createCrawlRegistry();
    const a = await crawlSite(`${SITE_A}/`, {
      fetchImpl: mockFetch(pagesA),
      lookupImpl: publicLookup(),
      limits: { delayMs: 0 },
    });
    const b = await crawlSite(`${SITE_B}/`, {
      fetchImpl: mockFetch(pagesB),
      lookupImpl: publicLookup(),
      limits: { delayMs: 0 },
    });
    registry.save(a);
    registry.save(b);
    expect(registry.get(SITE_A).evidence.some((e) => e.numbers.includes(12500))).toBe(true);
    expect(registry.get(SITE_B).evidence.some((e) => e.numbers.includes(8900))).toBe(true);
    expect(registry.get(SITE_B).evidence.some((e) => e.numbers.includes(12500))).toBe(false);
    expect(registry.get(SITE_A).evidence.some((e) => String(e.text).includes('Nimbus'))).toBe(false);
  });
});
