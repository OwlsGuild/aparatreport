// watcher/lib/notify.mjs — متن هشدارها + ارسال مستقیم با Bot API.
// مستقیم از گیت‌هاب می‌فرستیم چون ربات Serverless زمان‌بند ندارد و از بیرون هم
// نمی‌شود به آن داده داد.
import { compact, duration, esc, fa } from '../../bot/tgcloud/lib/format.js';
import { videoUrl } from '../../bot/tgcloud/lib/aparat.js';

export function renderAlerts(channelTitle, alerts) {
  return alerts
    .map((a) => {
      const v = a.video;
      const link = `<a href="${videoUrl(a.hash)}">${esc(v.title || a.hash)}</a>`;
      const stats = `👁 ${compact(v.views)} · ❤️ ${fa(v.likes)}`;
      switch (a.kind) {
        case 'new':
          return `🆕 <b>ویدیوی جدید</b> در «${esc(channelTitle)}»\n${link}\n${stats} · ⏱ ${duration(v.duration)}`;
        case 'record':
          return `🏆 <b>رکورد بازدید شکسته شد</b> — «${esc(channelTitle)}»\n${link}\n${stats} (رکورد قبلی: ${compact(
            a.extra.previous,
          )})`;
        case 'spike':
          return `🚀 <b>جهش بازدید</b> — «${esc(channelTitle)}»\n${link}\n+${fa(a.extra.d)} بازدید در ۲۴ ساعت (میانه‌ی کانال: ${fa(
            a.extra.med,
          )})\n${stats}`;
        case 'stalled':
          return `⏸ <b>رشد متوقف شد</b> — «${esc(channelTitle)}»\n${link}\n${fa(a.extra.hours)} ساعت بدون تغییر · ${stats}`;
        case 'edited':
          return `✏️ <b>عنوان تغییر کرد</b> — «${esc(channelTitle)}»\n«${esc(a.extra.from)}»\n→ ${link}`;
        case 'removed':
          return `🗑 <b>از لیست خارج شد</b> — «${esc(channelTitle)}»\n${esc(v.title || a.hash)} (${stats.replace(
            '👁 ',
            '',
          )})\n${videoUrl(a.hash)}`;
        default:
          return `ℹ️ ${a.kind}: ${esc(v.title || a.hash)}`;
      }
    })
    .join('\n\n');
}

export async function notify(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chat = process.env.TG_ALERT_CHAT;
  if (!token || !chat) {
    console.log('[notify] TG_BOT_TOKEN / TG_ALERT_CHAT تنظیم نشده — از ارسال صرف‌نظر شد');
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) {
    console.error('[notify] sendMessage failed:', j.description ?? res.status);
    return false;
  }
  return true;
}
