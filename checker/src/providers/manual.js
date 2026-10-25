export async function collectManualAnswer({ answerText, limits }) {
  const text = answerText == null ? '' : String(answerText);
  if (!text.trim()) {
    return {
      ok: false,
      method: 'manual',
      provider: 'manual',
      model: null,
      raw_text: '',
      raw_payload: { source: 'manual' },
      citations: [],
      error: 'Pasted answer is empty',
      latency_ms: 0,
    };
  }
  if (limits?.max_answer_chars && text.length > limits.max_answer_chars) {
    return {
      ok: false,
      method: 'manual',
      provider: 'manual',
      model: null,
      raw_text: text,
      raw_payload: { source: 'manual' },
      citations: [],
      error: 'Pasted answer exceeds the configured size limit',
      latency_ms: 0,
    };
  }
  return {
    ok: true,
    method: 'manual',
    provider: 'manual',
    model: null,
    raw_text: text,
    raw_payload: { source: 'manual' },
    citations: [],
    error: null,
    latency_ms: 0,
  };
}
