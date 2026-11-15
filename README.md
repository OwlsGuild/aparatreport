# ربات رصد کانال آپارات

ربات تلگرامی خصوصی برای پایش یک یا چند کانال آپارات: آمار، روند، تغییرات و هشدار.
مشخصات کامل در [SPEC.md](SPEC.md).

## دو نیمه

| بخش | کجاست | کار |
|---|---|---|
| `watcher/` | GitHub Actions، هر ساعت | کرال اپارات، ذخیرهٔ تاریخ در `data/`، فرستادن هشدارها با Bot API |
| `bot/` | Telegram Serverless | دستورها، گزارش‌ها، تحلیل — تاریخ را از `data/` می‌خواند |

چرا تقسیم شده: Telegram Serverless زمان‌بند ندارد و از بیرون هم نمی‌شود در دیتابیسش نوشت.
تنها راه داشتن قلب تپنده، cron گیت‌هاب است.

## راه‌اندازی (یک‌بار)

1. کانال را در `bot/tgcloud/lib/config.js` تنظیم کن (این فایل تنها منبع حقیقت است و کرالر هم همان را می‌خواند):
   ```js
   export const CHANNELS = [{ username: 'ehsanmansoori', title: 'احسان منصوری', url: '...' }];
   ```
2. دسترسی‌ها: `BOT.allowedUsers` را پر کن (خالی = همه).
3. در مخزن گیت‌هاب، در Settings → Secrets and variables → Actions دو سکرت بگذار:
   - `TG_BOT_TOKEN` — توکن ربات از @BotFather
   - `TG_ALERT_CHAT` — آیدی چت/گروهی که هشدارها برود
4. برای فعال شدن `/changes` و `/top 7d`: اگر مخزن عمومی است، در `bot/tgcloud/lib/config.js` بگذار:
   ```js
   export const HISTORY_BASE = 'https://raw.githubusercontent.com/<owner>/<repo>/main/data';
   ```
   (برای مخزن خصوصی، یک gist مخفی بساز و همان را اینجا بگذار.)
5. دیپلوی ربات:
   ```bash
   cd bot
   npx tgcloud login     # توکن CLI از @BotFather → بات → Serverless → CLI Access
   npx tgcloud push      # کد را می‌فرستد
   npx tgcloud migrate   # جدول‌های watches و cache را می‌سازد
   ```

## اجرای محلی

```bash
node watcher/test.mjs     # بررسی منطق (آفلاین)
node watcher/run.mjs      # یک اسنپ‌شات واقعی + نوشتن data/
```

برای آزمایش دستورها بدون دیپلوی:

```bash
cd bot
npx tgcloud run handlers/message '/stats'
npx tgcloud run handlers/message '/videos views'
npx tgcloud run handlers/callback_query '{ id: "1", data: "l:views:1", from: { id: 1 }, message: { chat: { id: 1 }, message_id: 2 } }'
```

## دستورهای ربات

`/videos [مرتب‌سازی]` · `/video <جست‌وجو>` · `/top [7d|30d]` · `/stats` ·
`/changes [24h|7d|30d]` · `/watch <جست‌وجو>` · `/watches` · `/unwatch <hash>` · `/id`

هر متن آزاد هم جست‌وجو در عنوان‌ها است.

## فایل‌های داده

```
data/c/<username>/latest.json          وضعیت فعلی
data/c/<username>/state.json           پنجره‌های غلتان و هشدارهای اخیر
data/c/<username>/meta.ndjson          فالوور و بازدید کل در زمان
data/c/<username>/snapshots/YYYY-MM.ndjson   ردیف‌های {t,h,v,l}
```

۷ روز آخر با دقت ساعتی می‌ماند؛ قدیمی‌تر خودکار به یک ردیف در روز فشرده می‌شود
(`watcher/lib/compact.mjs`) تا حجم سالانه در حد یک مگابایت بماند.
