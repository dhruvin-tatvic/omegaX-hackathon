/** Morgan combined format from sample-website/server.js */
const ACCESS_RE =
  /^(\S+) - (\S+) (\S+) (\d{3}) - "(.+)"$/;

/**
 * @param {string} message
 * @returns {object | null}
 */
export function parseAccessLogLine(message) {
  if (!message) return null;
  const line = message.trim();
  const m = line.match(ACCESS_RE);
  if (!m) return null;
  return {
    ip: m[1],
    method: m[2],
    path: m[3],
    status: Number(m[4]),
    userAgent: m[5],
  };
}
