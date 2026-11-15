// lib/cache.js — کش کوتاه‌مدت در دیتابیس تا هر کلیک دکمه به اپارات حمله نکند.
// اگر جدول مهاجرت نشده باشد، بی‌صدا بی‌اثر می‌شود.

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { cache } from '../schema.js';

export async function cached(key, ttlSeconds, produce) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = await db.select().from(cache).where(eq(cache.key, key)).get();
    if (row && now - row.at < ttlSeconds) return JSON.parse(row.body);
  } catch {
    // جدول نیست یا خطای موقت — مستقیم برو سراغ منبع
  }

  const value = await produce();
  const body = JSON.stringify(value);
  try {
    await db
      .insert(cache)
      .values({ key, body, at: now })
      .onConflictDoUpdate({ target: cache.key, set: { body, at: now } })
      .run();
  } catch {
    // کش اختیاری است
  }
  return value;
}
