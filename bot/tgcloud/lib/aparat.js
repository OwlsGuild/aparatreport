// lib/aparat.js — کلاینت اپارات. تنها جایی که با اپارات حرف می‌زنیم.
// مشترک بین ربات (Serverless) و کرالر (GitHub Actions)، پس fetch تزریق می‌شود:
//   ربات:      createAparat(http)  با http از 'sdk'
//   کرالر:     createAparat(fetch) با fetch سراسری Node
// هیچ importای از 'sdk' اینجا نیست تا هر دو محیط بتوانند این فایل را بخوانند.

const BASE = 'https://www.aparat.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const PER_PAGE = 10; // سقف اپارات، تست‌شده
const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/** «۸۲۶.۳ هزار» و «۱.۲ میلیون» و «5359» → عدد صحیح */
export function faNum(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  const s = String(input ?? '').trim();
  if (!s) return 0;
  const digits = s
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/[،,\s]/g, '');
  const m = digits.match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  let n = parseFloat(m[0]);
  if (s.includes('هزار')) n *= 1e3;
  else if (s.includes('میلیون')) n *= 1e6;
  else if (s.includes('میلیارد')) n *= 1e9;
  return Math.round(n);
}

/** «https://www.aparat.com/ehsanmansoori/» یا «@ehsanmansoori» → «ehsanmansoori» */
export function resolveChannel(ref) {
  const s = String(ref ?? '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (!s) return '';
  if (!s.includes('/')) return s.replace(/^@/, '');
  const parts = s.replace(/^https?:\/\//, '').split('/').filter(Boolean);
  if ((parts[0] ?? '').includes('aparat.com')) parts.shift();
  return (parts[0] ?? '').replace(/^@/, '');
}

/** «2025-02-26 12:10:16» (وقت تهران، بدون DST) → میلی‌ثانیه */
export function parseDate(s) {
  if (!s) return null;
  const ms = Date.parse(String(s).replace(' ', 'T') + '+03:30');
  return Number.isFinite(ms) ? ms : null;
}

export const videoUrl = (hash) => `${BASE}/v/${hash}`;

/** اپارات بعضی اعداد را رشته برمی‌گرداند («80989») — همیشه عدد کن */
function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** یک ویدیو از پاسخ لیست یا جزئیات → شکل یکسان */
export function normalizeVideo(a) {
  const views = a.visit_cnt_int ?? a.visit_cnt_non_formatted;
  return {
    hash: a.uid,
    id: String(a.id ?? ''),
    title: a.title ?? '',
    views: views === undefined || views === null ? faNum(a.visit_cnt) : num(views),
    likes: num(a.like_cnt ?? a.like_cnt_non_formatted),
    comments: a.comment_cnt ?? a.comment_cnt_non_formatted ?? null,
    duration: num(a.duration),
    published: parseDate(a.sdate_rss ?? a.sdate_real),
    tags: a.tag_str ?? (Array.isArray(a.tags) ? a.tags.map((t) => t.name).join(',') : ''),
    poster: a.big_poster ?? a.medium_poster ?? a.small_poster ?? null,
    description: (a.description ?? '').slice(0, 400),
    category: a.category?.title ?? a.cat_name ?? '',
  };
}

export function createAparat(http) {
  async function json(url) {
    const res = await http(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`aparat ${res.status}: ${url}`);
    return res.json();
  }

  return {
    /** آمار سطح کانال */
    async profile(username) {
      const j = await json(`${BASE}/api/fa/v1/user/user/information/username/${encodeURIComponent(username)}`);
      const a = j?.data?.attributes ?? {};
      if (!a.username) throw new Error(`channel not found: ${username}`);
      return {
        username: a.username,
        name: a.name ?? a.username,
        followers: a.follower_cnt_num ?? faNum(a.follower_cnt),
        videoCount: faNum(a.video_cnt),
        totalViews: faNum(a.video_visit),
        since: a.start_date ?? null,
      };
    },

    /** جزئیات یک ویدیو — تنها جایی که تعداد کامنت و تگ‌ها می‌آید */
    async video(hash) {
      const j = await json(`${BASE}/api/v0/videos/${encodeURIComponent(hash)}`);
      const a = j?.data;
      if (!a?.uid) throw new Error(`video not found: ${hash}`);
      const v = normalizeVideo(a);
      v.comments = faNum(a.comment_cnt_non_formatted ?? a.comment_cnt ?? 0);
      v.description = (a.description ?? '').slice(0, 600);
      v.tags = a.tags_str ?? a.tag_str ?? '';
      return v;
    },

    /** همهٔ ویدیوهای کانال، جدیدترین اول */
    async videos(username, { maxPages = 20 } = {}) {
      const out = [];
      const seen = new Set();
      for (let page = 1; page <= maxPages; page++) {
        const j = await json(
          `${BASE}/api/fa/v1/user/video/last_videos_more/username/${encodeURIComponent(username)}/page/${page}/perpage/${PER_PAGE}`,
        );
        const items = (j?.included ?? []).filter((x) => x?.type === 'Video').map((x) => normalizeVideo(x.attributes ?? {}));
        const fresh = items.filter((v) => v.hash && !seen.has(v.hash));
        fresh.forEach((v) => seen.add(v.hash));
        out.push(...fresh);
        if (items.length < PER_PAGE) break;
      }
      return out;
    },
  };
}
