export function collapseText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function renderedOnlySnippets(rawText, renderedText, { minLength = 24 } = {}) {
  const raw = collapseText(rawText).toLowerCase();
  const rendered = collapseText(renderedText);
  if (!rendered) return [];
  const parts = rendered
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => collapseText(part))
    .filter((part) => part.length >= minLength);
  const extras = [];
  for (const part of parts) {
    if (!raw.includes(part.toLowerCase())) extras.push(part);
  }
  if (!extras.length && rendered.length > collapseText(rawText).length + 80) {
    extras.push(rendered.slice(0, 280));
  }
  return extras.slice(0, 8);
}
