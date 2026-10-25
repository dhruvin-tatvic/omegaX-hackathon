import { evaluateAnswer } from './evaluation/evaluate.js';
import { collectManualAnswer } from './providers/manual.js';
import { collectOpenAiAnswer } from './providers/openai.js';
import { assertPromptSafe, buildPrompt } from './prompt.js';

function forbiddenReferenceValues(referencePack) {
  const values = [];
  for (const entity of referencePack?.entities || []) {
    for (const fact of entity.facts || []) {
      if (fact.type === 'number') values.push(String(fact.value));
    }
  }
  return values;
}

export async function runTest({
  config,
  store,
  question,
  method,
  answerText,
  fetchImpl,
}) {
  const started_at = new Date().toISOString();
  const targetUrl = config.target.base_url;
  const referencePack = config.referencePack;

  let collected;
  if (method === 'api') {
    const prompt = buildPrompt({ question: question.text, targetUrl });
    assertPromptSafe(prompt, forbiddenReferenceValues(referencePack));
    collected = await collectOpenAiAnswer({
      question: question.text,
      targetUrl,
      openai: config.openai,
      limits: config.limits,
      fetchImpl,
    });
  } else {
    collected = await collectManualAnswer({
      answerText,
      limits: config.limits,
    });
  }

  const evaluation = evaluateAnswer({
    question,
    answerText: collected.raw_text,
    referencePack,
    collectionError: collected.ok ? null : collected.error,
  });

  const status = collected.ok && evaluation.complete ? 'completed' : 'incomplete';

  const run = {
    website_id: config.target.id,
    target_url: targetUrl,
    scenario_id: null,
    started_at,
    finished_at: new Date().toISOString(),
    provider: collected.provider,
    model: collected.model,
    method: collected.method,
    status,
    question: {
      id: question.id,
      text: question.text,
      related_urls: question.related_urls || [],
      entity_ids: question.entity_ids || [],
      fact_keys: question.fact_keys || [],
    },
    answer: {
      raw_text: collected.raw_text,
      citations: collected.citations,
      error: collected.error,
      latency_ms: collected.latency_ms,
      prompt: collected.prompt || null,
    },
    evaluation,
    reference_source_id: referencePack?.source_id || null,
    config_snapshot: {
      target_url: targetUrl,
      model: config.openai.model,
      method: collected.method,
      pack: config.packId || null,
    },
  };

  return store.save(run);
}
