// watcher/lib/alerts.mjs — منطق خالص تشخیص تغییرات. تست‌پذیر، بدون شبکه.
import { median } from '../../bot/tgcloud/lib/stats.js';

const HOUR = 3600;

const slim = (v) => ({
  views: v.views ?? 0,
  likes: v.likes ?? 0,
  published: v.published ?? null,
  title: v.title ?? '',
  duration: v.duration ?? 0,
});

/**
 * prev: state.json قبلی (یا null در اولین اجرا)
 * next: { channel, videos: { hash: slimVideo } }
 * خروجی: [{ key, kind, hash, video, extra }]
 */
export function computeAlerts(prev, next, cfg, now) {
  const out = [];
  if (!prev) return out; // اولین اجرا: فقط تاریخچه را می‌سازیم، سیل هشدار نمی‌فرستیم

  const prevVideos = prev.videos ?? {};
  const sent = prev.sent ?? {};
  const cooled = (key, ttl) => Boolean(sent[key]) && now - sent[key] < ttl;
  const maxViewsBefore = Math.max(0, ...Object.values(prevVideos).map((v) => v.views ?? 0));

  const spike = cfg.spike ?? {};
  const deltas24 = [];
  for (const [h, v] of Object.entries(next.videos)) {
    const p = prevVideos[h];
    if (p?.v24At && now - p.v24At >= 20 * HOUR) deltas24.push((v.views ?? 0) - (p.v24 ?? 0));
  }
  const med24 = Math.max(1, median(deltas24));

  for (const [hash, v] of Object.entries(next.videos)) {
    const p = prevVideos[hash];

    if (!p) {
      if (cfg.newVideo) out.push({ key: `new:${hash}`, kind: 'new', hash, video: v });
      continue;
    }

    if (cfg.edited && p.title !== v.title)
      out.push({ key: `edit:${hash}:${now}`, kind: 'edited', hash, video: v, extra: { from: p.title } });

    if (cfg.record && maxViewsBefore > 0 && v.views > maxViewsBefore && (p.views ?? 0) <= maxViewsBefore)
      out.push({ key: `rec:${hash}:${now}`, kind: 'record', hash, video: v, extra: { previous: maxViewsBefore } });

    if (spike.enabled && p.v24At && now - p.v24At >= 20 * HOUR) {
      const d = (v.views ?? 0) - (p.v24 ?? 0);
      if (d > (spike.factor ?? 3) * med24 && d >= (spike.minDelta ?? 20) && !cooled(`spike:${hash}`, 86400))
        out.push({ key: `spike:${hash}`, kind: 'spike', hash, video: v, extra: { d, med: Math.round(med24) } });
    }

    const st = cfg.stalled ?? {};
    const hours = st.hours ?? 48;
    const age = v.published ? (now * 1000 - v.published) / 1000 : 0;
    if (
      st.enabled &&
      p.v48At &&
      now - p.v48At >= hours * HOUR &&
      v.views === p.v48 &&
      age > hours * HOUR &&
      age < (st.maxAgeDays ?? 14) * 86400 &&
      !cooled(`stall:${hash}`, (st.cooldownDays ?? 3) * 86400)
    )
      out.push({ key: `stall:${hash}`, kind: 'stalled', hash, video: v, extra: { hours: Math.round((now - p.v48At) / HOUR) } });
  }

  if (cfg.removed) {
    for (const [hash, p] of Object.entries(prevVideos)) {
      if (!next.videos[hash]) out.push({ key: `del:${hash}`, kind: 'removed', hash, video: p });
    }
  }

  return out;
}

/** وضعیت بعدی: ویدیوها + پنجره‌های غلتان ۲۴/۴۸ ساعت + هشدارهای اخیر */
export function nextState(prev, next, alerts, now) {
  const roll = (p, field, window, current) => {
    const at = p?.[`${field}At`];
    if (!at || now - at >= window) return { value: current, at: now };
    return { value: p[field] ?? current, at };
  };

  const videos = {};
  for (const [hash, v] of Object.entries(next.videos)) {
    const p = prev?.videos?.[hash] ?? {};
    const w24 = roll(p, 'v24', 24 * HOUR, v.views);
    const w48 = roll(p, 'v48', 48 * HOUR, v.views);
    videos[hash] = { ...v, v24: w24.value, v24At: w24.at, v48: w48.value, v48At: w48.at };
  }

  const sent = {};
  for (const [key, at] of Object.entries(prev?.sent ?? {})) if (now - at < 30 * 86400) sent[key] = at;
  for (const a of alerts) sent[a.key] = now;

  return {
    at: now,
    channel: next.channel,
    videos,
    records: { maxViews: Math.max(0, ...Object.values(videos).map((v) => v.views ?? 0)) },
    sent,
  };
}
