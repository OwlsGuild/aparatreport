// lib/history.js — خواندن تاریخ اسنپشات‌ها از مخزن گیت (فایل‌های data/).
// فقط دستور /changes و /top 24h|7d به این وابسته‌اند؛ اگر HISTORY_BASE خالی باشد
// بقیهٔ ربات کامل کار می‌کند.

import { fetch as http } from 'sdk';
import { HISTORY_BASE } from './config.js';
import { cached } from './cache.js';

const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);

async function readMonth(channel, month) {
  const url = `${HISTORY_BASE}/c/${channel}/snapshots/${month}.ndjson`;
  return cached(`snap:${channel}:${month}`, 600, async () => {
    const res = await http(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`history ${res.status}`);
    const rows = [];
    for (const line of (await res.text()).split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        // خط خراب را رد کن
      }
    }
    return rows;
  });
}

/**
 * وضعیت هر ویدیو در نزدیک‌ترین اسنپشات پیش از `windowSeconds` قبل.
 * خروجی: { hash: { t, v, l } } یا null اگر تاریخ در دسترس نباشد.
 */
export async function baseline(channel, windowSeconds) {
  if (!HISTORY_BASE) return null;
  const now = Date.now();
  const cutoff = Math.floor(now / 1000) - windowSeconds;
  const months = [...new Set([monthOf(now), monthOf(cutoff * 1000)])];

  let rows;
  try {
    rows = (await Promise.all(months.map((m) => readMonth(channel, m)))).flat();
  } catch {
    return null;
  }

  const out = {};
  for (const r of rows) {
    if (!r.h || r.t > cutoff) continue;
    if (!out[r.h] || r.t > out[r.h].t) out[r.h] = r;
  }
  return out;
}

/** Δ هر ویدیو نسبت به baseline: [{ video, dViews, dLikes, hours }] */
export async function deltas(channel, videos, windowSeconds) {
  const base = await baseline(channel, windowSeconds);
  if (!base) return null;
  const rows = [];
  for (const v of videos) {
    const b = base[v.hash];
    if (!b) continue;
    rows.push({
      video: v,
      dViews: v.views - (b.v ?? 0),
      dLikes: v.likes - (b.l ?? 0),
      hours: Math.max(1, Math.round((Date.now() / 1000 - b.t) / 3600)),
    });
  }
  return rows;
}
