import { numbersEqual, parseNumber } from '../evaluation/numbers.js';

const GENERIC_TOKENS = new Set([
  'about',
  'after',
  'bank',
  'brass',
  'buyer',
  'buyers',
  'call',
  'community',
  'company',
  'contact',
  'cost',
  'costs',
  'dealer',
  'dealers',
  'dealership',
  'desk',
  'detailed',
  'emi',
  'ex',
  'finance',
  'finish',
  'from',
  'have',
  'home',
  'india',
  'join',
  'lamp',
  'learn',
  'limited',
  'listed',
  'monthly',
  'more',
  'official',
  'on',
  'overview',
  'page',
  'price',
  'priced',
  'prices',
  'private',
  'product',
  'products',
  'ride',
  'riders',
  'road',
  'rupees',
  'season',
  'sheet',
  'showroom',
  'specification',
  'specifications',
  'starting',
  'test',
  'that',
  'their',
  'them',
  'this',
  'today',
  'visit',
  'website',
  'welcome',
  'were',
  'with',
  'your',
  'apex',
  'moto',
  'acme',
  'pump',
]);

const PRICE_HINTS = /\b(ex-?showroom|on-?road|mrp|price[ds]?|priced|costing|costs?|rupees?|offer price|starting (?:at|from))\b/i;
const EMI_HINTS =
  /\b(emi|instal+ments?|per month|monthly (?:emi|payment|instal+ment)|down payment)\b|\/\s*mo(?:nth)?\b/i;
const PHONE_HINTS = /\b(phone|mobile|tel|telephone|call|whatsapp|helpline|hotline|contact|dial)\b/i;
const STAT_HINTS =
  /\b(riders?|customers?|owners?|dealers?|stores?|showrooms?|reviews?|ratings?|sold|units?|happy|followers?|downloads?|registrations?|visits?|enquir(?:y|ies)|members?)\b/i;

function collapse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function overlaps(spans, start, end) {
  return spans.some((span) => start < span.end && end > span.start);
}

function windowAround(text, start, end, radius = 90) {
  return collapse(text.slice(Math.max(0, start - radius), Math.min(text.length, end + radius)));
}

function digitCount(raw) {
  return String(raw || '').replace(/\D/g, '').length;
}

function isPhoneSpan(span, window) {
  if (span.hint === 'phone') return true;
  const digits = digitCount(span.raw);
  if (digits >= 10 && digits <= 12 && !/₹|INR|Rs\.?/i.test(span.raw)) return true;
  return digits >= 8 && PHONE_HINTS.test(window) && !/₹|INR|Rs\.?/i.test(span.raw);
}

function classifySpan(span, window) {
  if (isPhoneSpan(span, window)) return { type: 'phone', kind: 'phone' };
  if (EMI_HINTS.test(window)) return { type: 'emi', kind: 'emi' };
  const hasCurrency = span.hint === 'currency' || /₹|INR|Rs\.?/i.test(span.raw);
  if (STAT_HINTS.test(window) && !hasCurrency && !PRICE_HINTS.test(window)) {
    return { type: 'statistic', kind: 'statistic' };
  }
  if (hasCurrency || PRICE_HINTS.test(window)) {
    if (/ex-?showroom/i.test(window)) return { type: 'price', kind: 'ex_showroom' };
    if (/on-?road/i.test(window)) return { type: 'price', kind: 'on_road' };
    return { type: 'price', kind: 'price' };
  }
  return { type: 'unknown', kind: 'unknown' };
}

function collectSpans(text) {
  const spans = [];
  const add = (re, hint) => {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (overlaps(spans, start, end)) continue;
      spans.push({ start, end, raw: match[0], hint });
    }
  };
  add(/(?:₹|INR|Rs\.?)\s*[\d,]+(?:\.\d+)?/gi, 'currency');
  add(/\+91[\s-]*[6-9]\d[\d\s-]{8,14}/g, 'phone');
  add(/\b[6-9]\d{9}\b/g, 'phone');
  add(/\b\d{1,3}(?:,\d{2,3})+\+?|\b\d{4,}\+?/g, 'number');
  return spans.sort((a, b) => a.start - b.start);
}

function normalizeKey(value) {
  return collapse(String(value || '').toLowerCase())
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addSubjectKeys(keys, text) {
  const src = String(text || '');
  for (const match of src.match(/\b[a-z][a-z0-9-]+\s+\d{2,4}\b/gi) || []) {
    const key = normalizeKey(match);
    if (key) keys.add(key);
  }
  for (const match of src.match(/\b[A-Z][a-z0-9]+(?:[ -][A-Z0-9][a-z0-9]*){1,3}\b/g) || []) {
    const key = normalizeKey(match);
    if (key) keys.add(key);
  }
}

function subjectsFromUrl(url) {
  const keys = new Set();
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/').filter(Boolean);
    const last = parts.slice(-2).join(' ');
    const key = normalizeKey(last.replace(/-/g, ' '));
    if (key && key.length >= 4) keys.add(key);
    for (const part of parts) {
      const token = normalizeKey(part.replace(/-/g, ' '));
      if (token.length >= 4 && !GENERIC_TOKENS.has(token)) keys.add(token);
    }
  } catch {
    /* ignore invalid URLs */
  }
  return keys;
}

export function distinctiveSubjectTokens(keys) {
  const tokens = new Set();
  for (const key of keys || []) {
    if (!key) continue;
    if (key.includes(' ')) tokens.add(key);
    for (const token of key.split(/\s+/)) {
      if (token.length >= 4 && !GENERIC_TOKENS.has(token) && !/^\d+$/.test(token)) tokens.add(token);
    }
  }
  return tokens;
}

export function extractTypedFacts(text, { url, kind } = {}) {
  const src = String(text || '');
  const facts = [];
  for (const span of collectSpans(src)) {
    const value = parseNumber(span.raw);
    if (value == null) continue;
    const window = windowAround(src, span.start, span.end);
    let { type, kind: factKind } = classifySpan(span, window);
    if (kind === 'price' && type === 'unknown') {
      type = 'price';
      factKind = 'price';
    }
    const subjects = new Set();
    addSubjectKeys(subjects, window);
    addSubjectKeys(subjects, src);
    for (const key of subjectsFromUrl(url)) subjects.add(key);
    facts.push({
      type,
      kind: factKind,
      value,
      raw: span.raw,
      window,
      text: src.slice(0, 280),
      url,
      subjects,
    });
  }
  return facts;
}

function pageSubjects(items) {
  const byUrl = new Map();
  for (const item of items) {
    const url = item.url;
    if (!byUrl.has(url)) byUrl.set(url, new Set());
    const keys = byUrl.get(url);
    if (item.kind === 'title' || item.kind === 'heading') addSubjectKeys(keys, item.text);
    for (const key of subjectsFromUrl(url)) keys.add(key);
  }
  return byUrl;
}

function comparablePrices(a, b) {
  if (a.type !== 'price' || b.type !== 'price') return null;
  if ((a.kind === 'on_road' && b.kind === 'ex_showroom') || (b.kind === 'on_road' && a.kind === 'ex_showroom')) {
    return null;
  }
  if (a.kind === b.kind) return 'high';
  if (
    (a.kind === 'price' || a.kind === 'ex_showroom') &&
    (b.kind === 'price' || b.kind === 'ex_showroom')
  ) {
    return 'high';
  }
  return 'uncertain';
}

function sharedSubjects(a, b) {
  const left = distinctiveSubjectTokens(a.subjects);
  const right = distinctiveSubjectTokens(b.subjects);
  return [...left].filter((token) => right.has(token));
}

export function detectConflicts(evidence) {
  const items = Array.isArray(evidence) ? evidence : [];
  const subjectsByUrl = pageSubjects(items);
  const facts = [];
  for (const item of items) {
    const extracted = extractTypedFacts(item.text, { url: item.url, kind: item.kind });
    const pageKeys = subjectsByUrl.get(item.url) || new Set();
    for (const fact of extracted) {
      for (const key of pageKeys) fact.subjects.add(key);
      facts.push(fact);
    }
  }

  const conflicts = [];
  for (let i = 0; i < facts.length; i += 1) {
    for (let j = i + 1; j < facts.length; j += 1) {
      const a = facts[i];
      const b = facts[j];
      if (!a.url || !b.url || a.url === b.url) continue;
      if (numbersEqual(a.value, b.value)) continue;
      const shared = sharedSubjects(a, b);
      const confidence = comparablePrices(a, b);
      if (!confidence) continue;
      if (!shared.length) continue;
      const severity = confidence === 'high' ? 'high' : 'low';
      conflicts.push({
        context: shared.slice(0, 8).join(' '),
        subject: shared[0],
        fact_type: 'price',
        price_kind: a.kind === b.kind ? a.kind : `${a.kind}|${b.kind}`,
        confidence,
        severity,
        values: [...new Set([a.value, b.value])],
        urls: [a.url, b.url],
        snippets: [a.window || a.text, b.window || b.text],
      });
    }
  }

  const uniq = [];
  const seen = new Set();
  for (const row of conflicts) {
    const key = `${row.values.slice().sort((x, y) => x - y).join(',')}|${row.urls.slice().sort().join('|')}|${row.price_kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(row);
  }
  return uniq.slice(0, 12);
}
