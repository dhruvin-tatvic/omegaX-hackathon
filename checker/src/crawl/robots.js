export function parseRobots(text) {
  const groups = [];
  let current = { agents: [], rules: [] };
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (current.rules.length || current.agents.length > 1) {
        groups.push(current);
        current = { agents: [value.toLowerCase()], rules: [] };
      } else {
        current.agents.push(value.toLowerCase());
      }
    } else if (key === 'disallow' || key === 'allow') {
      current.rules.push({ type: key, path: value || '/' });
    }
  }
  if (current.agents.length) groups.push(current);
  return groups;
}

export function isPathAllowed(pathname, robotsText, userAgent = 'AIAnswerChecker/0.1') {
  if (!robotsText) return true;
  const groups = parseRobots(robotsText);
  const ua = userAgent.toLowerCase();
  const matching =
    groups.find((g) => g.agents.some((a) => a !== '*' && ua.includes(a))) ||
    groups.find((g) => g.agents.includes('*'));
  if (!matching) return true;
  let allowed = true;
  for (const rule of matching.rules) {
    if (!rule.path) continue;
    if (pathname.startsWith(rule.path) || rule.path === '/') {
      allowed = rule.type === 'allow';
    }
  }
  return allowed;
}

export function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    locs.push(match[1].trim());
  }
  return locs;
}
