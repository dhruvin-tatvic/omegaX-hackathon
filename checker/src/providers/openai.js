import { buildPrompt } from '../prompt.js';

export async function collectOpenAiAnswer({
  question,
  targetUrl,
  openai,
  limits,
  fetchImpl = fetch,
}) {
  if (!openai?.apiKey) {
    return {
      ok: false,
      method: 'api',
      provider: 'openai_chat',
      model: openai?.model || null,
      raw_text: '',
      raw_payload: null,
      citations: [],
      error: 'OPENAI_API_KEY is not set',
      latency_ms: 0,
    };
  }

  const prompt = buildPrompt({ question, targetUrl });
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), limits?.timeout_ms || 30000);

  try {
    const response = await fetchImpl(`${openai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openai.model,
        temperature: 0,
        max_tokens: limits?.max_tokens || 800,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);
    const latency_ms = Date.now() - started;

    if (!response.ok) {
      const message =
        payload?.error?.message || `Provider HTTP ${response.status}`;
      return {
        ok: false,
        method: 'api',
        provider: 'openai_chat',
        model: openai.model,
        raw_text: '',
        raw_payload: payload,
        citations: [],
        error: message,
        latency_ms,
        prompt,
      };
    }

    const raw_text = payload?.choices?.[0]?.message?.content || '';
    if (!String(raw_text).trim()) {
      return {
        ok: false,
        method: 'api',
        provider: 'openai_chat',
        model: openai.model,
        raw_text: '',
        raw_payload: payload,
        citations: [],
        error: 'Provider returned an empty answer',
        latency_ms,
        prompt,
      };
    }

    return {
      ok: true,
      method: 'api',
      provider: 'openai_chat',
      model: payload?.model || openai.model,
      raw_text,
      raw_payload: payload,
      citations: [],
      error: null,
      latency_ms,
      prompt,
    };
  } catch (err) {
    return {
      ok: false,
      method: 'api',
      provider: 'openai_chat',
      model: openai.model,
      raw_text: '',
      raw_payload: null,
      citations: [],
      error: err.name === 'AbortError' ? 'Provider request timed out' : err.message,
      latency_ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}
