// handlers/message.js — روتر پیامهای متنی: هم دکمههای پایین صفحه، هم دستورهای تایپی.
import { api } from 'sdk';
import { allowed, channel, channels, videoDetail, watch } from '../lib/core.js';
import { deltas } from '../lib/history.js';
import {
  ACTION_BY_LABEL,
  changesView,
  detailView,
  helpText,
  listView,
  menuKeyboard,
  resolveSort,
  statsView,
  topView,
  watchesView,
} from '../lib/render.js';

const WINDOWS = { '24h': 86400, '7d': 604800, '30d': 2592000 };

async function send(chatId, text, reply_markup) {
  await api.sendMessage({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(reply_markup ? { reply_markup } : {}),
  });
}

const view = (chatId, v, overlay) => send(chatId, v.text, overlay ?? v.keyboard);

function findVideo(videos, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  const byHash = videos.find((v) => v.hash === q.trim() || v.id === q.trim());
  if (byHash) return byHash;
  return videos.filter((v) => v.title.toLowerCase().includes(needle))[0] ?? null;
}

export default async function (message) {
  const chatId = message.chat.id;
  const userId = message.from?.id ?? chatId;
  const text = (message.text ?? '').trim();

  if (!allowed(userId))
    return send(chatId, `⛔️ این ربات خصوصی است.\nآیدی عددی تو: <code>${userId}</code>`);

  try {
    const [raw, ...rest] = text.split(/\s+/);
    const cmd = (raw ?? '').replace(/@\w+$/, '').toLowerCase();
    const arg = rest.join(' ').trim();
    const primary = channels()[0];
    if (!primary) return send(chatId, 'هیچ کانالی در config تنظیم نشده است.');

    const action = ACTION_BY_LABEL[text];

    // شروع و راهنما: منوی دکمهای زیر صفحه
    if (!text || cmd === '/start') {
      const ch = await channel(primary.username);
      return view(chatId, statsView(ch, ch.videos), menuKeyboard);
    }
    if (action === 'help' || cmd === '/help') return send(chatId, helpText, menuKeyboard);

    if (cmd === '/id') return send(chatId, `آیدی عددی تو: <code>${userId}</code>`);

    if (action === 'videos' || cmd === '/videos') {
      const ch = await channel(primary.username);
      const sort = resolveSort(arg) ?? 'new';
      return view(chatId, listView(ch, ch.videos, sort, 1));
    }

    if (action === 'stats' || cmd === '/stats') {
      const ch = await channel(primary.username);
      return view(chatId, statsView(ch, ch.videos));
    }

    if (action === 'top' || cmd === '/top') {
      const ch = await channel(primary.username);
      const secs = WINDOWS[arg];
      if (!secs) return view(chatId, topView(ch, ch.videos, null, null));
      const rows = await deltas(primary.username, ch.videos, secs);
      if (!rows) return view(chatId, changesView(ch, null, arg));
      return view(chatId, topView(ch, ch.videos, rows, arg));
    }

    if (action === 'changes' || cmd === '/changes') {
      const secs = WINDOWS[arg] ?? WINDOWS['24h'];
      const label = arg in WINDOWS ? arg : '24h';
      const ch = await channel(primary.username);
      const rows = await deltas(primary.username, ch.videos, secs);
      return view(chatId, changesView(ch, rows, label));
    }

    if (action === 'watches' || cmd === '/watches') {
      const rows = await watch.list(userId);
      const ch = rows.length ? await channel(primary.username) : { videos: [] };
      return view(chatId, watchesView(rows, ch));
    }

    if (cmd === '/video') {
      const ch = await channel(primary.username);
      const found = findVideo(ch.videos, arg);
      if (!found) return send(chatId, `چیزی با «${arg}» پیدا نشد.`);
      const detail = await videoDetail(found.hash);
      return view(chatId, detailView({ ...found, ...detail }, ch.videos, await watch.has(userId, found.hash)));
    }

    if (cmd === '/watch' || cmd === '/unwatch') {
      const ch = await channel(primary.username);
      const found = findVideo(ch.videos, arg);
      if (cmd === '/watch') {
        if (!found) return send(chatId, `چیزی با «${arg}» پیدا نشد.`);
        const added = await watch.add(userId, ch.username, found);
        return send(chatId, added ? `🔔 پیگیری شد:\n${found.title}` : 'از قبل پیگیری میکردی.');
      }
      const hash = found?.hash ?? arg;
      if (!hash) return send(chatId, 'مثال: /unwatch jdmy31c');
      await watch.remove(userId, hash);
      return send(chatId, '🔕 پیگیری لغو شد.');
    }

    // متن آزاد = جستوجو در عنوانها
    const ch = await channel(primary.username);
    const needle = text.toLowerCase();
    const matches = ch.videos.filter((v) => v.title.toLowerCase().includes(needle));
    if (!matches.length)
      return send(chatId, `چیزی برای «${text}» پیدا نشد.\nاز دکمههای پایین صفحه استفاده کن.`, menuKeyboard);
    if (matches.length === 1) {
      const detail = await videoDetail(matches[0].hash);
      return view(chatId, detailView({ ...matches[0], ...detail }, ch.videos, await watch.has(userId, matches[0].hash)));
    }
    const header = `🔎 <b>${matches.length} نتیجه برای</b> «${text}»`;
    return view(chatId, listView(ch, matches, 'new', 1, header));
  } catch (e) {
    console.error('message handler failed', e);
    await send(chatId, `⚠️ خطا: ${e.message}`);
  }
}
