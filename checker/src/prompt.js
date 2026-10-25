/**
 * Build the prompt for the model under test.
 * Reference facts and expected answers must never appear here.
 */
export function buildPrompt({ question, targetUrl }) {
  if (!question || !String(question).trim()) {
    throw new Error('Question is required');
  }

  return {
    system:
      'You answer questions about information published on a public website. If you are not sure, say so clearly. Do not invent exact figures. Do not claim you visited a page unless you actually have access to it.',
    user: `Website: ${targetUrl}\n\nQuestion: ${String(question).trim()}`,
  };
}

export function assertPromptSafe(prompt, forbiddenValues = []) {
  const blob = `${prompt.system}\n${prompt.user}`;
  for (const value of forbiddenValues) {
    if (value == null || value === '') continue;
    const needle = String(value);
    if (needle.length < 3) continue;
    if (blob.includes(needle)) {
      throw new Error('Prompt builder leaked a reference value to the model under test');
    }
  }
}
