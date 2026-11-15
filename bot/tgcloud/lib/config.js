// lib/config.js — تنها منبع حقیقت برای کانال‌ها و تنظیمات.
// کرالر گیت‌هاب (watcher/) همین فایل را import می‌کند، پس یک ویرایش هر دو طرف را می‌گیرد.
// تغییر کانال: اینجا عوض کن، بعد `npx tgcloud push`.

export const CHANNELS = [
  {
    username: 'ehsanmansoori', // ← فقط همین را عوض کن
    title: 'احسان منصوری',
    url: 'https://www.aparat.com/ehsanmansoori',
  },
];

export const BOT = {
  allowedUsers: [], // خالی = همه؛ آیدی عددی کاربران مجاز را اینجا بگذار
  pageSize: 8,
};

export const ALERTS = {
  newVideo: true,
  removed: true,
  edited: true, // تغییر عنوان یا مدت ویدیو
  record: true, // شکستن رکورد بازدید کانال
  spike: { enabled: true, factor: 3, minDelta: 20 }, // Δ۲۴ساعته > factor × میانه
  stalled: { enabled: true, hours: 48, maxAgeDays: 14, cooldownDays: 3 },
};

// آدرس پایه‌ی فایل‌های تاریخ برای دستور /changes (مخزن باید عمومی باشد،
// یا این را به آدرس یک gist مخفی بده). خالی = /changes کار نمی‌کند.
export const HISTORY_BASE = '';
