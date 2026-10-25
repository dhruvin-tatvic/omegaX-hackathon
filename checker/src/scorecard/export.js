import { SCORECARD_CATEGORIES } from './build.js';

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function scorecardToCsv(scorecard) {
  const header = [
    'question_id',
    'status',
    'expected_fact',
    'website_evidence_status',
    'evidence_source',
    'affected_url',
    'ai_answer_status',
    'ai_answer',
    'explanation',
  ];
  const lines = [header.join(',')];
  for (const row of scorecard.rows || []) {
    lines.push(
      [
        row.question_id,
        row.status,
        row.expected_fact,
        row.website_evidence?.status,
        row.evidence_source,
        row.affected_url,
        row.ai_answer?.label || row.ai_answer?.status,
        row.ai_answer?.text,
        row.explanation,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  lines.push('');
  lines.push(`totals_questions,${scorecard.totals?.questions ?? 0}`);
  for (const key of SCORECARD_CATEGORIES) {
    lines.push(`totals_${key},${scorecard.totals?.[key] ?? 0},${scorecard.percentages?.[key] ?? 0}%`);
  }
  return `${lines.join('\n')}\n`;
}
