/**
 * Deterministic gap analysis assembly from row audits.
 * Groq synthesis only polishes executive_summary / crawler note when enabled.
 */

const THEME_CATALOG = [
  {
    id: 'catalogue_visibility',
    theme: 'Featured cards vs full catalogue',
    severity: 'high',
    match: c => {
      if (c.ground_truth_scope?.question_intent === 'cheapest_ex_showroom' && (c.evaluation?.score ?? 100) < 90) {
        return true;
      }
      if ((c.evaluation?.mapped_comparisons || []).some(m => m.issue_type === 'scope_error')) return true;
      return (c.evaluation?.factual_errors || []).some(e =>
        /cheapest|storm 125|featured card|full catalogue/i.test(e),
      );
    },
  },
  {
    id: 'on_road_pricing',
    theme: 'City-specific on-road pricing',
    severity: 'high',
    match: c => {
      const intent = c.ground_truth_scope?.question_intent;
      if (intent === 'on_road_price' && (c.evaluation?.score ?? 100) < 90) return true;
      const blob = `${c.evaluation?.primary_gap || ''} ${(c.evaluation?.factual_errors || []).join(' ')}`;
      if (/on[- ]?road/i.test(blob)) return true;
      if (
        intent === 'ex_showroom_price' &&
        (c.ground_truth_scope?.cities?.length || 0) > 0 &&
        (c.evaluation?.score ?? 100) < 90 &&
        /bangalore|delhi|mumbai|pune/i.test(blob)
      ) {
        return true;
      }
      return false;
    },
  },
  {
    id: 'structured_data',
    theme: 'Missing or weak structured data (JSON-LD)',
    severity: 'high',
    match: c =>
      /json-ld|schema|structured/i.test(
        `${c.evaluation?.site_fix_hint || ''} ${(c.evaluation?.factual_errors || []).join(' ')}`,
      ),
  },
  {
    id: 'crawler_access',
    theme: 'Crawler and fetch access failures',
    severity: 'high',
    match: c => (c.evaluation?.access_or_visibility_issues || []).length > 0,
  },
  {
    id: 'incomplete_pages',
    theme: 'Incomplete product page content',
    severity: 'medium',
    match: c => {
      const intent = c.ground_truth_scope?.question_intent;
      return ['specifications', 'colours', 'mileage_or_range', 'similar_models'].includes(intent) &&
        (c.evaluation?.score ?? 100) < 90;
    },
  },
];

function shortQuestion(input, max = 72) {
  const t = String(input || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function scoresByTool(comparisons) {
  const buckets = {};
  for (const c of comparisons) {
    const tool = c.ai_tool || 'Unknown';
    buckets[tool] = buckets[tool] || { sum: 0, n: 0 };
    buckets[tool].sum += Number(c.evaluation?.score) || 0;
    buckets[tool].n += 1;
  }
  const out = {};
  for (const [tool, { sum, n }] of Object.entries(buckets)) {
    out[tool] = n ? Math.round(sum / n) : 0;
  }
  return out;
}

export function buildTopFactualGaps(comparisons) {
  const rows = comparisons
    .map(c => ({
      c,
      score: Number(c.evaluation?.score) || 0,
      hasErrors: (c.evaluation?.factual_errors || []).length > 0,
      hasAccess: (c.evaluation?.access_or_visibility_issues || []).length > 0,
    }))
    .filter(r => r.score < 90 || r.hasErrors || r.hasAccess)
    .sort((a, b) => a.score - b.score);

  const gaps = [];
  for (const { c, score } of rows) {
    const ev = c.evaluation || {};
    const err = ev.factual_errors?.[0];
    const gapTitle =
      ev.primary_gap ||
      err ||
      (ev.access_or_visibility_issues?.[0] ? 'Site access blocked partial answer' : 'Incomplete vs ground truth');
    const evidenceParts = [];
    if (err) evidenceParts.push(err);
    for (const e of (ev.factual_errors || []).slice(1, 3)) evidenceParts.push(e);
    if (!evidenceParts.length && ev.summary) evidenceParts.push(ev.summary);
    evidenceParts.unshift(`${c.ai_tool} (row ${c.row_index + 1}, score ${score}): "${shortQuestion(c.input, 56)}"`);
    const recommendation =
      ev.site_fix_hint ||
      'Expose the missing field in static HTML and schema.org Product/Offer markup on the relevant model page.';
    gaps.push({
      gap: gapTitle.replace(/\s+/g, ' ').trim(),
      evidence: evidenceParts.join(' '),
      recommendation,
      related_ai_tools: [c.ai_tool].filter(Boolean),
      row_index: c.row_index,
    });
  }

  const seen = new Set();
  return gaps.filter(g => {
    const key = g.gap.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

export function buildThemes(comparisons) {
  const themes = [];
  for (const def of THEME_CATALOG) {
    const hits = comparisons.filter(def.match);
    if (!hits.length) continue;
    const tools = [...new Set(hits.map(h => h.ai_tool).filter(Boolean))];
    const examples = hits.slice(0, 3).map(h => h.row_index);
    themes.push({
      theme: def.theme,
      severity: def.severity,
      description: describeTheme(def.id, hits),
      affected_tools: tools,
      example_row_topics: examples,
    });
  }
  return themes;
}

function describeTheme(id, hits) {
  const samples = hits
    .filter(h => (h.evaluation?.score ?? 100) < 90)
    .map(h => h.evaluation?.primary_gap || h.evaluation?.summary)
    .filter(Boolean)
    .slice(0, 2)
    .join('; ');
  const byId = {
    catalogue_visibility:
      'Assistants often answer from homepage featured bikes instead of the full 18-model catalogue, so cheapest and price-range questions go wrong.',
    on_road_pricing:
      'On-road amounts vary by city; when city tables are not in crawlable markup, tools omit or guess Bangalore/Delhi figures.',
    structured_data:
      'Without consistent JSON-LD for price, mileage, colours, and variants, models rely on fragile HTML parsing.',
    crawler_access:
      'When a tool reports fetch failures or empty pages, ground truth from Firecrawl still has the data, indicating an AI-readability gap.',
    incomplete_pages:
      'Spec, colour, mileage, and similar-model questions need complete fields on each product URL.',
  };
  const base = byId[id] || '';
  return samples ? `${base} Observed: ${samples}` : base;
}

const REC_TEMPLATES = [
  {
    priority: 1,
    action:
      'Add schema.org Product + Offer JSON-LD on every model page with ex-showroom INR, variants, mileage, and colour list.',
    rationale: 'Gives LLMs a single authoritative price and spec source instead of scraping cards.',
    likely_impact: 'high',
    keywords: ['json', 'schema', 'structured', 'colour', 'mileage'],
  },
  {
    priority: 2,
    action:
      'Serve prerendered or static HTML snapshots for product URLs so crawlers do not depend on client-side rendering.',
    rationale: 'Reduces fetch failures and blank content reported by Claude and similar tools.',
    likely_impact: 'high',
    keywords: ['prerender', 'static', 'js', 'fetch', 'access'],
  },
  {
    priority: 3,
    action:
      'Publish a crawlable all-models price table (ex-showroom and on-road by city) linked from the homepage.',
    rationale: 'Stops cheapest/most-expensive errors when featured cards hide low-price models like Storm 125.',
    likely_impact: 'high',
    keywords: ['cheapest', 'catalogue', 'featured', 'storm 125', 'price list'],
  },
  {
    priority: 4,
    action:
      'Expose on_road_inr per city in visible markup and structured data for each model that supports city pricing.',
    rationale: 'Fixes missing Bangalore/Delhi on-road answers from Perplexity and Claude.',
    likely_impact: 'medium',
    keywords: ['on-road', 'on road', 'bangalore', 'delhi', 'city'],
  },
  {
    priority: 5,
    action:
      'Review robots.txt and allow major AI crawlers; verify product paths return 200 with full body text.',
    rationale: 'Ensures tools that browse the live site can reach the same pages Firecrawl captured.',
    likely_impact: 'medium',
    keywords: ['robots', 'crawler', 'fetch', 'firewall'],
  },
];

export function buildSiteRecommendations(comparisons) {
  const hintBlob = comparisons
    .map(c => `${c.evaluation?.site_fix_hint || ''} ${c.evaluation?.primary_gap || ''} ${(c.evaluation?.factual_errors || []).join(' ')}`)
    .join(' ')
    .toLowerCase();

  const recs = [];
  for (const t of REC_TEMPLATES) {
    const relevant = t.keywords.some(k => hintBlob.includes(k));
    recs.push({ ...t, _relevant: relevant });
  }
  recs.sort((a, b) => {
    if (a._relevant !== b._relevant) return a._relevant ? -1 : 1;
    return a.priority - b.priority;
  });
  return recs.slice(0, 5).map(({ priority, action, rationale, likely_impact }) => ({
    priority,
    action,
    rationale,
    likely_impact,
  }));
}

export function buildCrawlerNote(comparisons, factsMeta) {
  const access = comparisons.flatMap(c => c.evaluation?.access_or_visibility_issues || []);
  const tools = [...new Set(
    comparisons
      .filter(c => (c.evaluation?.access_or_visibility_issues || []).length > 0)
      .map(c => c.ai_tool),
  )];
  const pages = factsMeta?.pages_scraped ?? 'many';
  let note =
    `Firecrawl captured ${pages} pages from ${factsMeta?.source || 'the site'} (${factsMeta?.scraped_at || 'latest scrape'}), ` +
    'so ground truth is available even when an assistant cannot fetch a URL.';
  if (access.length) {
    note +=
      ` ${tools.join(', ') || 'Some tools'} reported access or visibility issues (${access.length} mention(s)), ` +
      'often consistent with JS-only content, blocked crawlers, or incomplete static markup.';
  } else {
    note +=
      ' Row audits did not flag explicit fetch failures, but missing JSON-LD and homepage-only context still drive factual gaps.';
  }
  note +=
    ' Prioritize structured data, static HTML, and a full-model price index to align live LLM browsing with scraped facts.';
  return note;
}

export function buildExecutiveSummary(comparisons, scoresByToolMap) {
  const total = comparisons.length;
  const avg = total
    ? Math.round(comparisons.reduce((s, c) => s + (Number(c.evaluation?.score) || 0), 0) / total)
    : 0;
  const weak = comparisons.filter(c => (Number(c.evaluation?.score) || 0) < 70);
  const tools = Object.entries(scoresByToolMap)
    .sort((a, b) => a[1] - b[1])
    .map(([t, s]) => `${t} ${s}/100`)
    .join(', ');
  const topGap = weak[0]?.evaluation?.primary_gap || buildTopFactualGaps(comparisons)[0]?.gap;
  return (
    `Across ${total} LLM test prompts, average factual alignment is ${avg}/100 (${tools}). ` +
    `${weak.length} answer(s) scored below 70, mainly around pricing, on-road city data, and product-page completeness. ` +
    (topGap ? `Highest-impact gap: ${topGap}.` : 'Site structured data and catalogue visibility are the main levers.')
  );
}

export function buildDeterministicGapAnalysis(comparisons, factsMeta) {
  const overall_scores_by_tool = scoresByTool(comparisons);
  return {
    executive_summary: buildExecutiveSummary(comparisons, overall_scores_by_tool),
    overall_scores_by_tool,
    themes: buildThemes(comparisons),
    top_factual_gaps: buildTopFactualGaps(comparisons),
    site_recommendations: buildSiteRecommendations(comparisons),
    crawler_and_llm_access: buildCrawlerNote(comparisons, factsMeta),
  };
}

/** Merge LLM polish into deterministic skeleton; never drop required sections. */
export function mergeGapAnalysis(deterministic, llmRaw, comparisons) {
  const base = { ...deterministic };
  if (!llmRaw || typeof llmRaw !== 'object') return base;

  if (typeof llmRaw.executive_summary === 'string' && llmRaw.executive_summary.length > 40) {
    base.executive_summary = llmRaw.executive_summary.replace(/\u2014/g, ', ').trim();
  }
  if (typeof llmRaw.crawler_and_llm_access === 'string' && llmRaw.crawler_and_llm_access.length > 60) {
    base.crawler_and_llm_access = llmRaw.crawler_and_llm_access.replace(/\u2014/g, ', ').trim();
  }

  const llmThemes = (llmRaw.themes || []).filter(t => t && typeof t === 'object' && t.theme);
  if (llmThemes.length >= base.themes.length) {
    base.themes = llmThemes.map(t => ({
      theme: t.theme,
      severity: t.severity || 'medium',
      description: t.description || '',
      affected_tools: Array.isArray(t.affected_tools) ? t.affected_tools : [],
      example_row_topics: Array.isArray(t.example_row_topics) ? t.example_row_topics : [],
    }));
  }

  const llmGaps = (llmRaw.top_factual_gaps || []).filter(g => g && g.gap);
  if (llmGaps.length >= Math.min(4, base.top_factual_gaps.length)) {
    base.top_factual_gaps = llmGaps.slice(0, 6);
  }

  const llmRecs = (llmRaw.site_recommendations || []).filter(r => r && r.action);
  if (llmRecs.length >= 4) {
    base.site_recommendations = llmRecs
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .slice(0, 5)
      .map(r => ({
        priority: r.priority,
        action: r.action,
        rationale: r.rationale || '',
        likely_impact: (r.likely_impact || 'medium').toLowerCase().replace(/^high.*/i, 'high').replace(/^low.*/i, 'low') || 'medium',
      }));
  }

  base.overall_scores_by_tool = scoresByTool(comparisons);
  return base;
}
