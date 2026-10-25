import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function createFileStore(runsDir) {
  fs.mkdirSync(runsDir, { recursive: true });

  function fileFor(id) {
    return path.join(runsDir, `${id}.json`);
  }

  return {
    async save(run) {
      const record = { id: run.id || randomUUID(), ...run };
      fs.writeFileSync(fileFor(record.id), JSON.stringify(record, null, 2));
      return record;
    },
    async get(id) {
      const file = fileFor(id);
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    },
    async list() {
      const files = fs.readdirSync(runsDir).filter((f) => f.endsWith('.json'));
      const rows = files.map((f) => JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8')));
      return rows.sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    },
  };
}

export function createMemoryStore(seed = []) {
  const map = new Map(seed.map((row) => [row.id, row]));
  return {
    async save(run) {
      const record = { id: run.id || randomUUID(), ...run };
      map.set(record.id, record);
      return record;
    },
    async get(id) {
      return map.get(id) || null;
    },
    async list() {
      return [...map.values()].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    },
  };
}
