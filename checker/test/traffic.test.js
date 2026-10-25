import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { loadConfig, loadReference } from '../src/config.js';
import { createMemoryStore } from '../src/store.js';
import { SYNTHETIC_LOG_PATH } from '../src/traffic/analyze.js';
import { classifyAgent } from '../src/traffic/classify.js';
import { importGa4Export } from '../src/traffic/ga4.js';
import { parseAccessLog } from '../src/traffic/parse.js';
import { buildTrafficReport } from '../src/traffic/report.js';
import { CLASSIFICATION_COLUMNS, classificationCells } from '../src/traffic/table.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function req(ip, ua, path, extra = {}) {
  return {
    ip,
    user_agent: ua,
    path,
    status: extra.status ?? 200,
    ts: extra.ts || null,
    referer: extra.referer || null,
    method: 'GET',
  };
}

const GPT_UA = 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)';
const LOOKALIKE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 GPTBotHelper/1.0';
const UNKNOWN_UA = 'SiteAtlas/0.4 (+https://research.invalid/atlas)';

describe('parseAccessLog', () => {
  it('rejects malformed log rows and keeps valid ones', () => {
    const text = [
      '{"record_type":"meta","synthetic":true,"label":"SYNTHETIC DEMO DATA"}',
      '{"ts":"2026-10-24T12:00:00Z","ip":"203.0.113.10","path":"/","status":200,"user_agent":"GPTBot"}',
      'not-json',
      '{"ip":"203.0.113.10","status":200,"user_agent":"GPTBot"}',
      '{"path":"/x","status":"ok","user_agent":"x"}',
    ].join('\n');
    const parsed = parseAccessLog(text, { format: 'jsonl' });
    expect(parsed.row_count).toBe(1);
    expect(parsed.rejected.length).toBe(3);
    expect(parsed.synthetic).toBe(true);
    expect(parsed.rejected.map((row) => row.error).join(' ')).toMatch(/Malformed JSON|Missing path|status/i);
  });

  it('parses CSV access logs', () => {
    const text = [
      'ts,ip,method,path,status,bytes,user_agent,referer',
      '2026-10-24T12:00:00Z,203.0.113.10,GET,/,200,100,"Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",',
    ].join('\n');
    const parsed = parseAccessLog(text, { format: 'csv' });
    expect(parsed.row_count).toBe(1);
    expect(parsed.rows[0].status).toBe(200);
    expect(parsed.rows[0].path).toBe('/');
  });
});

describe('classifyAgent', () => {
  it('classifies a known AI crawler only when behavior is also crawler-like', () => {
    const burst = [
      req('203.0.113.10', GPT_UA, '/robots.txt', { ts: '2026-10-24T12:00:00Z' }),
      req('203.0.113.10', GPT_UA, '/', { ts: '2026-10-24T12:00:01Z' }),
      req('203.0.113.10', GPT_UA, '/motorcycles', { ts: '2026-10-24T12:00:02Z' }),
      req('203.0.113.10', GPT_UA, '/a', { ts: '2026-10-24T12:00:03Z' }),
      req('203.0.113.10', GPT_UA, '/b', { ts: '2026-10-24T12:00:04Z' }),
    ];
    const classified = classifyAgent(burst);
    expect(classified.label).toBe('known_ai_crawler');
    expect(classified.confidence).toBe('high');
    expect(classified.evidence.some((row) => row.layer === 'user_agent')).toBe(true);
    expect(classified.evidence.some((row) => row.layer === 'behavior')).toBe(true);
    expect(classified.visit_does_not_imply_citation).toBe(true);

    const uaOnly = classifyAgent([req('203.0.113.10', GPT_UA, '/', { ts: '2026-10-24T12:00:00Z' })]);
    expect(uaOnly.label).toBe('needs_review');
  });

  it('flags an unknown behaviorally suspicious crawler', () => {
    const rows = ['/robots.txt', '/sitemap.xml', '/', '/a', '/b', '/c', '/c', '/c'].map((path, i) =>
      req('198.51.100.77', UNKNOWN_UA, path, { ts: `2026-10-24T12:01:0${i}Z` })
    );
    const classified = classifyAgent(rows);
    expect(classified.label).toBe('unknown_suspicious_crawler');
    expect(classified.ua_match.kind).toBe('unlisted');
  });

  it('does not treat a lookalike browser user-agent as AI', () => {
    const classified = classifyAgent([
      req('192.0.2.40', LOOKALIKE_UA, '/', {
        ts: '2026-10-24T12:05:00Z',
        referer: 'https://www.google.com/search?q=bike',
      }),
      req('192.0.2.40', LOOKALIKE_UA, '/motorcycles/nightfall-350', {
        ts: '2026-10-24T12:05:40Z',
        referer: 'https://www.google.com/',
      }),
    ]);
    expect(classified.label).toBe('lookalike_not_ai');
    expect(classified.ua_match.lookalike).toBe(true);
  });
});

describe('buildTrafficReport', () => {
  it('reports status-code breakdown and keeps synthetic logs separate from GA4', () => {
    const fixture = fs.readFileSync(SYNTHETIC_LOG_PATH, 'utf8');
    const ga4 = importGa4Export({
      synthetic: true,
      label: 'fake referrals',
      records: [{ source: 'chatgpt.com', sessions: 99, conversions: 4, landing_page: '/' }],
    });
    const report = buildTrafficReport({ text: fixture, format: 'jsonl', synthetic: true, ga4 });
    expect(report.source.synthetic).toBe(true);
    expect(report.source.label).toMatch(/SYNTHETIC DEMO DATA/);
    expect(report.observed.status_codes['200']).toBeGreaterThan(0);
    expect(report.observed.status_codes['403']).toBeGreaterThan(0);
    expect(report.observed.status_codes['404']).toBeGreaterThan(0);
    expect(report.observed.status_codes['500']).toBeGreaterThan(0);
    expect(report.observed.request_count).toBe(report.source.row_count);
    expect(report.observed.request_count).not.toBe(99);
    expect(report.ga4.status).toBe('demo_data');
    expect(report.ga4.synthetic).toBe(true);
    expect(report.ga4.label).toMatch(/SYNTHETIC DEMO DATA/);
    expect(report.data_classes.logs).toBe('synthetic');
    expect(report.data_classes.ga4).toBe('synthetic');
    expect(report.inferences.agents.some((row) => row.label === 'known_ai_crawler')).toBe(true);
    expect(report.inferences.agents.some((row) => row.label === 'unknown_suspicious_crawler')).toBe(true);
    expect(report.inferences.agents.some((row) => row.label === 'lookalike_not_ai')).toBe(true);
  });
});

describe('POST /api/traffic', () => {
  it('loads the labelled synthetic demo and keeps GA4 disconnected by default', async () => {
    const config = loadConfig({ CHECKER_PACK: 'demo' });
    config.referencePack = loadReference(config);
    const app = createApp({ config, store: createMemoryStore() });
    const { server, url } = await listen(app);
    try {
      const disconnected = await fetch(`${url}/api/traffic/ga4`).then((res) => res.json());
      expect(disconnected.status).toBe('not_connected');
      expect(disconnected.connected).toBe(false);

      const demo = await fetch(`${url}/api/traffic/demo`).then((res) => res.json());
      expect(demo.source.synthetic).toBe(true);
      expect(demo.source.label).toMatch(/SYNTHETIC DEMO DATA/);
      expect(demo.ga4.status).toBe('not_connected');
      expect(demo.observed.request_count).toBeGreaterThan(0);

      const empty = await fetch(`${url}/api/traffic/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' }),
      });
      expect(empty.status).toBe(400);
    } finally {
      server.close();
    }
  });
});

describe('classification table rows', () => {
  it('emits one cell per heading in the UI column order', () => {
    expect(CLASSIFICATION_COLUMNS).toEqual([
      'Classification',
      'Client IP',
      'User-Agent',
      'Confidence',
      'Evidence',
      'Requests',
      'Distinct URLs',
    ]);
    const cells = classificationCells({
      label: 'known_ai_crawler',
      client_ip: '203.0.113.10',
      user_agent: 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      confidence: 'high',
      evidence: [
        { layer: 'user_agent', signal: 'user_agent_family', detail: 'Matches GPTBot' },
        { layer: 'behavior', signal: 'burst', detail: '9 requests in 8s' },
      ],
      behavior: { request_count: 9, distinct_urls: 8 },
    });
    expect(cells).toHaveLength(CLASSIFICATION_COLUMNS.length);
    expect(cells[0]).toBe('known_ai_crawler');
    expect(cells[1]).toBe('203.0.113.10');
    expect(cells[2]).toMatch(/GPTBot/);
    expect(cells[3]).toBe('high');
    expect(cells[4]).toBe('user_agent: Matches GPTBot; behavior: 9 requests in 8s');
    expect(cells[5]).toBe(9);
    expect(cells[6]).toBe(8);
  });
});
