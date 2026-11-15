// handlers/message.js — روتر دستورها. هر پیام متنی وارد می‌شود.
import { api } from 'sdk';
import { allowed, channel, channels, videoDetail, watch } from '../lib/core.js';
import { deltas } from '../lib/history.js';
import {
  SORTS,
  changesView,
  detailView,
  helpText,
  listKeyboard,
  listView,
  statsView,
  topView,
} from '../lib/render.js';

const WINDOWS = { '24h': 86400, '7d': 604800, '30d': 2592000 };

async function view(chatId, v) {
  await api.sendMessage({
    chat_id: chatId,
    text: v.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(v.keyboard ? { reply_markup: v.keyboard } : {}),
  });
}

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
    return api.sendMessage({ chat_id: chatId, text: `⛔️ این ربات خصوصی است.\nآیدی عددی تو: <code>${userId}</code>`, parse_mode: 'HTML' });

  try {
    const [raw, ...rest] = text.split(/\s+/);
    const cmd = (raw ?? '').replace(/@\w+$/, '').toLowerCase();
    const arg = rest.join(' ').trim();
    const primary = channels()[0];

    if (!text || cmd === '/start' || cmd === '/help') {
      if (!primary) return view(chatId, { text: 'هیچ کانالی در config تنظیم نشده است.' });
      const ch = await channel(primary.username);
      const v = statsView(ch, ch.videos);
      return api.sendMessage({
        chat_id: chatId,
        text: v.text + '\n\n' + helpText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: v.keyboard,
      });
    }

    if (cmd === '/id') return api.sendMessage({ chat_id: chatId, text: `آیدی عددی تو: <code>${userId}</code>`, parse_mode: 'HTML' });

    if (cmd === '/videos') {
      const ch = await channel(primary.username);
      const sort = SORTS[arg] ? arg : 'new';
      const v = listView(ch, ch.videos, sort, 1);
      v.keyboard = listKeyboard(ch.username, sort, v.page, v.pages, v.slice);
      return view(chatId, v);
    }

    if (cmd === '/video') {
      const ch = await channel(primary.username);
      const found = findVideo(ch.videos, arg);
      if (!found) return api.sendMessage({ chat_id: chatId, text: `چیزی با «${arg}» پیدا نشد.` });
      const detail = await videoDetail(found.hash);
      return view(chatId, detailView({ ...found, ...detail }, ch.videos, await watch.has(userId, found.hash)));
    }

    if (cmd === '/top') {
      const ch = await channel(primary.username);
      const secs = WINDOWS[arg];
      if (!secs) return view(chatId, topView(ch, ch.videos, null, null));
      const rows = await deltas(primary.username, ch.videos, secs);
      if (!rows)
        return view(chatId, changesView(ch, null, arg)); // همان پیام راهنمای HISTORY_BASE
      return view(chatId, topView(ch, ch.videos, rows, arg));
    }

    if (cmd === '/stats') {
      const ch = await channel(primary.username);
      return view(chatId, statsView(ch, ch.videos));
    }

    if (cmd === '/changes') {
      const secs = WINDOWS[arg] ?? WINDOWS['24h'];
      const label = arg in WINDOWS ? arg : '24h';
      const ch = await channel(primary.username);
      const rows = await deltas(primary.username, ch.videos, secs);
      return view(chatId, changesView(ch, rows, label));
    }

    if (cmd === '/watch') {
      const ch = await channel(primary.username);
      const found = findVideo(ch.videos, arg);
      if (!found) return api.sendMessage({ chat_id: chatId, text: `چیزی با «${arg}» پیدا نشد.` });
      const added = await watch.add(userId, ch.username, found);
      return api.sendMessage({ chat_id: chatId, text: added ? `🔔 دنبال می‌کنم: ${found.title}` : 'از قبل دنبال می‌کردی.' });
    }

    if (cmd === '/unwatch') {
      const found = arg ? findVideo((await channel(primary.username)).videos, arg) : null;
      const hash = found?.hash ?? arg;
      if (!hash) return api.sendMessage({ chat_id: chatId, text: 'مثال: /unwatch jdmy31c' });
      await watch.remove(userId, hash);
      return api.sendMessage({ chat_id: chatId, text: '🔕 لغو شد.' });
    }

    if (cmd === '/watches') {
      const rows = await watch.list(userId);
      if (!rows.length) return api.sendMessage({ chat_id: chatId, text: 'چیزی را دنبال نمی‌کنی. با /watch اضافه کن.' });
      const ch = await channel(primary.username);
      const parts = rows.map((r) => {
        const cur = ch.videos.find((v) => v.hash === r.hash);
        const label = cur ? `${cur.title} (اکنون ${cur.views.toLocaleString('en-US')} بازدید)` : `${r.title} (از لیست خارج شد)`;
        return `• <a href="https://www.aparat.com/v/${r.hash}">${label}</a>`;
      });
      return api.sendMessage({
        chat_id: chatId,
        text: `🔔 <b>دنبال‌شده‌ها</b>\n\n${parts.join('\n')}`,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    }

    // متن آزاد = جست‌وجو
    const ch = await channel(primary.username);
    const needle = text.toLowerCase();
    const matches = ch.videos.filter((v) => v.title.toLowerCase().includes(needle));
    if (!matches.length) return api.sendMessage({ chat_id: chatId, text: `چیزی برای «${text}» پیدا نشد. /help را ببین.` });
    if (matches.length === 1) {
      const detail = await videoDetail(matches[0].hash);
      return view(chatId, detailView({ ...matches[0], ...detail }, ch.videos, await watch.has(userId, matches[0].hash)));
    }
    const v = listView({ ...ch, videos: matches }, matches, 'new', 1);
    v.keyboard = listKeyboard(ch.username, 'new', 1, v.pages, v.slice);
    return view(chatId, { text: `🔎 <b>${matches.length} نتیجه</b>\n\n` + v.text, keyboard: v.keyboard });
  } catch (e) {
    console.error('message handler failed', e);
    await api.sendMessage({ chat_id: chatId, text: `⚠️ خطا: ${e.message}` });
  }
}
