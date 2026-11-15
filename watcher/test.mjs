// watcher/test.mjs — بررسی اجرایی منطق حساس.  node watcher/test.mjs
import assert from 'node:assert/strict';
import path from 'node:path';

import { createAparat, faNum, normalizeVideo, parseDate, resolveChannel } from '../bot/tgcloud/lib/aparat.js';
import { compact } from './lib/compact.mjs';
import { computeAlerts, nextState } from './lib/alerts.mjs';
import { median, summarize } from '../bot/tgcloud/lib/stats.js';
import { duration, fa, pct } from '../bot/tgcloud/lib/format.js';
import {
  changesView,
  detailView,
  listKeyboard,
  listView,
  statsView,
  topView,
} from '../bot/tgcloud/lib/render.js';

const NOW = 1_800_000_000;
const HOUR = 3600;

// --- پارس اعداد و آدرس‌ها -------------------------------------------------
assert.equal(faNum('826.3 هزار'), 826300);
assert.equal(faNum('۱.۲ میلیون'), 1200000);
assert.equal(faNum('5,359'), 5359);
assert.equal(faNum('۸۰۹۸۷'), 80987);
assert.equal(faNum(null), 0);
assert.equal(faNum('t = 81 هزار'), 81000, 'رشته با متن اضافه هم باید پارس شود');
assert.equal(resolveChannel('https://www.aparat.com/ehsanmansoori/'), 'ehsanmansoori');
assert.equal(resolveChannel('@ehsanmansoori'), 'ehsanmansoori');
assert.equal(resolveChannel('ehsanmansoori'), 'ehsanmansoori');
assert.equal(parseDate('2025-02-26 12:10:16'), Date.parse('2025-02-26T12:10:16+03:30'));

// --- نرمال‌سازی ویدیو ------------------------------------------------------
const raw = {
  id: 63404877,
  uid: 'jdmy31c',
  title: 't',
  visit_cnt: '81 هزار',
  like_cnt: 204,
  duration: 730,
  sdate_rss: '2025-02-26 12:10:16',
  tag_str: 'a,b',
};
const v = normalizeVideo(raw);
assert.equal(v.views, 81000, 'visit_cnt_int نبود، باید از رشته پارس شود');
assert.equal(v.hash, 'jdmy31c');
assert.equal(v.likes, 204);

// اپارات اعداد را رشته برمی‌گرداند — باید عدد شوند وگرنه مرتب‌سازی لغوی می‌شود
const fromStrings = normalizeVideo({ uid: 'h', visit_cnt_int: '80989', like_cnt: '204', duration: '730' });
assert.equal(fromStrings.views, 80989);
assert.equal(fromStrings.likes, 204);
assert.equal(fromStrings.duration, 730);
assert.equal(typeof fromStrings.views, 'number');
assert.deepEqual([fromStrings.views, 80999].sort((a, b) => a - b), [80989, 80999]);

// --- آمار ------------------------------------------------------------------
assert.equal(median([3, 1, 2]), 2);
assert.equal(median([4, 1, 3, 2]), 2.5);
assert.equal(duration(730), '۱۲:۱۰');
assert.equal(fa(1234), '۱٫۲۳۴');
assert.equal(pct(0.0412), '۴.۱٪');
assert.equal(summarize([{ views: 10, likes: 1, duration: 60 }]).medianViews, 10);

// --- هشدارها --------------------------------------------------------------
const slim = (views, title = 't', published = (NOW - 10 * 86400) * 1000) => ({
  views,
  likes: 5,
  published,
  title,
  duration: 100,
});

const cfg = {
  newVideo: true,
  removed: true,
  edited: true,
  record: true,
  spike: { enabled: true, factor: 3, minDelta: 20 },
  stalled: { enabled: true, hours: 48, maxAgeDays: 14, cooldownDays: 3 },
};

// اجرای اول: هیچ هشداری نباید بدهد
assert.deepEqual(computeAlerts(null, { videos: { a: slim(10) } }, cfg, NOW), []);

// ویدیوی جدید + ویدیوی حذف‌شده + ویرایش عنوان
const prev = {
  videos: {
    a: { ...slim(1000), v24: 900, v24At: NOW - 25 * HOUR, v48: 800, v48At: NOW - 49 * HOUR },
    b: { ...slim(50), v24: 50, v24At: NOW - 25 * HOUR, v48: 50, v48At: NOW - 49 * HOUR },
  },
  sent: {},
};
const next = {
  videos: {
    a: slim(1200, 't2'),
    c: slim(3),
  },
};
const kinds = computeAlerts(prev, next, cfg, NOW).map((x) => x.kind).sort();
assert.deepEqual(kinds, ['edited', 'new', 'record', 'removed'].sort(), `گرفتیم: ${kinds}`);

// جهش: رشد a باید از میانه‌ی کانال چند برابر بگذرد
const spikePrev = {
  videos: {
    a: { ...slim(1000), v24: 1000, v24At: NOW - 25 * HOUR, v48: 1000, v48At: NOW - 49 * HOUR },
    b: { ...slim(1000), v24: 1000, v24At: NOW - 25 * HOUR, v48: 1000, v48At: NOW - 49 * HOUR },
    c: { ...slim(1000), v24: 1000, v24At: NOW - 25 * HOUR, v48: 1000, v48At: NOW - 49 * HOUR },
  },
  sent: {},
  records: { maxViews: 5000 },
};
const spikeNext = { videos: { a: slim(3000), b: slim(1010), c: slim(1010) } };
const spikeAlerts = computeAlerts(spikePrev, spikeNext, cfg, NOW);
assert.ok(spikeAlerts.some((x) => x.kind === 'spike'), 'جهش تشخیص داده نشد');

// توقف رشد: دو روز بدون تغییر، ویدیوی جوان
const stallPrev = {
  videos: {
    a: { ...slim(500, 't', (NOW - 3 * 86400) * 1000), v24: 500, v24At: NOW - 25 * HOUR, v48: 500, v48At: NOW - 49 * HOUR },
  },
  sent: {},
  records: { maxViews: 500 },
};
const stallAlerts = computeAlerts(stallPrev, { videos: { a: slim(500, 't', (NOW - 3 * 86400) * 1000) } }, cfg, NOW);
assert.ok(stallAlerts.some((x) => x.kind === 'stalled'), 'توقف رشد تشخیص داده نشد');

// کول‌داون: هشدار تکراری فرستاده نشود
const cooled = computeAlerts({ ...stallPrev, sent: { 'stall:a': NOW - HOUR } }, { videos: { a: slim(500, 't', (NOW - 3 * 86400) * 1000) } }, cfg, NOW);
assert.deepEqual(cooled.filter((x) => x.kind === 'stalled'), []);

// وضعیت بعدی: پنجره‌های غلتان فعال باید حفظ شوند، منقضی‌شده‌ها تازه شوند
const activePrev = {
  videos: { a: { ...slim(500, 't', (NOW - 3 * 86400) * 1000), v24: 500, v24At: NOW - 20 * HOUR, v48: 400, v48At: NOW - 30 * HOUR } },
  sent: {},
};
const st = nextState(activePrev, { videos: { a: slim(600, 't', (NOW - 3 * 86400) * 1000) } }, [], NOW);
assert.equal(st.videos.a.v24, 500, 'پنجره‌ی فعالِ ۲۴ ساعت نباید بازنشانی شود');
assert.equal(st.videos.a.v24At, NOW - 20 * HOUR);
assert.equal(st.videos.a.v48, 400, 'پنجره‌ی فعالِ ۴۸ ساعت نباید بازنشانی شود');
assert.equal(st.videos.a.views, 600);
assert.equal(st.records.maxViews, 600);

// --- کلاینت با fetch ساختگی -----------------------------------------------
const calls = [];
const fake = async (url) => {
  calls.push(url);
  if (url.includes('/information/'))
    return { ok: true, json: async () => ({ data: { attributes: { username: 'x', name: 'X', follower_cnt_num: 5 } } }) };
  return { ok: true, json: async () => ({ included: [{ type: 'Video', attributes: raw }] }) };
};
const ap = createAparat(fake);
const prof = await ap.profile('x');
assert.equal(prof.followers, 5);
assert.equal((await ap.videos('x')).length, 1);
assert.equal(calls.length, 2, 'صفحه‌ی دوم نباید درخواست شود (کمتر از ۱۰ ویدیو)');

// 503 گذرا: باید دوباره تلاش کند. 404: نباید اصرار کند.
{
  let hits = 0;
  const flaky = async () => {
    hits++;
    if (hits < 3) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => ({ data: { attributes: { username: 'x' } } }) };
  };
  assert.equal((await createAparat(flaky).profile('x')).username, 'x');
  assert.equal(hits, 3);

  let hard = 0;
  const missing = async () => {
    hard++;
    return { ok: false, status: 404, json: async () => ({}) };
  };
  await assert.rejects(() => createAparat(missing).profile('x'), /aparat 404/);
  assert.equal(hard, 1, 'خطای 404 نباید تکرار شود');
}

// --- فشرده‌سازی ------------------------------------------------------------
{
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ap-'));
  const old = Date.UTC(2024, 0, 15);
  await fs.mkdir(path.join(dir, 'snapshots'), { recursive: true });
  const rows = [];
  for (let h = 0; h < 48; h++) rows.push({ t: Math.floor(old / 1000) + h * HOUR, h: 'a', v: h, l: 0 });
  await fs.writeFile(path.join(dir, 'snapshots', '2024-01.ndjson'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  assert.equal(await compact(dir, old + 400 * 86400_000), 1);
  const out = (await fs.readFile(path.join(dir, 'snapshots', '2024-01.ndjson'), 'utf8')).trim().split('\n');
  assert.equal(out.length, 2, 'باید دو روز → دو ردیف بماند');
  assert.equal(JSON.parse(out[1]).v, 47, 'آخرین ردیف روز باید بماند');
}

// --- نمایش (بدون شبکه) ----------------------------------------------------
{
  const ch = { username: 'x', title: 'کانال تست', profile: { followers: 1200, videoCount: 2, totalViews: 5000 } };
  const old = Date.now() - 400 * 86400_000;
  const vids = [
    { hash: 'a', id: '1', title: 'ویدیوی اول', views: 1000, likes: 50, duration: 300, published: old, tags: 'x,y', category: 'کسب‌وکار' },
    { hash: 'b', id: '2', title: 'ویدیوی دوم', views: 200, likes: 5, duration: 60, published: old, tags: '', category: '' },
  ];

  const lv = listView(ch, vids, 'views', 1);
  assert.ok(lv.text.includes('ویدیوی اول') && lv.text.includes('کانال تست'));
  assert.equal(lv.pages, 1);
  const kb = listKeyboard('x', 'views', 1, lv.pages, lv.slice);
  for (const row of kb.inline_keyboard)
    for (const btn of row)
      assert.ok((btn.callback_data ?? '').length <= 64, `callback_data خیلی بلند: ${btn.callback_data}`);

  assert.ok(detailView(vids[0], vids, false).text.includes('بازدید'));
  assert.ok(detailView(vids[0], vids, true).keyboard.inline_keyboard[1][0].callback_data.startsWith('x:'));
  assert.ok(statsView(ch, vids).text.includes('کانال تست'));
  assert.ok(topView(ch, vids, null, null).text.includes('پربازدیدترین'));
  assert.ok(changesView(ch, null, '24h').text.includes('HISTORY_BASE'));
  assert.ok(changesView(ch, [{ video: vids[0], dViews: 120, dLikes: 3, hours: 24 }], '۲۴ ساعت').text.includes('+۱۲۰'));
  // کانال خالی نباید بترکد
  assert.doesNotThrow(() => statsView(ch, []));
  assert.doesNotThrow(() => listView(ch, [], 'new', 1));
}

console.log('✅ همه‌ی بررسی‌ها پاس شد');
