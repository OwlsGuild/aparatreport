// lib/render.js — ساخت متن و دکمه‌ها. هیچ فراخوانی شبکه‌ای اینجا نیست.

import { videoUrl } from './aparat.js';
import { BOT } from './config.js';
import { ago, bar, compact, delta, duration, esc, fa, jalali, pct } from './format.js';
import { engRate, median, ratio, summarize } from './stats.js';

export const SORTS = {
  new: { label: 'تازه‌ترین', cmp: (a, b) => (b.published ?? 0) - (a.published ?? 0) },
  views: { label: 'پربازدید', cmp: (a, b) => b.views - a.views },
  likes: { label: 'پرلایک', cmp: (a, b) => b.likes - a.likes },
  rate: { label: 'نرخ تعامل', cmp: (a, b) => engRate(b) - engRate(a) },
  long: { label: 'بلندترین', cmp: (a, b) => b.duration - a.duration },
  short: { label: 'کوتاه‌ترین', cmp: (a, b) => a.duration - b.duration },
};

export const sortVideos = (videos, sort) => [...videos].sort((SORTS[sort] ?? SORTS.new).cmp);
export const pageCount = (total) => Math.max(1, Math.ceil(total / BOT.pageSize));

/** صفحه‌ی لیست ویدیوها */
export function listView(ch, videos, sort, page) {
  const ordered = sortVideos(videos, sort);
  const pages = pageCount(ordered.length);
  const p = Math.min(Math.max(1, page), pages);
  const slice = ordered.slice((p - 1) * BOT.pageSize, p * BOT.pageSize);
  const s = summarize(videos);
  const max = Math.max(1, ...slice.map((v) => v.views));

  const lines = [
    `📺 <b>${esc(ch.title)}</b>`,
    `${fa(s.count)} ویدیو · ${compact(ch.profile.followers)} دنبال‌کننده · ${compact(ch.profile.totalViews)} بازدید کل`,
    `مرتب‌سازی: <b>${SORTS[sort]?.label ?? sort}</b>`,
    '',
  ];

  for (const v of slice) {
    const n = ordered.indexOf(v) + 1;
    lines.push(
      `${fa(n)}. <a href="${videoUrl(v.hash)}">${esc(v.title)}</a>`,
      `     ${bar(v.views, max)} ${compact(v.views)} بازدید · ❤️ ${fa(v.likes)} · ⏱ ${duration(v.duration)} · ${ago(v.published)}`,
    );
  }
  lines.push('', `صفحه ${fa(p)} از ${fa(pages)}`);
  return { text: lines.join('\n'), page: p, pages, slice };
}

/** کیبورد لیست: مرتب‌سازی + صفحه‌بندی + دکمه‌ی هر ویدیو */
export function listKeyboard(channelName, sort, page, pages, slice = []) {
  const sorts = Object.keys(SORTS);
  const row = (keys) =>
    keys.map((k) => ({
      text: `${k === sort ? '• ' : ''}${SORTS[k].label}`,
      callback_data: `s:${k}:${page}`,
    }));

  const keyboard = [row(sorts.slice(0, 3)), row(sorts.slice(3)), []];
  if (pages > 1) {
    keyboard[2].push({ text: '◀️', callback_data: `l:${sort}:${page - 1}` });
    keyboard[2].push({ text: `${fa(page)}/${fa(pages)}`, callback_data: 'noop' });
    keyboard[2].push({ text: '▶️', callback_data: `l:${sort}:${page + 1}` });
  }
  for (const v of slice) {
    keyboard.push([{ text: `📄 ${v.title.slice(0, 40)}`, callback_data: `d:${v.hash}` }]);
  }
  return { inline_keyboard: keyboard.filter((r) => r.length) };
}

/** جزئیات یک ویدیو در کنار آمار کانال */
export function detailView(video, videos, watched) {
  const s = summarize(videos);
  const r = ratio(video.views, s.medianViews);
  const diff = s.medianViews ? Math.round((r - 1) * 100) : 0;

  const text = [
    `🎬 <b>${esc(video.title)}</b>`,
    '',
    `👁 <b>${fa(video.views)}</b> بازدید · ❤️ ${fa(video.likes)} لایک · 💬 ${fa(video.comments ?? 0)} کامنت`,
    `⏱ ${duration(video.duration)} · 📅 ${ago(video.published)} (${jalali(video.published)})`,
    `📈 نرخ تعامل: ${pct(engRate(video))}`,
    '',
    '📊 نسبت به کانال:',
    `${bar(video.views, s.medianViews * 2, 12)} <b>${fa(r.toFixed(2))}×</b> میانه (${diff >= 0 ? '+' : '−'}${fa(Math.abs(diff))}٪)`,
    `${bar(video.likes, s.medianLikes * 2, 12)} ${fa(video.likes)} لایک (میانه ${fa(s.medianLikes)})`,
    video.category ? `🗂 دسته: ${esc(video.category)}` : '',
    video.tags ? `🏷 ${esc(video.tags.split(',').slice(0, 8).join(', '))}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const keyboard = [
    [{ text: '▶️ تماشا در آپارات', url: videoUrl(video.hash) }],
    [
      {
        text: watched ? '🔕 لغو دنبال‌کردن' : '🔔 دنبال کردن این ویدیو',
        callback_data: `${watched ? 'x' : 'w'}:${video.hash}`,
      },
    ],
    [{ text: '📋 بازگشت به لیست', callback_data: 'l:new:1' }],
  ];
  return { text, keyboard: { inline_keyboard: keyboard } };
}

/** خلاصهٔ آماری کانال */
export function statsView(ch, videos) {
  const s = summarize(videos);
  const now = Date.now();
  const last30 = videos.filter((v) => v.published && now - v.published < 30 * 86400_000);
  const last7 = videos.filter((v) => v.published && now - v.published < 7 * 86400_000);
  const withViews = videos.filter((v) => v.views > 0);
  const best = [...withViews].sort((a, b) => engRate(b) - engRate(a))[0];

  const text = [
    `📊 <b>${esc(ch.title)}</b>`,
    `${compact(ch.profile.followers)} دنبال‌کننده · ${fa(ch.profile.videoCount)} ویدیو`,
    `${compact(ch.profile.totalViews)} بازدید کل کانال`,
    '',
    `<b>میانه‌ها</b> (مقایسه‌ی منصفانه، مقاوم به ویدیوهای پرت):`,
    `👁 بازدید: ${fa(s.medianViews)}`,
    `❤️ لایک: ${fa(s.medianLikes)}`,
    `📈 نرخ تعامل: ${pct(s.medianRate)}`,
    `⏱ میانگین مدت: ${duration(s.totalDuration / Math.max(1, s.count))}`,
    '',
    `🗓 ${fa(last30.length)} ویدیو در ۳۰ روز گذشته · ${fa(last7.length)} در ۷ روز`,
    best ? `🏆 بهترین نرخ تعامل: ${esc(best.title.slice(0, 45))} (${pct(engRate(best))})` : '',
    s.top ? `👑 پربازدیدترین: ${esc(s.top.title.slice(0, 45))} (${compact(s.top.views)})` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [
          { text: '📋 لیست ویدیوها', callback_data: 'l:new:1' },
          { text: '🏆 برترین‌ها', callback_data: 't:all' },
        ],
        [
          { text: '📈 تغییرات ۲۴ ساعت', callback_data: 'c:1' },
          { text: '📈 تغییرات ۷ روز', callback_data: 'c:7' },
        ],
      ],
    },
  };
}

/** تغییرات نسبت به بازه؛ rows از history.deltas */
export function changesView(ch, rows, label) {
  if (!rows) {
    return {
      text:
        '🗂 تاریخ در دسترس نیست.\n\n' +
        'برای فعال شدن این دستور، در <code>lib/config.js</code> مقدار <code>HISTORY_BASE</code> را روی آدرس خام پوشهٔ data مخزن بگذار ' +
        '(مثلاً <code>https://raw.githubusercontent.com/OWNER/REPO/main/data</code>) و مطمئن شو کرالر گیت‌هاب حداقل یک بار اجرا شده است.',
      keyboard: null,
    };
  }
  if (!rows.length) return { text: 'چیزی برای مقایسه در این بازه نیست.', keyboard: null };

  const moved = rows.filter((r) => r.dViews !== 0).sort((a, b) => b.dViews - a.dViews);
  const down = rows.filter((r) => r.dViews < 0).length;
  const total = moved.reduce((a, b) => a + Math.max(0, b.dViews), 0);

  const lines = [
    `📈 <b>تغییرات ${label}</b> — ${esc(ch.title)}`,
    `مجموع بازدید جدید: <b>${fa(total)}</b>${down ? ` · ${fa(down)} ویدیو افت داشت` : ''}`,
    '',
  ];
  for (const r of moved.slice(0, 12)) {
    lines.push(
      `<a href="${videoUrl(r.video.hash)}">${esc(r.video.title.slice(0, 42))}</a>`,
      `     👁 ${delta(r.dViews)} · ❤️ ${delta(r.dLikes)} · ${fa(r.hours)} ساعت`,
    );
  }
  if (!moved.length) lines.push('هیچ تغییری ثبت نشده است.');
  return { text: lines.join('\n'), keyboard: null };
}

/** برترین‌ها: بدون بازه = کل تاریخچه، با بازه = بیشترین رشد */
export function topView(ch, videos, rows, label) {
  if (rows) {
    const sorted = [...rows].sort((a, b) => b.dViews - a.dViews).slice(0, 10);
    const lines = [`🏆 <b>بیشترین رشد ${label}</b> — ${esc(ch.title)}`, ''];
    sorted.forEach((r, i) => {
      lines.push(
        `${fa(i + 1)}. <a href="${videoUrl(r.video.hash)}">${esc(r.video.title.slice(0, 42))}</a>`,
        `     👁 ${delta(r.dViews)} · ❤️ ${delta(r.dLikes)} (${
          r.video.views ? pct(r.dViews / r.video.views) : '—'
        } از کل بازدید)`,
      );
    });
    return { text: lines.join('\n'), keyboard: null };
  }

  const sorted = [...videos].sort((a, b) => b.views - a.views).slice(0, 10);
  const max = Math.max(1, ...sorted.map((v) => v.views));
  const lines = [`🏆 <b>پربازدیدترین ویدیوها</b> — ${esc(ch.title)}`, ''];
  sorted.forEach((v, i) => {
    lines.push(
      `${fa(i + 1)}. <a href="${videoUrl(v.hash)}">${esc(v.title.slice(0, 42))}</a>`,
      `     ${bar(v.views, max)} ${compact(v.views)} · ❤️ ${fa(v.likes)} · 📈 ${pct(engRate(v))}`,
    );
  });
  return { text: lines.join('\n'), keyboard: null };
}

export const helpText =
  '🤖 <b>رصد کانال آپارات</b>\n\n' +
  '<b>دستورها</b>\n' +
  '/videos [مرتب‌سازی] — لیست ویدیوها (تازه‌ترین، بازدید، لایک، نرخ تعامل، بلند، کوتاه)\n' +
  '/video &lt;جست‌وجو&gt; — جزئیات یک ویدیو\n' +
  '/top — پربازدیدترین‌ها\n' +
  '/top 7d یا 30d — بیشترین رشد در بازه\n' +
  '/stats — خلاصهٔ آماری کانال\n' +
  '/changes [24h|7d] — چه چیزی تغییر کرد\n' +
  '/watch &lt;جست‌وجو&gt; · /watches · /unwatch &lt;hash&gt;\n' +
  '/id — آیدی عددی تو\n\n' +
  'هر متن آزاد هم به‌عنوان جست‌وجو در عنوان ویدیوها استفاده می‌شود.';
