import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createApplyDemo } from '../src/apply/workflow.js';
import { compareSnapshots } from '../src/apply/compare.js';
import { writeWorking } from '../src/apply/workspace.js';
import { loadConfig, loadReference, rootDir } from '../src/config.js';
import { createMemoryStore } from '../src/store.js';
import { crawlSite } from '../src/crawl/crawler.js';
import { mockFetch, pagesA, publicLookup, SITE_A } from './helpers/mockFetch.js';

const apex = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/reference/apex.json'), 'utf8'));
const originalsSrc = path.join(rootDir, 'data/apply-demo/originals');

function tempSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-demo-'));
  const originalsDir = path.join(dir, 'originals');
  fs.cpSync(originalsSrc, originalsDir, { recursive: true });
  return {
    originalsDir,
    workingDir: path.join(dir, 'working'),
    changelogPath: path.join(dir, 'changelog.jsonl'),
  };
}

function workflow() {
  return createApplyDemo({
    referencePack: apex,
    paths: tempSandbox(),
    clock: () => '2026-10-24T20:00:00.000Z',
  });
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('apply-demo workflow', () => {
  it('applies JSON-LD, retests as improved, and rolls back to the exact prior file', () => {
    const demo = workflow();
    const listed = demo.list();
    expect(listed.label).toBe('LOCAL DEMO FIXTURE');
    expect(listed.live_site_untouched).toBe(true);
    const jsonld = listed.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650');
    expect(jsonld.status).toBe('proposed');
    expect(jsonld.current_snapshot.finding_present).toBe(true);
    expect(jsonld.synthetic_label).toBe('LOCAL DEMO FIXTURE');

    const applied = demo.apply('demo-jsonld-thunderstrike-650');
    const afterApply = applied.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650');
    expect(afterApply.status).toBe('applied');
    expect(applied.last_entry.before).toContain('LOCAL-DEMO-FIX:jsonld:slot');
    expect(applied.last_entry.after).toContain('"@type":"Product"');
    expect(applied.last_entry.after).toContain('420000');
    expect(applied.last_entry.after).toContain('Thunderstrike 650');

    const retested = demo.retest('demo-jsonld-thunderstrike-650');
    const afterTest = retested.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650');
    expect(afterTest.status).toBe('verified_improved');
    expect(afterTest.last_comparison.improved).toBe(true);
    expect(afterTest.last_comparison.changed.some((row) => row.metric === 'missing_structured_data' && row.before === true && row.after === false)).toBe(true);

    const rolled = demo.rollback('demo-jsonld-thunderstrike-650');
    const afterRoll = rolled.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650');
    expect(afterRoll.status).toBe('rolled_back');
    expect(fs.readFileSync(path.join(demo.paths.workingDir, 'thunderstrike-650.html'), 'utf8')).toBe(
      fs.readFileSync(path.join(demo.paths.originalsDir, 'thunderstrike-650.html'), 'utf8')
    );
    expect(rolled.changelog.filter((row) => row.recommendation_id === 'demo-jsonld-thunderstrike-650').length).toBeGreaterThan(1);
  });

  it('makes the Nightfall price visible in raw HTML and restores it on rollback', () => {
    const demo = workflow();
    const applied = demo.apply('demo-raw-html-nightfall-350');
    expect(applied.last_entry.after).toMatch(/Ex-showroom price for the Nightfall 350 is ₹2,19,000/);
    const retested = demo.retest('demo-raw-html-nightfall-350');
    expect(retested.items.find((row) => row.id === 'demo-raw-html-nightfall-350').status).toBe('verified_improved');
    demo.rollback('demo-raw-html-nightfall-350');
    const restored = fs.readFileSync(path.join(demo.paths.workingDir, 'nightfall-350.html'), 'utf8');
    expect(restored).toBe(fs.readFileSync(path.join(demo.paths.originalsDir, 'nightfall-350.html'), 'utf8'));
    expect(restored).not.toMatch(/₹2,19,000/);
  });

  it('refuses rollback when the working file changed unexpectedly', () => {
    const demo = workflow();
    demo.apply('demo-jsonld-thunderstrike-650');
    writeWorking(demo.paths, 'thunderstrike-650.html', '<html><body>unexpected edit</body></html>');
    expect(() => demo.rollback('demo-jsonld-thunderstrike-650')).toThrow(/changed unexpectedly/i);
    const entries = demo.changelog();
    expect(entries.some((row) => row.action === 'rollback' && row.refused)).toBe(true);
    expect(fs.readFileSync(path.join(demo.paths.workingDir, 'thunderstrike-650.html'), 'utf8')).toBe(
      '<html><body>unexpected edit</body></html>'
    );
  });

  it('refuses a repeated apply until rollback', () => {
    const demo = workflow();
    demo.apply('demo-jsonld-thunderstrike-650');
    expect(() => demo.apply('demo-jsonld-thunderstrike-650')).toThrow(/Repeated apply refused/i);
    demo.rollback('demo-jsonld-thunderstrike-650');
    const again = demo.apply('demo-jsonld-thunderstrike-650');
    expect(again.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650').status).toBe('applied');
  });

  it('marks verification inconclusive when baseline evidence is missing', () => {
    const demo = workflow();
    demo.apply('demo-jsonld-thunderstrike-650', { record_baseline: false });
    const retested = demo.retest('demo-jsonld-thunderstrike-650');
    expect(retested.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650').status).toBe(
      'verification_inconclusive'
    );
    expect(retested.last_entry.comparison.explanation).toMatch(/baseline snapshot is required/i);
  });

  it('does not mark improved unless comparable snapshots support it', () => {
    const result = compareSnapshots({
      fix: {
        type: 'product_jsonld',
        expected_signals: { product_name: 'Thunderstrike 650', price: 420000 },
      },
      baseline: null,
      after: { finding_present: false, has_product_jsonld: true },
    });
    expect(result.status).toBe('verification_inconclusive');
    expect(result.improved).toBe(false);

    const unchanged = compareSnapshots({
      fix: {
        type: 'product_jsonld',
        expected_signals: { product_name: 'Thunderstrike 650', price: 420000 },
      },
      baseline: { finding_present: true, has_product_jsonld: false },
      after: { finding_present: true, has_product_jsonld: false, jsonld_has_expected: false },
    });
    expect(unchanged.status).toBe('verified_no_improvement');
  });

  it('rejects unknown ids and does not write arbitrary paths', () => {
    const demo = workflow();
    expect(() => demo.apply('../secrets.txt')).toThrow(/Unknown demo fix/i);
    expect(fs.existsSync(path.join(demo.paths.workingDir, '..', 'secrets.txt'))).toBe(false);
  });
});

describe('apply-demo API', () => {
  it('requires an explicit apply POST and leaves the live-site crawl working', async () => {
    const demo = createApplyDemo({
      referencePack: apex,
      paths: tempSandbox(),
    });
    const config = loadConfig();
    config.referencePack = loadReference(config);
    const app = createApp({
      config,
      store: createMemoryStore(),
      applyDemo: demo,
      crawlFn: (url) =>
        crawlSite(url, {
          fetchImpl: mockFetch(pagesA),
          lookupImpl: publicLookup(),
          limits: { delayMs: 0 },
        }),
    });
    const { server, url } = await listen(app);
    try {
      const listed = await fetch(`${url}/api/apply-demo`).then((res) => res.json());
      expect(listed.items).toHaveLength(2);
      expect(listed.items.every((row) => row.status === 'proposed')).toBe(true);

      const applied = await fetch(`${url}/api/apply-demo/demo-jsonld-thunderstrike-650/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(applied.status).toBe(201);
      const appliedBody = await applied.json();
      expect(appliedBody.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650').status).toBe('applied');

      const retest = await fetch(`${url}/api/apply-demo/demo-jsonld-thunderstrike-650/retest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).then((res) => res.json());
      expect(retest.items.find((row) => row.id === 'demo-jsonld-thunderstrike-650').status).toBe('verified_improved');

      const crawl = await fetch(`${url}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${SITE_A}/` }),
      }).then((res) => res.json());
      expect(crawl.session.origin).toContain('lamps.example');
    } finally {
      server.close();
    }
  });
});
