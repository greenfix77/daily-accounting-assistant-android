// Client-side jalali date helpers + Persian digit utilities.
// Pure conversion math lives in jalali-core.ts (server-safe too).

import {
  toJalali as coreToJalali,
  toGregorian as coreToGregorian,
  jalaliMonthKey as coreMonthKey,
  jalaliMonthRange as coreMonthRange,
} from "./jalali-core";

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export const JALALI_MONTH_NAMES_EN = [
  "Farvardin",
  "Ordibehesht",
  "Khordad",
  "Tir",
  "Mordad",
  "Shahrivar",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bahman",
  "Esfand",
];

// Saturday-first week (Persian convention)
export const WEEKDAY_NAMES_FA = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];
export const WEEKDAY_NAMES_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
export const WEEKDAY_SHORT_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export const toJalali = (d: Date): JalaliDate => coreToJalali(d);
export const toGregorian = (jy: number, jm: number, jd: number): Date =>
  coreToGregorian(jy, jm, jd);
export const jalaliMonthKey = (d: Date): string => coreMonthKey(d);
export const jalaliMonthRange = coreMonthRange;

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: 30 in leap years, 29 otherwise
  const r = coreToJalali(coreToGregorian(jy + 1, 1, 1));
  void r;
  // leap check via conversion round-trip: try day 30
  const d30 = coreToGregorian(jy, 12, 30);
  const back = coreToJalali(d30);
  return back.jd === 30 && back.jm === 12 ? 30 : 29;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addJalaliMonths(d: Date, n: number): Date {
  const j = toJalali(d);
  let total = (j.jy * 12 + (j.jm - 1)) + n;
  let jy = Math.floor(total / 12);
  let jm = (total % 12) + 1;
  if (jm <= 0) {
    jm += 12;
    jy -= 1;
  }
  const maxDay = jalaliMonthLength(jy, jm);
  const jd = Math.min(j.jd, maxDay);
  return toGregorian(jy, jm, jd);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ── Persian digit utilities ─────────────────────────────────
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function toEnDigits(input: string): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function groupDigits(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString();
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `-${out}` : out;
}

// ── Date formatting (calendar-aware) ────────────────────────
export type CalendarType = "jalali" | "gregorian";
export type Lang = "fa" | "en";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "۱۴۰۳/۰۷/۲۱" (jalali) or "2024/10/12" (gregorian), Persian digits when fa */
export function formatDateShort(
  d: Date | string,
  calendar: CalendarType = "jalali",
  lang: Lang = "fa"
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (calendar === "jalali") {
    const j = toJalali(date);
    const s = `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
    return lang === "fa" ? toFaDigits(s) : s;
  }
  const s = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  return lang === "fa" ? toFaDigits(s) : s;
}

/** "۲۱ مهر ۱۴۰۳" style */
export function formatDateLong(
  d: Date | string,
  calendar: CalendarType = "jalali",
  lang: Lang = "fa"
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (calendar === "jalali") {
    const j = toJalali(date);
    const mName = lang === "fa" ? JALALI_MONTH_NAMES[j.jm - 1] : JALALI_MONTH_NAMES_EN[j.jm - 1];
    const s = lang === "fa" ? `${j.jd} ${mName} ${j.jy}` : `${j.jd} ${mName} ${j.jy}`;
    return lang === "fa" ? toFaDigits(s) : s;
  }
  return date.toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** weekday + short date: "شنبه ۲۱ مهر" */
export function formatWeekdayDate(
  d: Date | string,
  calendar: CalendarType = "jalali",
  lang: Lang = "fa"
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // Saturday-first weekday index
  const wd = (date.getDay() + 1) % 7;
  const wdName = lang === "fa" ? WEEKDAY_NAMES_FA[wd] : WEEKDAY_NAMES_EN[wd];
  if (calendar === "jalali") {
    const j = toJalali(date);
    const mName = lang === "fa" ? JALALI_MONTH_NAMES[j.jm - 1] : JALALI_MONTH_NAMES_EN[j.jm - 1];
    const s = `${j.jd} ${mName}`;
    return lang === "fa" ? `${wdName} ${toFaDigits(s)}` : `${wdName} ${s}`;
  }
  const s = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  return lang === "fa" ? `${wdName} ${toFaDigits(s)}` : `${wdName} ${s}`;
}

/** "۱۴۰۳/۰۷/۲۱ - ۱۸:۳۰" */
export function formatDateTime(
  d: Date | string,
  calendar: CalendarType = "jalali",
  lang: Lang = "fa"
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${formatDateShort(date, calendar, lang)} - ${lang === "fa" ? toFaDigits(hm) : hm}`;
}

export function formatTime(d: Date | string, lang: Lang = "fa"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return lang === "fa" ? toFaDigits(hm) : hm;
}

/** true when the datetime carries a non-midnight time (entered manually or
 *  stamped at entry) — legacy rows stored at 00:00 show date only */
export function hasTimePart(d: Date | string): boolean {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.getHours() !== 0 || x.getMinutes() !== 0 || x.getSeconds() !== 0;
}

/** Jalali month display name: "مهر ۱۴۰۳" */
export function jalaliMonthLabel(key: string, lang: Lang = "fa"): string {
  const [y, m] = key.split("-").map(Number);
  const mName = lang === "fa" ? JALALI_MONTH_NAMES[m - 1] : JALALI_MONTH_NAMES_EN[m - 1];
  const s = `${mName} ${y}`;
  return lang === "fa" ? toFaDigits(s) : s;
}

/** relative label: امروز / دیروز / ۳ روز دیگر / ۵ روز پیش */
export function daysFromNowLabel(
  d: Date | string,
  lang: Lang = "fa"
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Math.round(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000
  );
  if (lang === "en") {
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff > 0) return `In ${diff} days`;
    return `${-diff} days ago`;
  }
  if (diff === 0) return "امروز";
  if (diff === 1) return "فردا";
  if (diff === -1) return "دیروز";
  if (diff > 0) return toFaDigits(`${diff} روز دیگر`);
  return toFaDigits(`${-diff} روز پیش`);
}

/** ISO date (local) "YYYY-MM-DD" */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** parse "1403/07/21" (or Persian digits) into a Date */
export function parseJalaliInput(input: string): Date | null {
  const clean = toEnDigits(input).replace(/[-.]/g, "/").trim();
  const m = clean.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return toGregorian(jy, jm, jd);
}

/** weekday label for a date with Saturday-first ordering */
export function weekdayName(d: Date | string, lang: Lang = "fa"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const wd = (date.getDay() + 1) % 7;
  return lang === "fa" ? WEEKDAY_NAMES_FA[wd] : WEEKDAY_NAMES_EN[wd];
}
