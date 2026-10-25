export function createCrawlRegistry() {
  const byOrigin = new Map();
  return {
    save(session) {
      byOrigin.set(session.origin, session);
      return session;
    },
    get(origin) {
      return byOrigin.get(origin) || null;
    },
    clear(origin) {
      byOrigin.delete(origin);
    },
    list() {
      return [...byOrigin.values()].map((s) => ({
        origin: s.origin,
        crawled_at: s.crawled_at,
        pages_visited: s.pages_visited.length,
      }));
    },
  };
}
