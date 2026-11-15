// lib/stats.js — ریاضیات خالص. بدون import از sdk تا کرالر هم بتواند استفاده کند.

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** لایک به ازای هر بازدید */
export const engRate = (v) => (v.views > 0 ? v.likes / v.views : 0);

/** خلاصهٔ آماری کانال روی مجموعه‌ای از ویدیوها */
export function summarize(videos) {
  const views = videos.map((v) => v.views);
  const likes = videos.map((v) => v.likes);
  const rates = videos.map(engRate);
  return {
    count: videos.length,
    totalViews: views.reduce((a, b) => a + b, 0),
    totalLikes: likes.reduce((a, b) => a + b, 0),
    totalDuration: videos.reduce((a, b) => a + (b.duration || 0), 0),
    medianViews: median(views),
    medianLikes: median(likes),
    medianRate: median(rates),
    maxViews: Math.max(0, ...views),
    top: [...videos].sort((a, b) => b.views - a.views)[0] ?? null,
  };
}

/** نسبت یک مقدار به میانه — برای «۲.۱× کانال» */
export function ratio(value, base) {
  if (!base) return 0;
  return value / base;
}
