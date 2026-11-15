// watcher/lib/compact.mjs — ماه‌های قدیمی را به یک ردیف در روز فشرده می‌کند.
// ۷ روز آخر با دقت ساعتی می‌ماند؛ قدیمی‌تر روزانه. بدون این، فایل‌ها سالانه ده‌ها مگابایت می‌شوند.
import fs from 'node:fs/promises';
import path from 'node:path';

const DAY = 86400_000;
const KEEP_HOURLY_DAYS = 7;

/** خروجی: تعداد فایل‌های فشرده‌شده */
export async function compact(dir, now = Date.now()) {
  const snapDir = path.join(dir, 'snapshots');
  let files;
  try {
    files = await fs.readdir(snapDir);
  } catch {
    return 0;
  }

  let compacted = 0;
  for (const name of files) {
    if (!name.endsWith('.ndjson')) continue;
    const [y, m] = name.slice(0, 7).split('-').map(Number);
    if (!y || !m) continue;
    const monthEnd = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);
    if (now < monthEnd + KEEP_HOURLY_DAYS * DAY) continue; // هنوز تازه است

    const file = path.join(snapDir, name);
    const rows = (await fs.readFile(file, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });

    const lastOfDay = new Map();
    for (const r of rows) {
      const day = new Date(r.t * 1000).toISOString().slice(0, 10);
      lastOfDay.set(`${r.h}|${day}`, r); // آخرین ردیف هر روز برنده است
    }
    if (lastOfDay.size === rows.length) continue; // قبلاً فشرده شده

    const kept = [...lastOfDay.values()].sort((a, b) => a.t - b.t);
    await fs.writeFile(file, kept.map((r) => JSON.stringify(r)).join('\n') + '\n');
    compacted++;
  }
  return compacted;
}
