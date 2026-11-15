// lib/render.js — ساخت متن و دکمه‌ها. هیچ فراخوانی شبکه‌ای اینجا نیست.
// قاعده‌ی ظاهری: هر پاسخ یک سرتیتر، بخش‌های جدا با خط، برچسب ساده و مقدار پررنگ.
// ایموجی فقط برای شناساندن دکمه‌ها و تیتر بخش‌ها؛ نه برای تزئین هر خط.

import { videoUrl } from './aparat.js';
import { BOT } from './config.js';
import { ago, compact, delta, duration, esc, fa, jalali, pct } from './format.js';
import { engRate, ratio, summarize } from './stats.js';

const SEP = '───────────────';

export const SORTS = {
  new: { label: 'تازه‌ترین', cmp: (a, b) => (b.published ?? 0) - (a.published ?? 0) },
  views: { label: 'پربازدید', cmp: (a, b) => b.views - a.views },
  likes: { label: 'پرلایک', cmp: (a, b) => b.likes - a.likes },
  rate: { label: 'نرخ تعامل', cmp: (a, b) => engRate(b) - engRate(a) },
  long: { label: 'بلندترین', cmp: (a, b) => b.duration - a.duration },
  short: { label: 'کوتاه‌ترین', cmp: (a, b) => a.duration - b.duration },
};

/** نام‌های فارسی مرتب‌سازی، برای وقتی که کاربر تایپ می‌کند */
export const SORT_ALIASES = {
  تازه: 'new',
  جدید: 'new',
  بازدید: 'views',
  لایک: 'likes',
  تعامل: 'rate',
  بلند: 'long',
  کوتاه: 'short',
};

export const resolveSort = (s) => (SORTS[s] ? s : SORT_ALIASES[s] ?? null);

export const sortVideos = (videos, sort) => [...videos].sort((SORTS[sort] ?? SORTS.new).cmp);
export const pageCount = (total) => Math.max(1, Math.ceil(total / BOT.pageSize));

// ─── منوی دکمه‌ای ────────────────────────────────────────────────────────────

export const MENU = [
  [
    { label: '📊 آمار کانال', action: 'stats' },
    { label: '🎬 ویدیوها', action: 'videos' },
  ],
  [
    { label: '🏆 برترین‌ها', action: 'top' },
    { label: '📈 تغییرات', action: 'changes' },
  ],
  [
    { label: '🔔 پیگیری‌های من', action: 'watches' },
    { label: '❓ راهنما', action: 'help' },
  ],
];

export const ACTION_BY_LABEL = Object.fromEntries(MENU.flat().map((b) => [b.label, b.action]));

export const menuKeyboard = {
  keyboard: MENU.map((row) => row.map((b) => ({ text: b.label }))),
  resize_keyboard: true,
};

/** دکمه‌های شیشه‌ای زیر پیام‌ها: بازگشت به منو */
const backRow = [{ text: '🎬 ویدیوها', callback_data: 'l:new:1' }];

// ─── کمکی‌های متن ───────────────────────────────────────────────────────────

const kv = (label, value) => `${label}: <b>${value}</b>`;
const clip = (s, n = 48) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);

/** «۱ سال پیش» بدون تکرار وقتی مقدار درست نیست */
const when = (ms) => (ms ? `${ago(ms)} · ${jalali(ms)}` : 'نامشخص');

// ─── لیست ویدیوها ───────────────────────────────────────────────────────────

export function listView(ch, videos, sort, page, header) {
  const ordered = sortVideos(videos, sort);
  const pages = pageCount(ordered.length);
  const p = Math.min(Math.max(1, page), pages);
  const slice = ordered.slice((p - 1) * BOT.pageSize, p * BOT.pageSize);
  const s = summarize(videos);

  const lines = [
    header ?? `🎬 <b>${esc(ch.title)}</b>`,
    `${fa(s.count)} ویدیو · ${compact(ch.profile.followers)} دنبال‌کننده · ${compact(s.totalViews)} بازدید`,
    '',
    `مرتب‌سازی: <b>${SORTS[sort]?.label ?? sort}</b>`,
    SEP,
  ];

  for (const v of slice) {
    const n = ordered.indexOf(v) + 1;
    lines.push(
      `${fa(n)}. <a href="${videoUrl(v.hash)}">${esc(clip(v.title))}</a>`,
      `     <b>${fa(v.views)}</b> بازدید · ${fa(v.likes)} لایک · ${duration(v.duration)} · ${ago(v.published)}`,
    );
  }

  lines.push(SEP, `صفحه ${fa(p)} از ${fa(pages)}`);
  return { text: lines.join('\n'), keyboard: listKeyboard(sort, p, pages, slice), page: p, pages, slice };
}

export function listKeyboard(sort, page, pages, slice = []) {
  const keys = Object.keys(SORTS);
  const row = (group) =>
    group.map((k) => ({
      text: `${k === sort ? '• ' : ''}${SORTS[k].label}`,
      callback_data: `s:${k}:${page}`,
    }));

  const keyboard = [row(keys.slice(0, 3)), row(keys.slice(3))];
  if (pages > 1)
    keyboard.push([
      { text: '◀️', callback_data: `l:${sort}:${page - 1}` },
      { text: `${fa(page)}/${fa(pages)}`, callback_data: 'noop' },
      { text: '▶️', callback_data: `l:${sort}:${page + 1}` },
    ]);
  for (const v of slice) keyboard.push([{ text: `📄 ${clip(v.title, 38)}`, callback_data: `d:${v.hash}` }]);
  return { inline_keyboard: keyboard };
}

// ─── جزئیات یک ویدیو ────────────────────────────────────────────────────────

export function detailView(video, videos, watched) {
  const s = summarize(videos);
  const r = ratio(video.views, s.medianViews);
  const rl = ratio(video.likes, s.medianLikes);
  const diff = s.medianViews ? Math.round((r - 1) * 100) : 0;

  const lines = [
    `🎬 <b>${esc(clip(video.title, 70))}</b>`,
    SEP,
    kv('بازدید', fa(video.views)),
    kv('لایک', fa(video.likes)),
    kv('کامنت', fa(video.comments ?? 0)),
    kv('نرخ تعامل', pct(engRate(video))),
    kv('مدت', duration(video.duration)),
    kv('انتشار', when(video.published)),
  ];
  if (video.category) lines.push(kv('دسته', esc(video.category)));
  if (video.tags?.split(',').some((t) => t.trim()))
    lines.push(`برچسب‌ها: ${esc(video.tags.split(',').filter(Boolean).slice(0, 6).join('، '))}`);

  lines.push(SEP, `<b>نسبت به میانهٔ کانال</b>`);
  lines.push(
    `بازدید: <b>${fa(Number(r.toFixed(2)))}×</b> میانه (${
      diff >= 0 ? '+' : '−'
    }${fa(Math.abs(diff))}٪)  ·  میانه: ${fa(s.medianViews)}`,
  );
  lines.push(`لایک: <b>${fa(Number(rl.toFixed(2)))}×</b> میانه  ·  میانه: ${fa(s.medianLikes)}`);
  lines.push(SEP, `<a href="${videoUrl(video.hash)}">aparat.com/v/${video.hash}</a>`);

  return {
    text: lines.join('\n'),
    keyboard: {
      inline_keyboard: [
        [
          { text: watched ? '🔕 لغو پیگیری' : '🔔 پیگیری این ویدیو', callback_data: `${watched ? 'x' : 'w'}:${video.hash}` },
          { text: '▶️ تماشا', url: videoUrl(video.hash) },
        ],
        backRow,
      ],
    },
  };
}

// ─── آمار کانال ─────────────────────────────────────────────────────────────

export function statsView(ch, videos) {
  const s = summarize(videos);
  const now = Date.now();
  const last30 = videos.filter((v) => v.published && now - v.published < 30 * 86400_000);
  const last7 = videos.filter((v) => v.published && now - v.published < 7 * 86400_000);
  const best = [...videos].filter((v) => v.views > 0).sort((a, b) => engRate(b) - engRate(a))[0];

  const lines = [
    `📊 <b>${esc(ch.title)}</b>`,
    SEP,
    kv('دنبال‌کننده', compact(ch.profile.followers)),
    kv('ویدیو', fa(ch.profile.videoCount || s.count)),
    kv('بازدید کل', compact(ch.profile.totalViews)),
    SEP,
    '<b>میانهٔ هر ویدیو</b>',
    kv('بازدید', fa(s.medianViews)),
    kv('لایک', fa(s.medianLikes)),
    kv('نرخ تعامل', pct(s.medianRate)),
    kv('مدت', duration(s.totalDuration / Math.max(1, s.count))),
    SEP,
    '<b>انتشار</b>',
    kv('۳۰ روز گذشته', `${fa(last30.length)} ویدیو`),
    kv('۷ روز گذشته', `${fa(last7.length)} ویدیو`),
  ];

  if (s.top) lines.push(SEP, `👑 پربازدیدترین: <a href="${videoUrl(s.top.hash)}">${esc(clip(s.top.title, 40))}</a>`);
  if (best)
    lines.push(
      `🏆 بهترین تعامل: <a href="${videoUrl(best.hash)}">${esc(clip(best.title, 40))}</a> (${pct(engRate(best))})`,
    );

  return { text: lines.join('\n'), keyboard: { inline_keyboard: [[...backRow, { text: '🏆 برترین‌ها', callback_data: 't:all' }]] } };
}

// ─── تغییرات ────────────────────────────────────────────────────────────────

export function changesView(ch, rows, label) {
  if (!rows)
    return {
      text: [
        '🗂 <b>تاریخ در دسترس نیست</b>',
        SEP,
        'این دستور به فایل‌های تاریخ در مخزن نیاز دارد.',
        `اگر مخزن عمومی نیست، <code>HISTORY_BASE</code> را در <code>lib/config.js</code> تنظیم کن.`,
      ].join('\n'),
      keyboard: null,
    };

  if (!rows.length)
    return { text: `📈 <b>تغییرات ${label}</b>\n${SEP}\nچیزی برای مقایسه در این بازه نیست.`, keyboard: null };

  const moved = rows.filter((r) => r.dViews !== 0).sort((a, b) => b.dViews - a.dViews);
  const gained = rows.reduce((a, b) => a + Math.max(0, b.dViews), 0);
  const fell = moved.filter((r) => r.dViews < 0).length;

  const lines = [`📈 <b>تغییرات ${label}</b>`, SEP, kv('بازدید جدید', fa(gained)), kv('ویدیوهای تغییرکرده', fa(moved.length))];
  if (fell) lines.push(kv('کاهش بازدید', `${fa(fell)} ویدیو`));
  lines.push(SEP);

  if (!moved.length) lines.push('هیچ تغییری ثبت نشده است.');
  for (const r of moved.slice(0, 10)) {
    lines.push(
      `<a href="${videoUrl(r.video.hash)}">${esc(clip(r.video.title, 42))}</a>`,
      `     ${delta(r.dViews)} بازدید · ${delta(r.dLikes)} لایک · ${fa(r.hours)} ساعت`,
    );
  }
  return { text: lines.join('\n'), keyboard: null };
}

// ─── برترین‌ها ──────────────────────────────────────────────────────────────

export function topView(ch, videos, rows, label) {
  const lines = [];

  if (rows) {
    const sorted = [...rows].sort((a, b) => b.dViews - a.dViews).slice(0, 10);
    lines.push(`🏆 <b>بیشترین رشد ${label}</b>`, SEP);
    sorted.forEach((r, i) => {
      lines.push(
        `${fa(i + 1)}. <a href="${videoUrl(r.video.hash)}">${esc(clip(r.video.title, 42))}</a>`,
        `     ${delta(r.dViews)} بازدید · ${delta(r.dLikes)} لایک${
          r.video.views ? ` · ${pct(r.dViews / r.video.views)} از کل` : ''
        }`,
      );
    });
    return { text: lines.join('\n'), keyboard: { inline_keyboard: [backRow] } };
  }

  const sorted = [...videos].sort((a, b) => b.views - a.views).slice(0, 10);
  lines.push(`🏆 <b>پربازدیدترین ویدیوها</b>`, SEP);
  sorted.forEach((v, i) => {
    lines.push(
      `${fa(i + 1)}. <a href="${videoUrl(v.hash)}">${esc(clip(v.title, 42))}</a>`,
      `     <b>${fa(v.views)}</b> بازدید · ${fa(v.likes)} لایک · تعامل ${pct(engRate(v))}`,
    );
  });
  return { text: lines.join('\n'), keyboard: { inline_keyboard: [backRow] } };
}

// ─── پیگیری‌ها ──────────────────────────────────────────────────────────────

export function watchesView(rows, channel) {
  if (!rows.length)
    return {
      text: [
        '🔔 <b>پیگیری‌های من</b>',
        SEP,
        'هنوز چیزی را پیگیری نمی‌کنی.',
        'در لیست ویدیوها روی هر ویدیو بزن و «پیگیری این ویدیو» را انتخاب کن.',
      ].join('\n'),
      keyboard: { inline_keyboard: [backRow] },
    };

  const lines = ['🔔 <b>پیگیری‌های من</b>', SEP];
  rows.forEach((r, i) => {
    const cur = (channel?.videos ?? []).find((v) => v.hash === r.hash);
    const title = esc(clip(cur?.title ?? r.title ?? r.hash, 42));
    const url = videoUrl(r.hash);
    lines.push(
      `${fa(i + 1)}. <a href="${url}">${title}</a>`,
      cur ? `     <b>${fa(cur.views)}</b> بازدید · ${fa(cur.likes)} لایک` : '     از لیست کانال خارج شده است',
    );
  });
  return { text: lines.join('\n'), keyboard: { inline_keyboard: [backRow] } };
}

// ─── راهنما ─────────────────────────────────────────────────────────────────

export const helpText = [
  '🧭 <b>راهنما</b>',
  SEP,
  'با دکمه‌های پایین صفحه کار کن؛ نیازی به تایپ دستور نیست.',
  '',
  '📊 <b>آمار کانال</b> — خلاصهٔ عددی و میانه‌ها',
  '🎬 <b>ویدیوها</b> — لیست با مرتب‌سازی و صفحه‌بندی',
  '🏆 <b>برترین‌ها</b> — پربازدیدترین‌های کانال',
  '📈 <b>تغییرات</b> — چه چیزی از دیروز تا حالا عوض شده',
  '🔔 <b>پیگیری‌های من</b> — ویدیوهایی که دنبال می‌کنی',
  SEP,
  '<b>جست‌وجو</b>',
  'بخشی از عنوان ویدیو را بنویس تا همان لحظه پیدایش کنم.',
  SEP,
  'اگر دستور تایپی را ترجیح می‌دهی: /videos /video /top /stats /changes /id',
].join('\n');
