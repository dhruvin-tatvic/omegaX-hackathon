const BOT_RULES = [
  { test: /ChatGPT-User|GPTBot|OAI-SearchBot/i, label: 'OpenAI' },
  { test: /ExaUser|exa\.ai/i, label: 'Exa' },
  { test: /PerplexityBot|Perplexity-User/i, label: 'Perplexity' },
  { test: /ClaudeBot|anthropic/i, label: 'Anthropic' },
  { test: /Googlebot|Google-Extended|Gemini/i, label: 'Google' },
  { test: /bingbot|BingPreview/i, label: 'Bing' },
  { test: /facebookexternalhit|Facebot/i, label: 'Meta' },
  { test: /DuckDuckBot/i, label: 'DuckDuckGo' },
  { test: /Applebot/i, label: 'Apple' },
  { test: /Bytespider/i, label: 'ByteDance' },
  { test: /curl\/|wget\/|python-requests|Go-http-client|Java\/|libwww-perl/i, label: 'Script' },
  { test: /\b(bot|crawler|spider|scraper)\b/i, label: 'Bot' },
  { test: /compatible;\s*[^)]*bot/i, label: 'Bot' },
  { test: /HeadlessChrome/i, label: 'Headless' },
];

/**
 * @returns {{ kind: 'bot' | 'human' | 'unknown', botLabel: string | null }}
 */
/** Known AI / search crawlers (User-Agent substring → metadata). */
const CRAWLER_SIGNATURES = [
  { test: /ChatGPT-User/i, provider: 'OpenAI', crawler: 'ChatGPT-User', fetchType: 'Live browse (chat answer)' },
  { test: /GPTBot/i, provider: 'OpenAI', crawler: 'GPTBot', fetchType: 'OpenAI training / indexing' },
  { test: /OAI-SearchBot/i, provider: 'OpenAI', crawler: 'OAI-SearchBot', fetchType: 'OpenAI search' },
  { test: /ExaUser/i, provider: 'Exa', crawler: 'ExaUser', fetchType: 'AI search retrieval (e.g. Perplexity partner)' },
  { test: /PerplexityBot/i, provider: 'Perplexity', crawler: 'PerplexityBot', fetchType: 'Perplexity indexer' },
  { test: /Perplexity-User/i, provider: 'Perplexity', crawler: 'Perplexity-User', fetchType: 'Live browse (Perplexity answer)' },
  { test: /ClaudeBot/i, provider: 'Anthropic', crawler: 'ClaudeBot', fetchType: 'Anthropic indexer' },
  { test: /anthropic-ai/i, provider: 'Anthropic', crawler: 'anthropic-ai', fetchType: 'Anthropic fetch' },
  { test: /Googlebot/i, provider: 'Google', crawler: 'Googlebot', fetchType: 'Google Search crawl' },
  { test: /Google-Extended/i, provider: 'Google', crawler: 'Google-Extended', fetchType: 'Google AI / Gemini training opt-in' },
  { test: /Gemini/i, provider: 'Google', crawler: 'Gemini', fetchType: 'Google Gemini related' },
  { test: /bingbot/i, provider: 'Microsoft', crawler: 'bingbot', fetchType: 'Bing / Copilot index' },
  { test: /Bytespider/i, provider: 'ByteDance', crawler: 'Bytespider', fetchType: 'TikTok / AI index' },
  { test: /Applebot/i, provider: 'Apple', crawler: 'Applebot', fetchType: 'Apple Intelligence / Siri index' },
  { test: /facebookexternalhit/i, provider: 'Meta', crawler: 'facebookexternalhit', fetchType: 'Link preview' },
  { test: /HeadlessChrome/i, provider: 'Automated', crawler: 'HeadlessChrome', fetchType: 'Headless browser (often automation)' },
];

/**
 * @returns {{ provider: string, crawler: string, fetchType: string } | null}
 */
export function describeAiCrawler(userAgent) {
  if (!userAgent) return null;
  const ua = String(userAgent);
  for (const sig of CRAWLER_SIGNATURES) {
    if (sig.test.test(ua)) {
      return { provider: sig.provider, crawler: sig.crawler, fetchType: sig.fetchType };
    }
  }
  if (/\b(bot|crawler|spider)\b/i.test(ua)) {
    return { provider: 'Other', crawler: 'Generic bot', fetchType: 'Unclassified crawler' };
  }
  return null;
}

export function classifyTraffic(userAgent) {
  if (!userAgent || !String(userAgent).trim()) {
    return { kind: 'unknown', botLabel: null };
  }
  const ua = String(userAgent);
  for (const rule of BOT_RULES) {
    if (rule.test.test(ua)) {
      return { kind: 'bot', botLabel: rule.label };
    }
  }
  if (/Mozilla\/5\.0/.test(ua) && /(Chrome|Firefox|Safari|Edg)\//.test(ua)) {
    return { kind: 'human', botLabel: null };
  }
  return { kind: 'unknown', botLabel: null };
}
