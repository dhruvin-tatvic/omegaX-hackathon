import * as cheerio from 'cheerio';
import { extractNumbers } from '../evaluation/numbers.js';

function collapse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function snippet(text, max = 280) {
  const clean = collapse(text);
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function looksJavaScriptRendered(html, readableText) {
  const scripts = (String(html).match(/<script/gi) || []).length;
  const textLen = collapse(readableText).length;
  const hasRoot = /id=["'](root|app|__next)["']/i.test(html);
  return textLen < 220 && (scripts >= 4 || hasRoot);
}

export function collectJsonLdTypes(nodes) {
  const types = [];
  const walk = (node) => {
    if (node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node['@type']) {
      const value = node['@type'];
      if (Array.isArray(value)) types.push(...value.map(String));
      else types.push(String(value));
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value);
    }
  };
  (nodes || []).forEach(walk);
  return types;
}

export function hasProductStructuredData(jsonld) {
  return collectJsonLdTypes(jsonld).some((type) => /product|offer|vehicle|motorcycle|bike/i.test(type));
}

export function pageLooksLikeProduct(url, extracted) {
  const href = String(url || '').toLowerCase();
  if (/\/(product|products|motorcycle|motorcycles|bike|bikes)s?\b/.test(href)) return true;
  return Boolean(extracted?.prices?.length && extracted?.headings?.length);
}

function collectLinkedResources($, pageUrl) {
  const resources = [];
  const seen = new Set();
  const add = (href, kind, context) => {
    if (!href) return;
    try {
      const absolute = new URL(href, pageUrl);
      absolute.hash = '';
      const key = absolute.href;
      if (seen.has(key)) return;
      seen.add(key);
      resources.push({
        url: key,
        kind,
        context: collapse(context).slice(0, 160),
      });
    } catch {
      /* ignore invalid URLs */
    }
  };

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    let pathname = href;
    try {
      pathname = new URL(href, pageUrl).pathname;
    } catch {
      pathname = href;
    }
    if (/\.pdf$/i.test(pathname)) add(href, 'pdf', $(el).text());
    else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(pathname)) add(href, 'image', $(el).text());
  });
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    let pathname = src;
    try {
      pathname = new URL(src, pageUrl).pathname;
    } catch {
      pathname = src;
    }
    if (/\.(png|jpe?g|gif|svg|webp)$/i.test(pathname || '')) {
      add(src, 'image', $(el).attr('alt') || '');
    }
  });
  return resources.slice(0, 40);
}

export function extractPage(pageUrl, html) {
  const $ = cheerio.load(String(html || ''));
  $('script:not([type="application/ld+json"]), style, noscript, iframe, svg').remove();

  const title = collapse($('title').first().text());
  const description = collapse(
    $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
  );
  const canonical = $('link[rel="canonical"]').attr('href') || pageUrl;
  const headings = $('h1, h2, h3')
    .map((_, el) => collapse($(el).text()))
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const jsonld = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      jsonld.push(JSON.parse(raw));
    } catch {
      jsonld.push({ unparsed: snippet(raw, 200) });
    }
  });

  const tables = [];
  $('table').each((_, table) => {
    const rows = [];
    $(table)
      .find('tr')
      .each((__, tr) => {
        const cells = $(tr)
          .find('th,td')
          .map((___, cell) => collapse($(cell).text()))
          .get()
          .filter(Boolean);
        if (cells.length) rows.push(cells.join(' | '));
      });
    if (rows.length) tables.push(rows.join('\n'));
  });

  const prices = $('[class*="price"], .price')
    .map((_, el) => collapse($(el).text()))
    .get()
    .filter(Boolean);

  const readable = collapse($('body').text());
  const links = $('a[href]')
    .map((_, el) => {
      try {
        return new URL($(el).attr('href'), pageUrl).href;
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean);

  const evidence = [];
  const push = (kind, text) => {
    const value = collapse(text);
    if (!value || value.length < 2) return;
    evidence.push({
      url: pageUrl,
      canonical,
      kind,
      text: snippet(value, 500),
      numbers: extractNumbers(value),
    });
  };

  push('title', title);
  push('meta', description);
  headings.forEach((h) => push('heading', h));
  prices.forEach((p) => push('price', p));
  tables.forEach((t) => push('table', t));
  jsonld.forEach((node) => push('jsonld', jsonLdToText(node)));
  if (readable) {
    const chunks = readable.match(/.{1,400}/g) || [];
    chunks.slice(0, 12).forEach((chunk) => push('text', chunk));
  }

  const linkedResources = collectLinkedResources($, pageUrl);

  return {
    url: pageUrl,
    canonical,
    title,
    description,
    headings,
    jsonld,
    jsonldTypes: collectJsonLdTypes(jsonld),
    hasJsonLd: jsonld.length > 0,
    hasProductJsonLd: hasProductStructuredData(jsonld),
    tables,
    prices,
    links,
    linkedResources,
    readableText: snippet(readable, 4000),
    readableLength: collapse(readable).length,
    jsLikely: looksJavaScriptRendered(html, readable),
    evidence,
  };
}

function jsonLdToText(node) {
  if (node == null) return '';
  if (typeof node !== 'object') return String(node);
  const parts = [];
  const walk = (value) => {
    if (value == null) return;
    if (typeof value !== 'object') {
      parts.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('@')) continue;
      if (typeof v === 'string' || typeof v === 'number') parts.push(`${k}: ${v}`);
      else walk(v);
    }
  };
  walk(node);
  return parts.join(' · ');
}
