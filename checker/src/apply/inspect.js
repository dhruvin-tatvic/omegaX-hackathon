import {
  extractPage,
  hasProductStructuredData,
} from '../crawl/extract.js';
import { renderedOnlySnippets } from '../readability/text.js';
import { recommendFromResults } from '../recommendations/engine.js';

function finding({ id, category, severity, url, evidence, explanation }) {
  return {
    id,
    category,
    severity,
    url,
    evidence,
    explanation,
    limitations: [
      'This inspection reads the isolated local demo fixture only. It is not a live-site crawl.',
    ],
    related_urls: [],
    values: [],
  };
}

export function inspectFixtureHtml({ html, url, renderedHtml = null, title }) {
  const extract = extractPage(url, html);
  const findings = [];
  let extras = [];
  if (renderedHtml) {
    const renderedExtract = extractPage(url, renderedHtml);
    extras = renderedOnlySnippets(extract.readableText, renderedExtract.readableText);
    if (extras.length) {
      findings.push(
        finding({
          id: 'js-dependent-content',
          category: 'js_dependent_content',
          severity: 'medium',
          url,
          evidence: extras.map((text) => ({ url, kind: 'rendered_only', text })),
          explanation:
            'Visible text present in the labelled demo rendered snapshot was not found in the raw demo HTML.',
        })
      );
    }
  }

  const looksProduct = /\/motorcycles\//i.test(url) || (extract.prices?.length && extract.headings?.length);
  if (looksProduct && !hasProductStructuredData(extract.jsonld)) {
    findings.push(
      finding({
        id: 'missing-jsonld',
        category: 'missing_structured_data',
        severity: 'low',
        url,
        evidence: [
          {
            url,
            kind: 'jsonld',
            text: extract.hasJsonLd
              ? 'JSON-LD is present but no Product/Offer schema was found.'
              : 'No JSON-LD script was found in the raw HTML.',
          },
        ],
        explanation:
          'This demo URL looks like a product page but Product JSON-LD was not found in the raw HTML. That is a structured-data gap, not proof the page is unreadable.',
      })
    );
  }

  const report = {
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    url,
    origin: new URL(url).origin,
    findings,
    comparisons: renderedHtml
      ? [
          {
            url,
            rendered_only: extras,
          },
        ]
      : [],
    session: {
      pages_visited: [{ url, title: title || extract.title }],
      facts: extract.evidence || [],
    },
    notes: {
      has_product_jsonld: hasProductStructuredData(extract.jsonld),
      jsonld_types: extract.jsonldTypes || [],
      readable_length: extract.readableLength,
      fixture: true,
      label: 'LOCAL DEMO FIXTURE',
    },
    extract: {
      title: extract.title,
      readableText: extract.readableText,
      jsonld: extract.jsonld,
      prices: extract.prices,
    },
  };
  report.recommendations = recommendFromResults({ readability: report });
  return report;
}

export function snapshotFromInspection(report, fix) {
  const matching = (report.findings || []).filter((row) => row.category === fix.finding_category);
  const readable = String(report.extract?.readableText || '');
  const jsonldText = JSON.stringify(report.extract?.jsonld || []);
  const price = fix.expected_signals?.price;
  const name = fix.expected_signals?.product_name || '';
  const sentence = fix.expected_signals?.fact_sentence || '';
  const priceDigits = String(price ?? '');
  const hasPrice = readable.replace(/[^\d]/g, '').includes(priceDigits) || jsonldText.includes(priceDigits);
  return {
    fixture_url: fix.fixture_url,
    finding_category: fix.finding_category,
    finding_present: matching.length > 0,
    finding_ids: matching.map((row) => row.id),
    has_product_jsonld: Boolean(report.notes?.has_product_jsonld),
    rendered_only: report.comparisons?.[0]?.rendered_only || [],
    readable_excerpt: readable.slice(0, 800),
    readable_has_name: readable.includes(name),
    readable_has_price: hasPrice,
    raw_has_expected_fact: Boolean(sentence) && readable.includes(sentence),
    jsonld_has_expected:
      Boolean(report.notes?.has_product_jsonld) && jsonldText.includes(name) && jsonldText.includes(priceDigits),
    jsonld_types: report.notes?.jsonld_types || [],
    inspected_at: report.finished_at,
    label: 'LOCAL DEMO FIXTURE',
  };
}
