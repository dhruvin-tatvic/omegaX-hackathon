import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCT, ROUTES, TATVIC_LOGO, renderPage } from '../layout.js';
import { compareReadability, listCatalog } from '../lib/readability.js';

test('navigation matches Be The Answer information architecture', () => {
  const hrefs = ROUTES.map((item) => item.href);
  assert.deepEqual(hrefs, [
    '/traffic',
    '/human-view',
    '/readability',
    '/comparison',
    '/comparison/recommendations',
    '/comparison/runs',
  ]);
  assert.ok(!hrefs.includes('/'));
  assert.ok(!ROUTES.some((item) => item.id === 'home' || item.label === 'Home'));
  assert.equal(PRODUCT.name, 'Be The Answer');
});

test('shell uses official Tatvic logo without a logo frame class', () => {
  const html = renderPage({
    title: 'Traffic Intelligence',
    activeId: 'traffic',
    bodyFile: 'traffic.html',
  });
  assert.match(html, /Be The Answer/);
  assert.match(html, /AI Visibility & Answer Intelligence/);
  assert.match(html, new RegExp(TATVIC_LOGO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /ta-logo-wrap/);
  assert.doesNotMatch(html, /\u2014|\u2013/);
  assert.match(html, /Traffic Intelligence/);
  assert.match(html, /AI vs Human Readability/);
  assert.doesNotMatch(html, />Home</);
});

test('human view fragment keeps required ids', () => {
  const html = renderPage({
    title: 'Human View',
    activeId: 'human-view',
    bodyFile: 'human-view.html',
  });
  for (const token of [
    'id="kpi-grid"',
    'id="category-chart"',
    'id="search"',
    'id="type-filter"',
    'id="status-filter"',
    'data-tab="overview"',
    'data-tab="facts"',
    'data-tab="screenshot"',
    'id="export-facts"',
    'id="dev-details"',
  ]) {
    assert.match(html, new RegExp(token));
  }
});

test('readability compare uses fixture and human view without inventing a product', () => {
  const catalog = listCatalog();
  assert.ok(catalog.some((item) => item.slug === 'storm-200'));
  const result = compareReadability('storm-200');
  assert.equal(result.human.available, true);
  assert.equal(result.ai.available, true);
  assert.equal(result.fixture_source, 'local_ai_crawler_fixture');
  assert.ok(result.rows.some((row) => row.key === 'on_road_pune' && row.status === 'ai_missing'));
  assert.match(result.summary.text, /missing|mismatch/i);
});
