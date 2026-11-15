// handlers/callback_query.js — دکمه‌های شیشه‌ای: مرتب‌سازی، صفحه‌بندی، جزئیات، دنبال‌کردن.
import { api, BotApiError } from 'sdk';
import { allowed, channel, channels, videoDetail, watch } from '../lib/core.js';
import { deltas } from '../lib/history.js';
import { SORTS, changesView, detailView, listView, topView } from '../lib/render.js';

const WINDOWS = { 1: 86400, 7: 604800, 30: 2592000 };

// editMessageText وقتی متن عوض نشده باشد 400 می‌دهد؛ برای ما بی‌ضرر است.
async function edit(chatId, messageId, v) {
  try {
    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: v.text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(v.keyboard ? { reply_markup: v.keyboard } : {}),
    });
  } catch (e) {
    if (!(e instanceof BotApiError && e.description?.includes('not modified'))) throw e;
  }
}

export default async function (q) {
  const chatId = q.message?.chat?.id;
  const messageId = q.message?.message_id;
  const userId = q.from?.id;
  const [op, a, b] = (q.data ?? '').split(':');

  // پاسخ به callback اختیاری است: اگر توکن‌کوئری منقضی شده باشد نباید کل کار را بترکاند.
  const answer = async (text, alert = false) => {
    try {
      await api.answerCallbackQuery({
        callback_query_id: q.id,
        ...(text ? { text, show_alert: alert } : {}),
      });
    } catch (e) {
      console.warn('answerCallbackQuery ناموفق:', e.description ?? e.message);
    }
  };

  if (!allowed(userId)) return answer('دسترسی نداری', true);

  try {
    const primary = channels()[0];
    const ch = await channel(primary.username);

    if (op === 'noop') return answer();

    if (op === 'l' || op === 's') {
      const sort = SORTS[a] ? a : 'new';
      const page = op === 's' ? 1 : Number(b) || 1;
      await answer();
      return edit(chatId, messageId, listView(ch, ch.videos, sort, page));
    }

    if (op === 'd') {
      await answer();
      const found = ch.videos.find((v) => v.hash === a);
      if (!found) return edit(chatId, messageId, { text: 'این ویدیو دیگر در لیست نیست.', keyboard: null });
      const detail = await videoDetail(a);
      return edit(chatId, messageId, detailView({ ...found, ...detail }, ch.videos, await watch.has(userId, a)));
    }

    if (op === 'w' || op === 'x') {
      const found = ch.videos.find((v) => v.hash === a) ?? { hash: a, title: '' };
      if (op === 'w') {
        const added = await watch.add(userId, ch.username, found);
        await answer(added ? '🔔 اضافه شد' : 'از قبل دنبال می‌کردی');
      } else {
        await watch.remove(userId, a);
        await answer('🔕 لغو شد');
      }
      const detail = await videoDetail(a);
      return edit(chatId, messageId, detailView({ ...found, ...detail }, ch.videos, await watch.has(userId, a)));
    }

    if (op === 'c') {
      await answer();
      const secs = WINDOWS[a] ?? WINDOWS[1];
      const rows = await deltas(ch.username, ch.videos, secs);
      return edit(chatId, messageId, changesView(ch, rows, a === '7' ? '۷ روز' : '۲۴ ساعت'));
    }

    if (op === 't') {
      await answer();
      const rows = a === 'all' ? null : await deltas(ch.username, ch.videos, WINDOWS[a] ?? 0);
      return edit(chatId, messageId, topView(ch, ch.videos, rows, a === 'all' ? null : `${a} روز`));
    }

    return answer('دکمهٔ ناشناس', true);
  } catch (e) {
    console.error('callback failed', e);
    return answer(`خطا: ${e.message}`, true);
  }
}
