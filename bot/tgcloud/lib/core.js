// lib/core.js — لایهٔ اپلیکیشن: ترکیب کانفیگ، کلاینت اپارات، کش و دیتابیس.
// هندلرها فقط با این حرف میزنند.

import { db, fetch as http } from 'sdk';
import { and, eq } from 'sdk/db';
import { watches } from '../schema.js';
import { createAparat } from './aparat.js';
import { cached } from './cache.js';
import { BOT, CHANNELS } from './config.js';

const aparat = createAparat(http);
const nowSec = () => Math.floor(Date.now() / 1000);

export const channels = () => CHANNELS;

/** آیا این کاربر اجازه دارد؟ allowedUsers خالی یعنی همه. */
export function allowed(userId) {
  return !BOT.allowedUsers.length || BOT.allowedUsers.includes(userId);
}

/** پروفایل + ویدیوهای کانال، با کش ۵ دقیقهای */
export async function channel(channelName) {
  const meta = CHANNELS.find((c) => c.username === channelName);
  if (!meta) throw new Error(`کانال در کانفیگ نیست: ${channelName}`);
  const data = await cached(`ch:${channelName}`, 300, async () => {
    const [profile, videos] = await Promise.all([aparat.profile(channelName), aparat.videos(channelName)]);
    return { profile, videos };
  });
  return { ...meta, ...data };
}

/** جزئیات یک ویدیو (کامنت و تگ فقط اینجا میآید) با کش ۱۰ دقیقهای */
export const videoDetail = (hash) => cached(`vid:${hash}`, 600, () => aparat.video(hash));

export const watch = {
  async add(tgId, channelName, v) {
    if (await watch.has(tgId, v.hash)) return false;
    await db
      .insert(watches)
      .values({ tgId, channel: channelName, hash: v.hash, title: v.title, createdAt: nowSec() })
      .run();
    return true;
  },
  async remove(tgId, hash) {
    await db.delete(watches).where(and(eq(watches.tgId, tgId), eq(watches.hash, hash))).run();
  },
  has: async (tgId, hash) =>
    !!(await db.select().from(watches).where(and(eq(watches.tgId, tgId), eq(watches.hash, hash))).get()),
  list: (tgId) => db.select().from(watches).where(eq(watches.tgId, tgId)).all(),
};
