// watcher/preview.mjs — نمایش شبهتلگرامی همهٔ پاسخها از دادهی واقعی.  node watcher/preview.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  changesView,
  detailView,
  helpText,
  listView,
  menuKeyboard,
  statsView,
  topView,
  watchesView,
} from '../bot/tgcloud/lib/render.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const latest = JSON.parse(await fs.readFile(path.join(ROOT, 'data/c/ehsanmansoori/latest.json'), 'utf8'));
const videos = latest.videos;
const ch = { username: 'ehsanmansoori', title: latest.channel.name, profile: latest.channel, videos };

const plain = (t) => t.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const show = (title, v) => {
  console.log(`\n${'═'.repeat(46)}\n▸ ${title}\n${'─'.repeat(46)}\n${plain(v.text)}`);
  const rows = v.keyboard?.inline_keyboard;
  if (rows) console.log(`\n  دکمهها: ${rows.map((r) => r.map((b) => b.text).join(' | ')).join('\n           ')}`);
};
const showMenu = () =>
  console.log(
    `\n  منوی پایین: ${menuKeyboard.keyboard.map((r) => r.map((b) => b.text).join(' | ')).join('\n              ')}`,
  );

show('آمار کانال (شروع و دکمهٔ آمار)', statsView(ch, videos));
showMenu();
show('لیست ویدیوها — تازهترین، صفحهٔ ۱', listView(ch, videos, 'new', 1));
show('لیست ویدیوها — پربازدید', listView(ch, videos, 'views', 1));
show('برترینها', topView(ch, videos, null, null));
show('تغییرات (بدون تاریخ در دسترس)', changesView(ch, null, '24h'));
show('تغییرات ۲۴ ساعت (نمونه)', changesView(ch, [{ video: videos[0], dViews: 312, dLikes: 9, hours: 24 }], '۲۴ ساعت'));
show('پیگیریهای من', watchesView([{ hash: videos[0].hash, title: videos[0].title }], ch));
show('جزئیات یک ویدیو', detailView(videos[0], videos, false));
console.log(`\n${'═'.repeat(46)}\n▸ راهنما\n${'─'.repeat(46)}\n${plain(helpText)}\n`);
