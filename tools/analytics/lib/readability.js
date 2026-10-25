import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const FIXTURE_PATH = path.join(__dirname, '../data/ai-crawler-fixture.json');
const MANIFEST_PATH = path.join(repoRoot, 'agents/readability/review_dashboard/manifest.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadHumanReport() {
  const manifest = readJson(MANIFEST_PATH);
  if (!manifest.report_path) return { manifest, report: null };
  const report = readJson(path.join(repoRoot, manifest.report_path));
  return { manifest, report };
}

export function loadAiFixture() {
  return readJson(FIXTURE_PATH);
}

function normalizePath(value) {
  if (!value) return '';
  let pathname = String(value);
  try {
    if (pathname.startsWith('http')) pathname = new URL(pathname).pathname;
  } catch {
    /* keep */
  }
  pathname = pathname.split('?')[0];
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  return pathname || '/';
}

function formatInr(value) {
  if (typeof value !== 'number') return value == null ? null : String(value);
  return `₹${value.toLocaleString('en-IN')}`;
}

function factValue(fact) {
  if (!fact) return null;
  if (fact.currency === 'INR' && typeof fact.value === 'number') return formatInr(fact.value);
  const text = fact.value_text || fact.value;
  if (text == null || text === '') return null;
  return String(text);
}

function pickFact(facts, type, qualifierKey, qualifierValue) {
  return facts.find((fact) => {
    if (fact.fact_type !== type) return false;
    if (!qualifierKey) return true;
    return String(fact.qualifier?.[qualifierKey] || '').toLowerCase() === String(qualifierValue).toLowerCase();
  });
}

export function extractHumanFields(page) {
  const facts = (page.structured_facts || {}).facts || [];
  const entities = (page.structured_facts || {}).entities || [];
  const product = entities.find((entity) => entity.type === 'product' && !entity.variant_of);
  const colours = facts
    .filter((fact) => /colou?r/i.test(fact.qualifier?.spec_label || fact.fact_type || '') || /colou?r/i.test(String(fact.value_text || '')))
    .map((fact) => factValue(fact))
    .filter(Boolean);

  const fields = [
    { key: 'name', label: 'Model', value: product?.name || page.primary_product || null },
    { key: 'ex_showroom_price', label: 'Ex-showroom', value: factValue(pickFact(facts, 'ex_showroom_price') || pickFact(facts, 'starting_price')) },
    { key: 'on_road_delhi', label: 'On-road Delhi', value: factValue(pickFact(facts, 'on_road_price', 'city', 'Delhi')) },
    { key: 'on_road_pune', label: 'On-road Pune', value: factValue(pickFact(facts, 'on_road_price', 'city', 'Pune')) },
    { key: 'engine', label: 'Engine', value: factValue(pickFact(facts, 'engine')) },
    { key: 'power', label: 'Power', value: factValue(pickFact(facts, 'power')) },
    { key: 'mileage', label: 'Mileage', value: factValue(pickFact(facts, 'mileage')) },
    { key: 'colours', label: 'Colours', value: colours.length ? colours[0] : null },
  ];

  return {
    source: 'playwright_human_view',
    name: product?.name || null,
    slug: product?.slug || String(page.canonical_path || '').split('/').filter(Boolean).pop() || null,
    path: normalizePath(page.canonical_path || page.canonical_url || page.url),
    url: page.canonical_url || page.final_url || page.url,
    fields,
  };
}

export function listCatalog() {
  const { report } = loadHumanReport();
  const pages = (report?.pages || []).filter((page) => page.page_type === 'product_detail');
  return pages.map((page) => {
    const human = extractHumanFields(page);
    return {
      name: human.name,
      slug: human.slug,
      path: human.path,
      url: human.url,
    };
  }).filter((item) => item.slug);
}

function normalizeValue(value) {
  if (value == null || value === '') return null;
  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

export function compareReadability(slug) {
  const { report } = loadHumanReport();
  const fixture = loadAiFixture();
  const pages = report?.pages || [];
  const page = pages.find((item) => {
    const path = normalizePath(item.canonical_path);
    return path === `/motorcycles/${slug}` || path.endsWith(`/${slug}`);
  });
  const aiPage = (fixture.pages || []).find((item) => item.slug === slug) || null;
  const human = page ? extractHumanFields(page) : null;
  const aiFields = aiPage?.fields || [];

  const keys = [...new Set([
    ...aiFields.map((field) => field.key),
    ...(human?.fields || []).map((field) => field.key),
  ])];

  const rows = keys.map((key) => {
    const ai = aiFields.find((field) => field.key === key);
    const hv = (human?.fields || []).find((field) => field.key === key);
    const label = ai?.label || hv?.label || key;
    const aiValue = ai?.present === false ? null : (ai?.value ?? null);
    const humanValue = hv?.value ?? null;
    let status = 'match';
    if (!ai && humanValue) status = 'ai_missing';
    else if (ai?.present === false || (ai && aiValue == null && humanValue)) status = 'ai_missing';
    else if (humanValue && aiValue && normalizeValue(aiValue) !== normalizeValue(humanValue)) status = 'mismatch';
    else if (!humanValue && aiValue) status = 'human_missing';
    else if (!humanValue && !aiValue) status = 'unavailable';
    return {
      key,
      label,
      ai_value: aiValue,
      human_value: humanValue,
      ai_note: ai?.note || null,
      status,
    };
  });

  const missing = rows.filter((row) => row.status === 'ai_missing').length;
  const mismatched = rows.filter((row) => row.status === 'mismatch').length;

  return {
    slug,
    fixture_disclaimer: fixture.disclaimer,
    fixture_source: fixture.source,
    product: human?.name || aiPage?.name || slug,
    path: human?.path || aiPage?.canonical_path || `/motorcycles/${slug}`,
    url: human?.url || null,
    ai: {
      source: fixture.source,
      label: 'AI Read',
      looks_fine_to_person: aiPage?.looks_fine_to_person ?? null,
      notes: aiPage?.notes || [],
      available: Boolean(aiPage),
    },
    human: {
      source: 'playwright_human_view',
      label: 'Human Read',
      available: Boolean(human),
    },
    rows,
    summary: {
      missing,
      mismatched,
      text: !aiPage
        ? 'No AI crawler fixture is stored for this page.'
        : !human
          ? 'No Human View capture is available for this page.'
          : missing || mismatched
            ? `${mismatched} mismatched field${mismatched === 1 ? '' : 's'}, ${missing} missing from AI read.`
            : 'Displayed fields match between the AI fixture and Human View.',
    },
  };
}
