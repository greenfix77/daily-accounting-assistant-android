// ─────────────────────────────────────────────────────────────
// Home-screen widget registry (ویجت‌های صفحه اصلی).
// The user can enable/disable every widget in Settings and
// reorder them on the home screen via long-press drag.
// Persisted on the profile as JSON: {"order":[...],"off":[...]}
//
// «summary» is one sortable unit that renders the two small
// cards (بدهی و طلب + اهداف پس‌انداز) side by side; each card
// can still be turned off individually via «debts» / «goals».
// Hero (موجودی کل) and today's income/expense are fixed and
// always visible.
// ─────────────────────────────────────────────────────────────

export type HomeWidgetId =
  | "budget"
  | "recentTx"
  | "upcoming"
  | "summary"
  | "dayCounter"
  | "prices"
  | "wallets";

/** Sub-toggles inside the summary unit (only usable in the off-list). */
export type HomeSubWidgetId = "debts" | "goals";

const DEFAULT_ORDER: HomeWidgetId[] = [
  "budget",
  "recentTx",
  "upcoming",
  "summary",
  "dayCounter",
  "prices",
  "wallets",
];

const ORDER_IDS = new Set<string>(DEFAULT_ORDER);
const OFF_IDS = new Set<string>([...DEFAULT_ORDER, "debts", "goals"]);

export interface ParsedHomeWidgets {
  order: HomeWidgetId[];
  off: string[];
}

/**
 * Parse the stored JSON safely. Unknown ids are dropped, missing
 * default ids are appended (so future widgets appear automatically),
 * duplicates are removed. `dayCounterOn` seeds the legacy fallback
 * for the day-counter widget (v1.0.13 setting).
 */
export function parseHomeWidgets(
  raw: string | null | undefined,
  dayCounterOn?: boolean
): ParsedHomeWidgets {
  let order: string[] = [];
  let off: string[] = [];
  if (raw) {
    try {
      const j = JSON.parse(raw) as { order?: unknown; off?: unknown };
      if (Array.isArray(j.order)) order = j.order.filter((x): x is string => typeof x === "string");
      if (Array.isArray(j.off)) off = j.off.filter((x): x is string => typeof x === "string");
    } catch {
      /* corrupted → defaults below */
    }
  }
  order = order.filter((id) => ORDER_IDS.has(id));
  off = off.filter((id) => OFF_IDS.has(id));
  // dedupe
  order = [...new Set(order)];
  off = [...new Set(off)];
  // append missing widgets in default position
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);

  // legacy migration: first run (no stored state) — honor old toggle
  if (!raw && dayCounterOn === false) off.push("dayCounter");

  return { order: order as HomeWidgetId[], off };
}

export function serializeHomeWidgets(w: ParsedHomeWidgets): string {
  return JSON.stringify({ order: w.order, off: w.off });
}

export function isWidgetOn(w: ParsedHomeWidgets, id: HomeWidgetId): boolean {
  return !w.off.includes(id);
}

export function isSubOn(w: ParsedHomeWidgets, id: HomeSubWidgetId): boolean {
  return !w.off.includes(id);
}
