export function ga4NotConnected() {
  return {
    status: 'not_connected',
    connected: false,
    synthetic: false,
    label: null,
    records: [],
    message:
      'GA4 is not connected. No credentials or referral/session/conversion export have been imported. This is not a live Google Analytics integration.',
    join: {
      status: 'not_joined',
      note: 'Log facts and GA4 rows are kept separate. Joining is a later step and is not inferred.',
    },
    limitations: [
      'Empty GA4 state does not mean zero referrals or conversions.',
      'Do not treat this as live GA4 data.',
    ],
  };
}

export function importGa4Export(payload = {}) {
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.records)
      ? payload.records
      : [];
  const synthetic = Boolean(payload.synthetic) || records.some((row) => row?.synthetic);
  const label = synthetic
    ? payload.label || 'SYNTHETIC DEMO DATA'
    : payload.label || 'Imported GA4 export';
  if (!records.length && !payload.force) {
    return ga4NotConnected();
  }
  return {
    status: synthetic ? 'demo_data' : 'imported_export',
    connected: false,
    synthetic,
    label: synthetic ? `SYNTHETIC DEMO DATA — ${label}` : label,
    records: records.map((row) => ({
      source: row.source || row.sessionSource || null,
      medium: row.medium || row.sessionMedium || null,
      landing_page: row.landing_page || row.landingPage || row.page || null,
      sessions: Number(row.sessions) || 0,
      conversions: Number(row.conversions) || 0,
      synthetic: synthetic || Boolean(row.synthetic),
    })),
    message: synthetic
      ? 'SYNTHETIC DEMO DATA. These analytics rows are not real GA4 results and are stored separately from access-log facts.'
      : 'Imported GA4 export accepted. Not a live API connection. Not yet joined to log facts.',
    join: {
      status: 'not_joined',
      note: 'Joining referrals to crawler requests is not performed in this milestone.',
    },
    limitations: [
      'This seam accepts a JSON export. It does not call the Google Analytics Data API.',
      'Synthetic GA4 rows must stay labelled and must not be added to observed log counts.',
    ],
  };
}
