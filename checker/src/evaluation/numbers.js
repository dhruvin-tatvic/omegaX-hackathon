export function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null) return null;
  const stripped = String(value).replace(/[₹$€£,\s]/g, '');
  const match = stripped.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

export function extractNumbers(text) {
  if (!text) return [];
  const found = [];
  const re = /(?:₹|INR|Rs\.?)?\s*[\d,]+(?:\.\d+)?/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const num = parseNumber(match[0]);
    if (num != null) found.push(num);
  }
  return found;
}

export function numbersEqual(a, b, epsilon = 0.0001) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= epsilon;
}

/** Prefer currency-like amounts so model names (350, 650) are not treated as prices. */
export function extractMoneyNumbers(text) {
  if (!text) return [];
  const found = [];
  const re = /(?:₹|INR|Rs\.?)\s*[\d,]+(?:\.\d+)?/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const num = parseNumber(match[0]);
    if (num != null) found.push(num);
  }
  if (found.length) return found;
  return extractNumbers(text).filter((n) => n >= 1000 && !(n >= 1900 && n <= 2100));
}
