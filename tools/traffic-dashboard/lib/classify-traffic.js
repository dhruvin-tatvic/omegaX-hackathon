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
