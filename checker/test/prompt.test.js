import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertPromptSafe, buildPrompt } from '../src/prompt.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoReference = JSON.parse(readFileSync(path.join(root, 'data/reference/demo.json'), 'utf8'));

describe('buildPrompt', () => {
  it('includes the question and target URL only', () => {
    const prompt = buildPrompt({
      question: 'What is the ex-showroom price of the Acme Pump 200 in INR?',
      targetUrl: 'https://example.com',
    });
    expect(prompt.user).toContain('https://example.com');
    expect(prompt.user).toContain('What is the ex-showroom price');
    const forbidden = demoReference.entities.flatMap((e) =>
      e.facts.filter((f) => f.type === 'number').map((f) => String(f.value))
    );
    expect(() => assertPromptSafe(prompt, forbidden)).not.toThrow();
  });

  it('fails closed if a reference value is present', () => {
    const prompt = buildPrompt({
      question: 'Is the price 420000?',
      targetUrl: 'https://example.com',
    });
    expect(() => assertPromptSafe(prompt, ['420000'])).toThrow(/leaked/);
  });
});
