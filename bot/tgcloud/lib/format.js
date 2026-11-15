// lib/format.js — نمایش فارسی اعداد، تاریخ و متن.

const FA = '۰۱۲۳۴۵۶۷۸۹';

/** هر عدد یا رشته → ارقام فارسی (عدد با جداکنندهٔ هزارگان «٫») */
export function fa(n) {
  const s =
    typeof n === 'number' && Number.isFinite(n)
      ? n.toLocaleString('en-US').replace(/,/g, '٫')
      : String(n ?? '');
  return s.replace(/\d/g, (d) => FA[+d]);
}

/** «۸۰.۹۸۷ بازدید» با شکل فشرده برای اعداد بزرگ */
export function compact(n) {
  const v = Number(n ?? 0);
  const fmt = (x) => fa(Number(x.toFixed(1))); // 81.0 → ۸۱
  if (v >= 1e6) return `${fmt(v / 1e6)} میلیون`;
  if (v >= 1e3) return `${fmt(v / 1e3)} هزار`;
  return fa(v);
}

/** ثانیه → «۱۲:۳۰» یا «۱:۰۲:۰۳» */
export function duration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (x) => fa(String(x).padStart(2, '0'));
  return h ? `${fa(h)}:${two(m)}:${two(ss)}` : `${fa(m)}:${two(ss)}`;
}

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];
const UNIT_FA = { year: 'سال', month: 'ماه', week: 'هفته', day: 'روز', hour: 'ساعت', minute: 'دقیقه' };

/** میلی‌ثانیه → «۳ روز پیش» */
export function ago(ms) {
  if (!ms) return 'نامشخص';
  const d = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (d < 60) return 'همین حالا';
  for (const [unit, size] of UNITS) {
    const n = Math.floor(d / size);
    if (n >= 1) return `${fa(n)} ${UNIT_FA[unit]} پیش`;
  }
  return 'همین حالا';
}

/** تاریخ شمسی کوتاه: «۱۴۰۳/۱۲/۰۷» */
export function jalali(ms) {
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/** درصد با یک رقم اعشار: 0.0412 → «۴.۱٪» */
export function pct(x) {
  return `${fa((Number(x) || 0) * 100 < 10 ? (Number(x) * 100).toFixed(1) : Math.round(Number(x) * 100))}٪`;
}

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** ۱۲۳۴۵ → +۱۲٫۳۴۵ با علامت */
export function delta(n) {
  const v = Math.round(Number(n) || 0);
  if (!v) return '—';
  return (v > 0 ? '+' : '−') + fa(Math.abs(v));
}
