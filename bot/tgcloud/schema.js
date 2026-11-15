// schema.js — جدول‌های دیتابیس. دیپلوی این فایل دیتابیس را تغییر نمی‌دهد؛
// بعد از `push` باید `npx tgcloud migrate` بزنی.

import { table, integer, text, uniqueIndex } from 'sdk/db';

/** ویدیوهایی که کاربر دنبال می‌کند */
export const watches = table(
  'watches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tgId: integer('tg_id').notNull(),
    channel: text('channel').notNull(),
    hash: text('hash').notNull(),
    title: text('title').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('uidx_watches').on(t.tgId, t.channel, t.hash),
  }),
);

/** کش کوتاه‌مدت پاسخ‌های اپارات تا با هر کلیک دکمه به آن‌ها حمله نکنیم */
export const cache = table('cache', {
  key: text('key').primaryKey(),
  body: text('body').notNull(),
  at: integer('at').notNull(), // unix seconds
});
