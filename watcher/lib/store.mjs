// watcher/lib/store.mjs — خواندن/نوشتن فایل‌های data/
import fs from 'node:fs/promises';
import path from 'node:path';

export const dirOf = (root, username) => path.join(root, 'data', 'c', username);
export const stateFile = (dir) => path.join(dir, 'state.json');
export const latestFile = (dir) => path.join(dir, 'latest.json');
export const metaFile = (dir) => path.join(dir, 'meta.ndjson');
export const snapshotFile = (dir, ms) =>
  path.join(dir, 'snapshots', `${new Date(ms).toISOString().slice(0, 7)}.ndjson`);

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

export async function appendNdjson(file, rows) {
  if (!rows.length) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
