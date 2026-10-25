export const CLASSIFICATION_COLUMNS = [
  'Classification',
  'Client IP',
  'User-Agent',
  'Confidence',
  'Evidence',
  'Requests',
  'Distinct URLs',
];

export function formatEvidenceItems(evidence) {
  return (evidence || [])
    .map((item) => {
      const detail = item.detail || item.signal || '';
      if (!detail) return '';
      return item.layer ? `${item.layer}: ${detail}` : detail;
    })
    .filter(Boolean);
}

export function classificationRow(agent = {}) {
  return {
    classification: agent.label || '',
    client_ip: agent.client_ip || '',
    user_agent: agent.user_agent || '',
    confidence: agent.confidence || '',
    reasoning: agent.reasoning || '',
    evidence: formatEvidenceItems(agent.evidence),
    requests: agent.behavior?.request_count ?? 0,
    distinct_urls: agent.behavior?.distinct_urls ?? 0,
  };
}

export function classificationCells(agent) {
  const row = classificationRow(agent);
  return [
    row.classification,
    row.client_ip,
    row.user_agent,
    row.confidence,
    row.evidence.join('; '),
    row.requests,
    row.distinct_urls,
  ];
}
