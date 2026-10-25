const API_BASE = 'https://api.render.com/v1';
const MAX_PAGE_SIZE = 200;
const MAX_PAGES_FULL_SYNC = 30;

let cachedOwnerId = null;

async function renderFetch(path, apiKey, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.append(key, String(value));
    }
  }
  const url = `${API_BASE}${path}${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const msg = body?.message || body?.error || res.statusText;
    throw new Error(`Render API ${res.status}: ${msg}`);
  }
  return body;
}

export async function resolveOwnerId(apiKey, explicitOwnerId) {
  if (explicitOwnerId) return explicitOwnerId;
  if (cachedOwnerId) return cachedOwnerId;

  const data = await renderFetch('/owners', apiKey, { limit: '20' });
  const list = Array.isArray(data) ? data : data?.owners || [];
  let first;
  for (const item of list) {
    const id = item?.owner?.id ?? item?.id;
    if (id && String(id).startsWith('tea-')) {
      first = id;
      break;
    }
  }
  first = first || list[0]?.owner?.id || list[0]?.id;
  if (!first) {
    throw new Error(
      'Could not detect RENDER_OWNER_ID. Set it in .env (workspace id from Render dashboard).'
    );
  }
  cachedOwnerId = first;
  return first;
}

function windowBounds(hours) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return { start, end };
}

async function fetchLogsPage(apiKey, owner, serviceId, startTime, endTime, limit) {
  return renderFetch('/logs', apiKey, {
    ownerId: owner,
    resource: serviceId,
    startTime,
    endTime,
    direction: 'backward',
    limit: String(Math.min(limit, MAX_PAGE_SIZE)),
    type: 'app',
  });
}

/**
 * @param {{ apiKey: string, serviceId: string, ownerId?: string, hours?: number, limit?: number, paginate?: boolean }} opts
 */
export async function fetchServiceLogs(opts) {
  const { apiKey, serviceId, ownerId, hours = 24, limit = 200, paginate = false } = opts;
  const owner = await resolveOwnerId(apiKey, ownerId);
  const { start, end } = windowBounds(hours);

  let startTime = start.toISOString();
  let endTime = end.toISOString();
  const allLogs = [];
  let pages = 0;
  let hasMore = false;

  do {
    const data = await fetchLogsPage(apiKey, owner, serviceId, startTime, endTime, limit);
    const batch = data.logs || [];
    allLogs.push(...batch);
    hasMore = Boolean(data.hasMore);
    pages += 1;

    if (!paginate || !hasMore || pages >= MAX_PAGES_FULL_SYNC) {
      return {
        logs: allLogs,
        hasMore: paginate && hasMore && pages >= MAX_PAGES_FULL_SYNC,
        pagesFetched: pages,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
      };
    }

    if (data.nextStartTime && data.nextEndTime) {
      startTime = data.nextStartTime;
      endTime = data.nextEndTime;
    } else {
      break;
    }
  } while (hasMore);

  return {
    logs: allLogs,
    hasMore: false,
    pagesFetched: pages,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}
