import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { loadConfig, loadReference } from '../src/config.js';
import { crawlSite } from '../src/crawl/crawler.js';
import { looksJavaScriptRendered } from '../src/crawl/extract.js';
import { analyzeReadability } from '../src/readability/analyze.js';
import { renderedOnlySnippets } from '../src/readability/text.js';
import { createMemoryStore } from '../src/store.js';
import { mockFetch, publicLookup } from './helpers/mockFetch.js';
import {
  SITE,
  pagesForReadability,
  renderedHeliosHtml,
  sparseShellPage,
} from './helpers/readabilityPages.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function analyzeOpts(pages, renderImpl) {
  return {
    fetchImpl: mockFetch(pages),
    lookupImpl: publicLookup(),
    renderImpl,
    limits: { delayMs: 0, maxPages: 10, timeoutMs: 2000 },
  };
}

describe('renderedOnlySnippets', () => {
  it('returns text present after render but missing from raw HTML', () => {
    const extras = renderedOnlySnippets(
      'Helios Lamp costs 12500.',
      'Helios Lamp costs 12500. Peak power after paint is forty seven brake horsepower on the display panel.'
    );
    expect(extras.join(' ')).toMatch(/Peak power after paint/i);
  });
});

describe('analyzeReadability', () => {
  it('compares raw HTTP HTML with mocked browser-rendered DOM', async () => {
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(sparseShellPage(), async () => ({ ok: true, html: renderedHeliosHtml }))
    );
    const diff = report.findings.find((f) => f.category === 'js_dependent_content');
    expect(diff).toBeTruthy();
    expect(diff.evidence.map((row) => row.text).join(' ')).toMatch(/Peak power after paint/i);
    expect(diff.limitations.join(' ')).toMatch(/does not prove/i);
    expect(report.comparisons[0].rendered_only.join(' ')).toMatch(/Peak power after paint/i);
  });

  it('labels the JavaScript-shell detector as a heuristic', async () => {
    const html = sparseShellPage()[`${SITE}/`].body;
    expect(looksJavaScriptRendered(html, '')).toBe(true);
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(sparseShellPage(), async () => ({ ok: true, html }))
    );
    const heuristic = report.findings.find((f) => f.category === 'js_heuristic');
    expect(heuristic).toBeTruthy();
    expect(heuristic.limitations.join(' ')).toMatch(/Heuristic only/i);
  });

  it('records robots.txt disallow without fetching the blocked path as evidence', async () => {
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(pagesForReadability(), async () => ({ ok: true, html: '<html><body>Helios Lamp</body></html>' }))
    );
    expect(report.session.robots_blocked.some((url) => url.includes('/hidden'))).toBe(true);
    expect(report.session.pages_visited.some((p) => p.url.includes('/hidden'))).toBe(false);
    const finding = report.findings.find((f) => f.category === 'robots_restriction');
    expect(finding.url).toContain('/hidden');
    expect(finding.evidence[0].text).toMatch(/robots/i);
  });

  it('reports HTTP 403 and other fetch errors', async () => {
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(pagesForReadability(), async () => ({ ok: true, html: '<p>ok</p>' }))
    );
    const blocked = report.findings.find((f) => f.category === 'http_error' && f.url.includes('/blocked'));
    expect(blocked).toBeTruthy();
    expect(blocked.evidence[0].text).toMatch(/403/);
    expect(blocked.severity).toBe('high');
  });

  it('flags linked PDF and image resources after inspecting HTTP metadata', async () => {
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(pagesForReadability(), async () => ({ ok: true, html: '<p>Helios Lamp</p>' }))
    );
    const pdf = report.findings.find((f) => f.category === 'linked_pdf');
    const image = report.findings.find((f) => f.category === 'linked_image');
    expect(pdf.evidence[0].text).toMatch(/application\/pdf/i);
    expect(pdf.limitations.join(' ')).toMatch(/does not OCR/i);
    expect(image.evidence[0].text).toMatch(/image\/png/i);
  });

  it('warns when Product JSON-LD is missing without calling the page unreadable', async () => {
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(pagesForReadability(), async () => ({ ok: true, html: '<p>Helios Lamp</p>' }))
    );
    const missing = report.findings.find((f) => f.category === 'missing_structured_data');
    expect(missing).toBeTruthy();
    expect(missing.explanation).toMatch(/not proof the page is unreadable/i);
  });

  it('detects conflicting prices with both URLs and values', async () => {
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(pagesForReadability(), async () => ({ ok: true, html: '<p>Helios Lamp</p>' }))
    );
    const conflict = report.findings.find((f) => f.category === 'conflicting_facts');
    expect(conflict).toBeTruthy();
    expect(conflict.values).toEqual(expect.arrayContaining([12500, 9999]));
    expect(conflict.related_urls.some((url) => url.includes('/offers'))).toBe(true);
    expect(conflict.evidence.length).toBeGreaterThan(1);
  });

  it('records render failures instead of inventing a JS-only conclusion', async () => {
    const report = await analyzeReadability(
      `${SITE}/`,
      analyzeOpts(pagesForReadability(), async () => {
        throw new Error('navigation failed');
      })
    );
    const failed = report.findings.find((f) => f.category === 'render_failed');
    expect(failed).toBeTruthy();
    expect(report.findings.some((f) => f.category === 'js_dependent_content')).toBe(false);
  });
});

describe('POST /api/readability', () => {
  it('returns structured findings and rejects invalid URLs', async () => {
    const config = loadConfig({ CHECKER_PACK: 'demo' });
    config.referencePack = loadReference(config);
    const analyzeFn = (url) =>
      analyzeReadability(url, analyzeOpts(pagesForReadability(), async () => ({ ok: true, html: '<p>Helios</p>' })));
    const app = createApp({
      config,
      store: createMemoryStore(),
      analyzeFn,
    });
    const { server, url } = await listen(app);
    try {
      const bad = await fetch(`${url}/api/readability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'ftp://example.com' }),
      });
      expect(bad.status).toBe(400);

      const ok = await fetch(`${url}/api/readability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${SITE}/` }),
      }).then((res) => res.json());
      expect(ok.findings.length).toBeGreaterThan(0);
      expect(ok.findings[0]).toMatchObject({
        category: expect.any(String),
        severity: expect.any(String),
        url: expect.any(String),
        explanation: expect.any(String),
      });
      expect(ok.findings[0].evidence.length).toBeGreaterThan(0);
      expect(ok.findings[0].limitations.length).toBeGreaterThan(0);
      expect(ok.session.robots_blocked.some((item) => item.includes('/hidden'))).toBe(true);
    } finally {
      server.close();
    }
  });
});

describe('existing crawl isolation still holds', () => {
  it('does not visit a robots-disallowed path', async () => {
    const session = await crawlSite(`${SITE}/`, {
      fetchImpl: mockFetch(pagesForReadability()),
      lookupImpl: publicLookup(),
      limits: { delayMs: 0 },
    });
    expect(session.robots_blocked.some((url) => url.includes('/hidden'))).toBe(true);
    expect(session.pages_failed.some((row) => row.status === 403)).toBe(true);
    expect(session.linked_resources.some((row) => row.kind === 'pdf')).toBe(true);
  });
});
