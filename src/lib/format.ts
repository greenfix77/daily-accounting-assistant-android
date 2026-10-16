import type { CurrencyCode, Lang } from "./types";
import { groupDigits, toFaDigits, toEnDigits, type CalendarType, formatDateShort, formatDateLong, jalaliMonthLabel } from "./jalali";

export const CURRENCY_LABEL: Record<CurrencyCode, { fa: string; en: string }> = {
  IRT: { fa: "تومان", en: "Toman" },
  IRR: { fa: "ریال", en: "Rial" },
  USD: { fa: "دلار", en: "USD" },
};

/** ۱۲,۴۵۰,۰۰۰ تومان */
export function formatMoney(
  amount: number,
  currency: CurrencyCode = "IRT",
  lang: Lang = "fa",
  withUnit = true
): string {
  const g = groupDigits(Math.round(amount));
  const num = lang === "fa" ? toFaDigits(g) : g;
  if (!withUnit) return num;
  const unit = CURRENCY_LABEL[currency]?.[lang] ?? "";
  if (currency === "USD") return lang === "fa" ? `${num} دلار` : `$${num}`;
  return `${num} ${unit}`;
}

/** Signed: +۲,۵۰۰,۰۰۰ / −۸۵۰,۰۰۰ */
export function formatSignedMoney(
  amount: number,
  sign: 1 | -1,
  currency: CurrencyCode = "IRT",
  lang: Lang = "fa"
): string {
  const g = groupDigits(Math.abs(Math.round(amount)));
  const num = lang === "fa" ? toFaDigits(g) : g;
  const s = sign > 0 ? "+" : "−";
  const unit =
    currency === "USD"
      ? lang === "fa"
        ? " دلار"
        : " USD"
      : ` ${CURRENCY_LABEL[currency]?.[lang] ?? ""}`;
  return `${s}${num}${unit}`;
}

/** compact: ۴.۵ میلیون / ۷۲۰ هزار — for charts */
export function formatMoneyShort(
  amount: number,
  lang: Lang = "fa"
): string {
  const abs = Math.abs(amount);
  const fmt = (v: number, unit: { fa: string; en: string }) => {
    const rounded = Math.round(v * 10) / 10;
    const num = (lang === "fa" ? toFaDigits(String(rounded)) : String(rounded)).replace(/\.0$/, "");
    return lang === "fa" ? `${num} ${unit.fa}` : `${num}${unit.en}`;
  };
  if (abs >= 1_000_000_000) return fmt(amount / 1_000_000_000, { fa: "میلیارد", en: "B" });
  if (abs >= 1_000_000) return fmt(amount / 1_000_000, { fa: "میلیون", en: "M" });
  if (abs >= 1000) return fmt(amount / 1000, { fa: "هزار", en: "K" });
  return lang === "fa" ? toFaDigits(groupDigits(amount)) : groupDigits(amount);
}

/** typed amount input: groups digits and converts to Persian while typing */
export function formatAmountInput(raw: string, lang: Lang = "fa"): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  const g = groupDigits(Number(digits));
  return lang === "fa" ? toFaDigits(g) : g;
}

export function parseAmountInput(raw: string): number {
  // Persian-aware: accept ۲۵۰٬۰۰۰ / 250,000 / ۲۵۰۰۰۰ …
  const digits = toEnDigits(String(raw)).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export { formatDateShort, formatDateLong, jalaliMonthLabel };
export type { CalendarType };
