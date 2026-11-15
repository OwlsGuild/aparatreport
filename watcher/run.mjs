// watcher/run.mjs — قلب تپنده. هر اجرا: کرال → مقایسه → ذخیره در گیت → هشدار.
// اجرای محلی:  node watcher/run.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAparat } from '../bot/tgcloud/lib/aparat.js';
import { ALERTS, CHANNELS } from '../bot/tgcloud/lib/config.js';
import { computeAlerts, nextState } from './lib/alerts.mjs';
import { compact } from './lib/compact.mjs';
import { notify, renderAlerts } from './lib/notify.mjs';
import * as store from './lib/store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aparat = createAparat(fetch);
const now = Math.floor(Date.now() / 1000);

let failures = 0;

for (const cfg of CHANNELS) {
  const dir = store.dirOf(ROOT, cfg.username);
  try {
    const profile = await aparat.profile(cfg.username);
    const videos = await aparat.videos(cfg.username);
    if (!videos.length) throw new Error('هیچ ویدیویی برنگشت — احتمالاً مسیر API عوض شده');

    const prev = await store.readJson(store.stateFile(dir));

    // محافظ: اگر لیست ناقص برگشته باشد، ویدیوهای غایب را «حذف‌شده» تلقی نکنیم.
    const prevCount = prev ? Object.keys(prev.videos ?? {}).length : 0;
    if (prevCount && videos.length < prevCount * 0.7)
      throw new Error(`لیست ناقص برگشت: ${videos.length} از ${prevCount} — اجرا لغو شد تا تاریخچه خراب نشود`);

    const next = {
      channel: profile,
      videos: Object.fromEntries(
        videos.map((v) => [
          v.hash,
          {
            views: v.views,
            likes: v.likes,
            published: v.published,
            title: v.title,
            duration: v.duration,
          },
        ]),
      ),
    };

    const alerts = computeAlerts(prev, next, ALERTS, now);

    await store.writeJson(store.latestFile(dir), {
      at: now,
      channel: profile,
      videos: videos.map((v) => ({ ...v, comments: v.comments ?? null })),
    });
    await store.appendNdjson(
      store.snapshotFile(dir, now * 1000),
      videos.map((v) => ({ t: now, h: v.hash, v: v.views, l: v.likes })),
    );
    await store.appendNdjson(store.metaFile(dir), [
      { t: now, f: profile.followers, n: profile.videoCount, tv: profile.totalViews },
    ]);
    await store.writeJson(store.stateFile(dir), nextState(prev, next, alerts, now));

    const compacted = await compact(dir, now * 1000);

    if (alerts.length) {
      const text = renderAlerts(cfg.title ?? cfg.username, alerts);
      const sent = await notify(text);
      console.log(`[${cfg.username}] ${alerts.length} هشدار (${alerts.map((a) => a.kind).join(', ')}) → ${sent ? 'فرستاده شد' : 'نفرستاد'}`);
    } else {
      console.log(`[${cfg.username}] بدون تغییر${prev ? '' : ' (اجرای اول — تاریخچه ساخته شد)'}`);
    }
    console.log(
      `[${cfg.username}] ${videos.length} ویدیو · ${profile.followers} فالوور${compacted ? ` · ${compacted} فایل فشرده شد` : ''}`,
    );
  } catch (e) {
    failures++;
    console.error(`[${cfg.username}] شکست: ${e.message}`);
  }
}

process.exit(failures ? 1 : 0);
