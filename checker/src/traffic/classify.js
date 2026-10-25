const KNOWN_AI_FAMILIES = [
  { family: 'GPTBot', pattern: /\bgptbot\b/i, docs: /openai\.com/i },
  { family: 'ChatGPT-User', pattern: /\bchatgpt-user\b/i, docs: /openai\.com/i },
  { family: 'OAI-SearchBot', pattern: /\boai-searchbot\b/i, docs: /openai\.com/i },
  { family: 'ClaudeBot', pattern: /\bclaudebot\b/i, docs: /anthropic\.com/i },
  { family: 'anthropic-ai', pattern: /\banthropic-ai\b/i, docs: /anthropic\.com/i },
  { family: 'PerplexityBot', pattern: /\bperplexitybot\b/i, docs: /perplexity\.ai/i },
  { family: 'Bytespider', pattern: /\bbytespider\b/i, docs: /bytedance/i },
  { family: 'Amazonbot', pattern: /\bamazonbot\b/i, docs: /amazon\.com/i },
  { family: 'Applebot-Extended', pattern: /\bapplebot-extended\b/i, docs: /apple\.com/i },
  { family: 'Google-Extended', pattern: /\bgoogle-extended\b/i, docs: /google\.com/i },
  { family: 'CCBot', pattern: /\bccbot\b/i, docs: /commoncrawl\.org/i },
  { family: 'meta-externalagent', pattern: /\bmeta-externalagent\b/i, docs: /facebook\.com|meta\.com/i },
  { family: 'YouBot', pattern: /\byoubot\b/i, docs: /you\.com/i },
  { family: 'cohere-ai', pattern: /\bcohere-ai\b/i, docs: /cohere\.com/i },
];

const LOOKALIKE_HINT = /gptbot|chatgpt|claudebot|perplexitybot|anthropic|bytespider/i;
const BROWSER_HINT = /mozilla\/5\.0|applewebkit|chrome\/\d|safari\/\d|firefox\/\d/i;
const SEARCH_REFERER = /google\.|bing\.|duckduckgo\./i;

function unique(values) {
  return [...new Set(values)];
}

export function matchUserAgentFamily(userAgent) {
  const ua = String(userAgent || '');
  const known = KNOWN_AI_FAMILIES.find((row) => row.pattern.test(ua));
  if (known) {
    return {
      kind: 'known_ai_family',
      family: known.family,
      official_docs_url_present: known.docs.test(ua),
      lookalike: false,
    };
  }
  const lookalike = LOOKALIKE_HINT.test(ua) && BROWSER_HINT.test(ua);
  return {
    kind: lookalike ? 'lookalike' : 'unlisted',
    family: null,
    official_docs_url_present: false,
    lookalike,
  };
}

export function behaviorSignals(requests) {
  const list = requests || [];
  const n = list.length;
  const paths = unique(list.map((row) => row.path));
  const timestamps = list.map((row) => (row.ts ? Date.parse(row.ts) : null)).filter((ms) => Number.isFinite(ms));
  const durationMs = timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;
  const burst = n >= 3 && (durationMs === 0 || durationMs <= 120000);
  const robots = paths.some((path) => /^\/robots\.txt$/i.test(path));
  const repeats = paths.reduce((max, path) => {
    const count = list.filter((row) => row.path === path).length;
    return Math.max(max, count);
  }, 0);
  const errorCount = list.filter((row) => row.status >= 400).length;
  const humanReferer = list.some((row) => row.referer && SEARCH_REFERER.test(row.referer));
  let score = 0;
  const evidence = [];
  if (n >= 5) {
    score += 2;
    evidence.push({ signal: 'request_volume', detail: `${n} requests from this client`, layer: 'behavior' });
  }
  if (paths.length >= 4) {
    score += 2;
    evidence.push({ signal: 'path_breadth', detail: `${paths.length} distinct paths`, layer: 'behavior' });
  }
  if (robots) {
    score += 1;
    evidence.push({ signal: 'robots_txt', detail: 'Requested /robots.txt', layer: 'behavior' });
  }
  if (burst) {
    score += 2;
    evidence.push({
      signal: 'burst',
      detail: durationMs ? `${n} requests in ${Math.round(durationMs / 1000)}s` : `${n} requests without timestamps`,
      layer: 'behavior',
    });
  }
  if (repeats >= 3) {
    score += 1;
    evidence.push({ signal: 'repetition', detail: `Same path requested ${repeats} times`, layer: 'behavior' });
  }
  return {
    request_count: n,
    distinct_urls: paths.length,
    duration_ms: durationMs,
    robots_txt: robots,
    max_path_repeats: repeats,
    error_count: errorCount,
    human_referer: humanReferer,
    crawler_like: score >= 3,
    human_like: n <= 2 && (humanReferer || !burst),
    score,
    evidence,
  };
}

export function classifyAgent(requests) {
  const list = requests || [];
  const ua = list[0]?.user_agent || '';
  const uaMatch = matchUserAgentFamily(ua);
  const behavior = behaviorSignals(list);
  const evidence = [];
  if (uaMatch.kind === 'known_ai_family') {
    evidence.push({
      signal: 'user_agent_family',
      detail: `User-agent token matches ${uaMatch.family}. This is a candidate signal only.`,
      layer: 'user_agent',
    });
    if (uaMatch.official_docs_url_present) {
      evidence.push({
        signal: 'documentation_url',
        detail: 'User-agent includes a vendor documentation URL.',
        layer: 'user_agent',
      });
    }
  } else if (uaMatch.lookalike) {
    evidence.push({
      signal: 'lookalike_user_agent',
      detail: 'User-agent contains an AI-crawler-like substring inside a browser-like string.',
      layer: 'user_agent',
    });
  }
  evidence.push(...behavior.evidence);

  let label = 'ordinary_traffic';
  let confidence = 'low';
  let reasoning = 'No strong crawler behavior and no known AI crawler family.';

  if (uaMatch.kind === 'known_ai_family' && behavior.crawler_like) {
    label = 'known_ai_crawler';
    confidence = uaMatch.official_docs_url_present ? 'high' : 'medium';
    reasoning =
      'Known AI crawler family token plus crawler-like behavior (volume, paths, robots.txt, burst, or repetition). User-agent substring alone is not treated as proof.';
  } else if (uaMatch.kind === 'known_ai_family' && !behavior.crawler_like) {
    label = 'needs_review';
    confidence = 'low';
    reasoning =
      'A known AI crawler token is present, but request behavior is not crawler-like. User-agent alone is not enough to classify this as AI traffic.';
  } else if (uaMatch.lookalike && !behavior.crawler_like) {
    label = 'lookalike_not_ai';
    confidence = 'medium';
    reasoning =
      'The user-agent looks similar to an AI crawler but browser tokens and human-like request behavior argue against an automatic AI classification.';
  } else if (uaMatch.lookalike && behavior.crawler_like) {
    label = 'needs_review';
    confidence = 'medium';
    reasoning =
      'Lookalike user-agent plus crawler-like behavior. Needs review; not labelled as a known AI crawler.';
  } else if (behavior.crawler_like) {
    label = 'unknown_suspicious_crawler';
    confidence = behavior.score >= 5 ? 'high' : 'medium';
    reasoning =
      'No known AI crawler family, but request frequency, path breadth, repetition, or robots.txt fetching is crawler-like.';
  }

  return {
    client_ip: list[0]?.ip || 'unknown',
    user_agent: ua,
    label,
    confidence,
    reasoning,
    ua_match: uaMatch,
    behavior: {
      request_count: behavior.request_count,
      distinct_urls: behavior.distinct_urls,
      robots_txt: behavior.robots_txt,
      max_path_repeats: behavior.max_path_repeats,
      error_count: behavior.error_count,
      crawler_like: behavior.crawler_like,
      human_like: behavior.human_like,
      score: behavior.score,
    },
    evidence,
    visit_does_not_imply_citation: true,
    layer: 'inference',
  };
}

export function classifyClients(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = `${row.ip}\t${row.user_agent}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()]
    .map((list) => ({
      ...classifyAgent(list),
      sample_paths: unique(list.map((row) => row.path)).slice(0, 8),
      statuses: list.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {}),
      first_ts: list.map((row) => row.ts).filter(Boolean).sort()[0] || null,
      last_ts: list.map((row) => row.ts).filter(Boolean).sort().at(-1) || null,
    }))
    .sort((a, b) => b.behavior.request_count - a.behavior.request_count);
}
