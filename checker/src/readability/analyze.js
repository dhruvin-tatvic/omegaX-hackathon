import { crawlSite } from '../crawl/crawler.js';
import {
  extractPage,
  hasProductStructuredData,
  looksJavaScriptRendered,
  pageLooksLikeProduct,
} from '../crawl/extract.js';
import { fetchPublic, normalizeHttpUrl } from '../security/urlGuard.js';
import { renderPage } from './render.js';
import { collapseText, renderedOnlySnippets } from './text.js';

function finding(fields) {
  return {
    id: fields.id,
    category: fields.category,
    severity: fields.severity,
    url: fields.url,
    evidence: fields.evidence || [],
    explanation: fields.explanation,
    limitations: fields.limitations || [],
    related_urls: fields.related_urls || [],
    values: fields.values || [],
  };
}

async function inspectResource(resource, { fetchImpl, lookupImpl, timeoutMs }) {
  try {
    const res = await fetchPublic(resource.url, { fetchImpl, lookupImpl, timeoutMs, maxBodyBytes: 200000 });
    const contentType = String(res.headers['content-type'] || res.headers['Content-Type'] || '');
    return {
      url: resource.url,
      kind: resource.kind,
      status: res.status,
      contentType,
      inspected: true,
      error: null,
    };
  } catch (err) {
    return {
      url: resource.url,
      kind: resource.kind,
      status: null,
      contentType: '',
      inspected: false,
      error: err.message,
    };
  }
}

export async function analyzeReadability(startUrl, options = {}) {
  const startedAt = new Date().toISOString();
  const start = normalizeHttpUrl(startUrl);
  const {
    crawlFn = crawlSite,
    fetchImpl,
    lookupImpl,
    renderImpl,
    limits = {},
  } = options;
  const findings = [];
  const comparisons = [];
  const crawlLimits = { delayMs: 0, maxPages: limits.maxPages || 12, ...limits };
  const session = await crawlFn(start.href, {
    fetchImpl,
    lookupImpl,
    limits: crawlLimits,
  });

  const fetchOpts = { fetchImpl, lookupImpl, timeoutMs: crawlLimits.timeoutMs || 12000 };
  let rawHtml = '';
  let rawExtract = null;
  try {
    const raw = await fetchPublic(start.href, fetchOpts);
    rawHtml = raw.body;
    rawExtract = extractPage(raw.url, raw.body);
  } catch (err) {
    findings.push(
      finding({
        id: 'raw-html-failed',
        category: 'http_error',
        severity: 'high',
        url: start.href,
        evidence: [{ url: start.href, kind: 'error', text: err.message }],
        explanation: `Raw HTTP HTML could not be fetched: ${err.message}`,
        limitations: ['Without raw HTML, JavaScript-dependent differences cannot be measured.'],
      })
    );
  }

  const rendered = await renderPage(start.href, {
    renderImpl,
    timeoutMs: crawlLimits.timeoutMs || 12000,
  });
  let renderedExtract = null;
  if (rendered.skipped) {
    findings.push(
      finding({
        id: 'render-skipped',
        category: 'render_unavailable',
        severity: 'low',
        url: start.href,
        evidence: [{ url: start.href, kind: 'note', text: rendered.error }],
        explanation:
          'Browser rendering was skipped because no local Chrome/Chromium binary was available.',
        limitations: [
          'This is not evidence that the page is JavaScript-only. Raw HTML was still analysed.',
        ],
      })
    );
  } else if (!rendered.ok) {
    findings.push(
      finding({
        id: 'render-failed',
        category: 'render_failed',
        severity: 'medium',
        url: start.href,
        evidence: [{ url: start.href, kind: 'error', text: rendered.error || 'Render failed' }],
        explanation: `Browser rendering did not complete: ${rendered.error || 'unknown error'}.`,
        limitations: [
          'No raw-versus-rendered comparison was produced for this URL. Heuristic signals are labelled separately.',
        ],
      })
    );
  } else if (rawExtract) {
    renderedExtract = extractPage(start.href, rendered.html);
    const extras = renderedOnlySnippets(rawExtract.readableText, renderedExtract.readableText);
    comparisons.push({
      url: start.href,
      raw_text: collapseText(rawExtract.readableText).slice(0, 800),
      rendered_text: collapseText(renderedExtract.readableText).slice(0, 800),
      rendered_only: extras,
    });
    if (extras.length) {
      findings.push(
        finding({
          id: 'js-dependent-content',
          category: 'js_dependent_content',
          severity: 'medium',
          url: start.href,
          evidence: extras.map((text) => ({
            url: start.href,
            kind: 'rendered_only',
            text,
          })),
          explanation:
            'Visible text present in the browser-rendered DOM was not found in the raw HTTP HTML for this URL.',
          limitations: [
            'This comparison shows a difference between the two captures. It does not prove the extra text is exclusively JavaScript-generated; delayed HTML, personalization, or timing can also cause gaps.',
          ],
        })
      );
    }
  }

  if (rawExtract?.jsLikely || session.js_likely_urls?.includes(start.href) || looksJavaScriptRendered(rawHtml, rawExtract?.readableText || '')) {
    findings.push(
      finding({
        id: 'js-heuristic',
        category: 'js_heuristic',
        severity: 'low',
        url: start.href,
        evidence: [
          {
            url: start.href,
            kind: 'heuristic',
            text: `Readable HTML text length ${rawExtract?.readableLength ?? 0}; JS-shell markers or many script tags were present.`,
          },
        ],
        explanation:
          'Heuristic: the raw HTML looks like an application shell with little visible text. Content may be filled in after scripts run.',
        limitations: [
          'Heuristic only. This is not proof that content is exclusively JavaScript-generated.',
        ],
      })
    );
  }

  for (const blocked of session.robots_blocked || []) {
    findings.push(
      finding({
        id: `robots-${blocked}`,
        category: 'robots_restriction',
        severity: 'medium',
        url: blocked,
        evidence: [{ url: blocked, kind: 'robots', text: 'Disallowed by robots.txt for the checker user-agent.' }],
        explanation: `robots.txt disallows fetching ${blocked} for this crawler, so the page was not used as HTML evidence.`,
        limitations: [
          'Other user-agents may be allowed. This is the robots rule as fetched, not a guarantee of a production firewall.',
        ],
      })
    );
  }

  for (const failed of session.pages_failed || []) {
    findings.push(
      finding({
        id: `http-${failed.url}`,
        category: 'http_error',
        severity: failed.status === 403 ? 'high' : 'medium',
        url: failed.url,
        evidence: [{ url: failed.url, kind: 'http', text: failed.error || `HTTP ${failed.status}` }],
        explanation: `The page returned ${failed.error || `HTTP ${failed.status}`} and was not parsed as HTML evidence.`,
        limitations: ['A block or error at crawl time may be temporary, geo-specific, or bot-specific.'],
      })
    );
  }

  const resources = (session.linked_resources || []).slice(0, 8);
  for (const resource of resources) {
    const inspected = await inspectResource(resource, fetchOpts);
    const kindCategory = resource.kind === 'pdf' ? 'linked_pdf' : 'linked_image';
    const evidenceText = inspected.inspected
      ? `HTTP ${inspected.status}; Content-Type: ${inspected.contentType || '(not provided)'}.`
      : `Could not inspect: ${inspected.error}`;
    findings.push(
      finding({
        id: `${resource.kind}-${resource.url}`,
        category: kindCategory,
        severity: 'low',
        url: resource.url,
        related_urls: [resource.source_url].filter(Boolean),
        evidence: [
          {
            url: resource.url,
            kind: resource.kind,
            text: `${evidenceText} Linked from ${resource.source_url || start.href}${resource.context ? ` (${resource.context})` : ''}.`,
          },
        ],
        explanation: inspected.inspected
          ? `A linked ${resource.kind.toUpperCase()} was found. HTTP metadata was inspected; the file body was not parsed as HTML.`
          : `A linked ${resource.kind.toUpperCase()} was found but could not be inspected (${inspected.error}).`,
        limitations: [
          'This test does not OCR images or extract PDF text. Absence of HTML text from the file is not proof that humans or other tools cannot read it.',
        ],
      })
    );
  }

  const productPages = (session.pages_visited || []).filter((page) => {
    const extract = page.url === start.href ? rawExtract : null;
    return pageLooksLikeProduct(page.url, extract || { prices: page.title ? ['x'] : [], headings: page.title ? [page.title] : [] });
  });
  const startLooksProduct = rawExtract && pageLooksLikeProduct(start.href, rawExtract);
  if (startLooksProduct && rawExtract && !hasProductStructuredData(rawExtract.jsonld)) {
    findings.push(
      finding({
        id: 'missing-jsonld',
        category: 'missing_structured_data',
        severity: 'low',
        url: start.href,
        evidence: [
          {
            url: start.href,
            kind: 'jsonld',
            text: rawExtract.hasJsonLd
              ? `JSON-LD is present (${(rawExtract.jsonldTypes || []).join(', ') || 'untyped'}) but no Product/Offer schema was found.`
              : 'No JSON-LD script was found in the raw HTML.',
          },
        ],
        explanation:
          'This URL looks like a product page but Product JSON-LD was not found in the raw HTML. That is a structured-data gap, not proof the page is unreadable.',
        limitations: [
          'Schema may exist only after rendering, in another format (microdata/RDFa), or on a different URL.',
        ],
      })
    );
  }

  for (const conflict of session.conflicts || []) {
    const severity = conflict.severity || (conflict.confidence === 'uncertain' ? 'low' : 'high');
    const subject = conflict.subject || conflict.context || 'the same product';
    findings.push(
      finding({
        id: `conflict-${(conflict.urls || []).join('-')}`,
        category: 'conflicting_facts',
        severity,
        url: (conflict.urls || [])[0] || start.href,
        related_urls: conflict.urls || [],
        values: conflict.values || [],
        evidence: (conflict.snippets || []).map((text, index) => ({
          url: (conflict.urls || [])[index] || start.href,
          kind: 'conflict',
          text,
        })),
        explanation: `Comparable ${conflict.price_kind || 'price'} values for ${subject} differ (${(conflict.values || []).join(' vs ')}) across pages.`,
        limitations: [
          'Only typed prices for a shared product/subject are compared. Phones, rider counts, and EMI amounts are not treated as ex-showroom prices.',
          'The detector can still miss conflicts that lack a shared product name, or leave uncertain pairs at low severity.',
        ],
      })
    );
  }

  return {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    url: start.href,
    origin: session.origin,
    session,
    comparisons,
    findings,
    limitations: [
      'Readability findings are based on public HTTP HTML, optional local Chrome rendering, robots.txt, and link inspection.',
      'Heuristic JS-shell detection is labelled separately from raw-versus-rendered differences.',
      'PDF and image bodies are not OCR’d; only HTTP metadata is inspected when the fetch succeeds.',
      'Missing JSON-LD is a structured-data warning, not a claim that the page cannot be read.',
    ],
    notes: {
      robots_found: session.robots_found,
      render: rendered.skipped ? 'skipped' : rendered.ok ? 'ok' : 'failed',
      product_pages_considered: productPages.length,
    },
  };
}
