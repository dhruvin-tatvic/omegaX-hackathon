import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { loadConfig, loadReference } from '../src/config.js';
import { INSUFFICIENT_TITLE, recommendFromResults } from '../src/recommendations/engine.js';
import { createMemoryStore } from '../src/store.js';
import { analyzeSyntheticDemo } from '../src/traffic/analyze.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const conflictReadability = {
  finished_at: '2026-10-24T12:00:00.000Z',
  findings: [
    {
      id: 'conflict-a',
      category: 'conflicting_facts',
      severity: 'high',
      url: 'https://lamps.example/',
      related_urls: ['https://lamps.example/offers'],
      values: [12500, 9999],
      explanation: 'Comparable ex_showroom values for helios differ (12500 vs 9999) across pages.',
      evidence: [
        { url: 'https://lamps.example/', kind: 'conflict', text: 'Ex-showroom price ₹12,500' },
        { url: 'https://lamps.example/offers', kind: 'conflict', text: 'Ex-showroom price ₹9,999' },
      ],
      limitations: ['Typed prices only.'],
    },
    {
      id: 'missing-jsonld',
      category: 'missing_structured_data',
      severity: 'low',
      url: 'https://lamps.example/',
      explanation: 'Product JSON-LD was not found. That is a structured-data gap, not proof the page is unreadable.',
      evidence: [{ url: 'https://lamps.example/', kind: 'jsonld', text: 'No JSON-LD script was found in the raw HTML.' }],
    },
  ],
  session: {
    pages_visited: [
      { url: 'https://lamps.example/', title: 'Helios Lamp' },
      { url: 'https://lamps.example/about', title: 'About' },
    ],
    facts: [
      { url: 'https://lamps.example/', kind: 'heading', text: 'Helios Lamp' },
      { url: 'https://lamps.example/about', kind: 'heading', text: 'About' },
    ],
  },
};

describe('recommendFromResults', () => {
  it('ranks conflicting prices above missing JSON-LD and keeps evidence URLs', () => {
    const report = recommendFromResults({ readability: conflictReadability });
    const fixes = report.items.filter((row) => row.kind === 'fix');
    expect(fixes[0].title).toMatch(/canonical price/i);
    expect(fixes[0].priority_score).toBeGreaterThan(fixes[1].priority_score);
    expect(fixes[0].url).toBe('https://lamps.example/');
    expect(fixes[0].related_urls).toContain('https://lamps.example/offers');
    expect(fixes[0].evidence.some((row) => /12,500/.test(row.text))).toBe(true);
    expect(fixes[0].expected_benefit.kind).toBe('estimate');
    expect(fixes[0].status).toBe('proposed');
    expect(fixes[0].source_test).toBe('readability');
    expect(fixes[0].evidence_timestamp).toBe('2026-10-24T12:00:00.000Z');
    expect(fixes.map((row) => row.id).join(' ')).toMatch(/missing-jsonld/);
  });

  it('returns insufficient evidence when no tests have run', () => {
    const report = recommendFromResults({});
    expect(report.items).toHaveLength(1);
    expect(report.items[0].kind).toBe('insufficient');
    expect(report.items[0].title).toBe(INSUFFICIENT_TITLE);
    expect(report.items[0].recommended_change).toBeNull();
    expect(report.items[0].missing).toMatch(/Run the Readability Test/i);
  });

  it('does not recommend a change when accuracy is correct and a page has no issue', () => {
    const report = recommendFromResults({
      readability: conflictReadability,
      accuracyRuns: [
        {
          id: 'run-ok',
          target_url: 'https://lamps.example/about',
          started_at: '2026-10-24T12:05:00.000Z',
          evaluation: {
            overall_category: 'correct',
            explanation: 'The answer matches website-sourced evidence for the checkable claims.',
            claim_results: [
              {
                fact_id: 'c1',
                status: 'match',
                sources: [{ url: 'https://lamps.example/about', text: 'We sell the Helios Lamp.' }],
              },
            ],
          },
        },
      ],
    });
    const noChange = report.items.filter((row) => row.kind === 'no_change');
    expect(noChange.some((row) => row.url === 'https://lamps.example/about')).toBe(true);
    expect(noChange.some((row) => row.source_test === 'accuracy' && /No website change needed/i.test(row.title))).toBe(
      true
    );
    expect(report.items.some((row) => row.kind === 'fix' && row.url === 'https://lamps.example/about')).toBe(false);
  });

  it('labels synthetic traffic recommendations and does not invent conversions', () => {
    const traffic = analyzeSyntheticDemo();
    const report = recommendFromResults({ traffic });
    const trafficFixes = report.items.filter((row) => row.source_test === 'traffic' && row.kind === 'fix');
    expect(trafficFixes.length).toBeGreaterThan(0);
    expect(trafficFixes.every((row) => row.synthetic)).toBe(true);
    expect(trafficFixes.every((row) => /SYNTHETIC DEMO DATA/.test(row.synthetic_label))).toBe(true);
    expect(trafficFixes.every((row) => /estimate only/i.test(row.expected_benefit.text))).toBe(true);
    expect(JSON.stringify(trafficFixes)).not.toMatch(/conversion lift|measured conversion/i);
  });

  it('does not turn a JS heuristic into a site-change recommendation', () => {
    const report = recommendFromResults({
      readability: {
        finished_at: '2026-10-24T12:00:00.000Z',
        findings: [
          {
            id: 'js-h',
            category: 'js_heuristic',
            severity: 'medium',
            url: 'https://lamps.example/',
            explanation: 'Heuristic shell.',
            evidence: [{ text: 'id=root' }],
          },
        ],
        session: { pages_visited: [{ url: 'https://lamps.example/', title: 'App' }], facts: [] },
      },
    });
    expect(report.items.some((row) => row.kind === 'fix')).toBe(false);
    expect(report.items.some((row) => row.kind === 'insufficient' && row.title === INSUFFICIENT_TITLE)).toBe(true);
  });
});

describe('POST /api/recommendations', () => {
  it('builds ranked items from posted test results', async () => {
    const config = loadConfig({ CHECKER_PACK: 'demo' });
    config.referencePack = loadReference(config);
    const app = createApp({ config, store: createMemoryStore() });
    const { server, url } = await listen(app);
    try {
      const empty = await fetch(`${url}/api/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then((res) => res.json());
      expect(empty.items[0].title).toBe(INSUFFICIENT_TITLE);

      const ok = await fetch(`${url}/api/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readability: conflictReadability }),
      }).then((res) => res.json());
      expect(ok.items[0].kind).toBe('fix');
      expect(ok.items[0].priority_score).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });
});
