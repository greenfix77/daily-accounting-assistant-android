"use client";

// ─────────────────────────────────────────────────────────────
// Local (offline) data layer — the client-side twin of every
// /api/* route. Replicates each route's logic 1:1: validation
// rules, exact Persian error strings (thrown as ApiError so the
// UI toasts stay identical), default values, sort orders and
// computed fields. Backed by Dexie (IndexedDB) via ./db.
// ─────────────────────────────────────────────────────────────

import { ApiError } from "../api";
import {
  toJalali,
  toGregorian,
  jalaliMonthKey,
  jalaliMonthRange,
} from "../jalali-core";
import {
  getDb,
  newId,
  type AccountRow,
  type BudgetRow,
  type CategoryRow,
  type DayCounterRow,
  type DebtPaymentRow,
  type DebtRow,
  type HesabyarDB,
  type ProfileRow,
  type RecurringRow,
  type ReminderRow,
  type SavingsDepositRow,
  type SavingsGoalRow,
  type TransactionRow,
  type WalletEntryRow,
  type WalletRow,
} from "./db";
import type {
  AccountDTO,
  BudgetItemDTO,
  BudgetsDTO,
  CategoryDTO,
  CategoryType,
  DashboardDTO,
  DayCounterDesign,
  DayCounterDTO,
  DebtDTO,
  DebtStatus,
  DebtType,
  ProfileDTO,
  RecurringDTO,
  ReminderDTO,
  ReportsDTO,
  ReportPeriod,
  SavingsGoalDTO,
  TransactionDTO,
  UpcomingDTO,
  WalletAlertDTO,
  WalletDTO,
  WalletEntryDTO,
  WalletLinkedAccountDTO,
  WalletsOverviewDTO,
} from "../types";
import { computeDayCounter } from "../day-counter";

// ── guards & shared helpers ──────────────────────────────────

const TX_TYPES = ["INCOME", "EXPENSE", "TRANSFER"];
const ACCOUNT_TYPES = ["BANK", "CASH", "SAVINGS", "CUSTOM"];
const CATEGORY_TYPES = ["INCOME", "EXPENSE"];
const DEBT_TYPES = ["OWED_TO_ME", "I_OWE"];
const REC_TYPES = ["EXPENSE", "INCOME"];
const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const REMINDER_TYPES = ["BILL", "INSTALLMENT", "DEBT", "SAVINGS", "CUSTOM"];
const REPEATS = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const DC_DESIGNS = ["RING", "FLIP", "BAR"];

/** Throws the friendly offline error when there is no IndexedDB (SSR/prerender). */
function db(): HesabyarDB {
  const d = getDb();
  if (!d) throw new Error("حافظه محلی در دسترس نیست");
  return d;
}

type Row = Record<string, unknown>;

// Body coercion helpers — identical semantics to app/api/_lib/core.ts
function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function toInt(v: unknown): number | undefined {
  const n = toNum(v);
  return n === undefined ? undefined : Math.trunc(n);
}

function toStr(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return "";
  return String(v);
}

/** Accepts ISO strings, timestamps or plain "YYYY-MM-DD" (treated as local noon). */
function toDt(v: unknown): Date | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    const [y, m, d] = v.split("-").map((x) => parseInt(x, 10));
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? undefined : dt;
  }
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? undefined : d;
}

// Date helpers — identical semantics to app/api/_lib/core.ts
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + n);
  if (x.getDate() < day) x.setDate(0); // clamp overflow (e.g. Jan 31 → Feb 28)
  return x;
}

function addYears(d: Date, n: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}

/** Days from `from` (default: today start) to target day. Today → 0. */
function dayDiff(target: Date, from?: Date): number {
  const base = from ?? startOfDay(new Date());
  return Math.ceil((startOfDay(target).getTime() - base.getTime()) / 86_400_000);
}

/** Parse "1403-07" jalali month key → {key, jy, jm, start, end}. Falls back to current month. */
function parseMonthKey(key: string | null | undefined) {
  const k = key && /^\d{4}-\d{2}$/.test(key.trim()) ? key.trim() : jalaliMonthKey(new Date());
  const [jy, jm] = k.split("-").map((v) => parseInt(v, 10));
  const start = toGregorian(jy, jm, 1);
  const nm = jm === 12 ? 1 : jm + 1;
  const ny = jm === 12 ? jy + 1 : jy;
  const end = toGregorian(ny, nm, 1);
  return { key: k, jy, jm, start, end };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const ms = (iso: string): number => new Date(iso).getTime();
// calendar-day granularity — entry/tx dates mix startOfDay (00:00) and full
// timestamps (e.g. wallet initial balance), so same-day rows must order by
// creation sequence, not raw timestamp
const dayMs = (iso: string): number => {
  const dt = new Date(iso);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
};

// ── DTO mappers (mirror app/api/_lib/core.ts) ────────────────

type AccMap = Map<string, AccountRow>;
type CatMap = Map<string, CategoryRow>;
type WalletMap = Map<string, WalletRow>;

async function loadMaps(
  d: HesabyarDB,
): Promise<{ accMap: AccMap; catMap: CatMap; walletMap: WalletMap }> {
  const [accounts, categories, wallets] = await Promise.all([
    d.accounts.toArray(),
    d.categories.toArray(),
    d.wallets.toArray(),
  ]);
  return {
    accMap: new Map(accounts.map((a) => [a.id, a])),
    catMap: new Map(categories.map((c) => [c.id, c])),
    walletMap: new Map(wallets.map((w) => [w.id, w])),
  };
}

function txDTO(
  tx: TransactionRow,
  accMap: AccMap,
  catMap: CatMap,
  walletMap?: WalletMap,
): TransactionDTO {
  const account = accMap.get(tx.accountId);
  const toAccount = tx.toAccountId ? accMap.get(tx.toAccountId) : undefined;
  const category = tx.categoryId ? catMap.get(tx.categoryId) : undefined;
  return {
    id: tx.id,
    type: tx.type as TransactionDTO["type"],
    amount: tx.amount,
    title: tx.title,
    description: tx.description,
    notes: tx.notes,
    receiptUrl: tx.receiptUrl,
    accountId: tx.accountId,
    accountName: account?.name ?? "",
    toAccountId: tx.toAccountId,
    toAccountName: toAccount?.name ?? null,
    categoryId: tx.categoryId,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    categoryIcon: category?.icon ?? null,
    walletId: tx.walletId ?? null,
    walletName: tx.walletId ? (walletMap?.get(tx.walletId)?.title ?? null) : null,
    walletEntryId: tx.walletEntryId ?? null,
    date: tx.date,
    createdAt: tx.createdAt,
  };
}

function profileDTO(p: ProfileRow): ProfileDTO {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    avatar: p.avatar,
    language: p.language as ProfileDTO["language"],
    theme: p.theme as ProfileDTO["theme"],
    calendar: p.calendar as ProfileDTO["calendar"],
    currency: p.currency as ProfileDTO["currency"],
    weekStart: p.weekStart as ProfileDTO["weekStart"],
    appLock: p.appLock,
    pin: p.pin,
    biometricLock: p.biometricLock,
    notificationsEnabled: p.notificationsEnabled,
    dayCounterOnHome: Boolean(p.dayCounterOnHome),
    homeWidgets: p.homeWidgets ?? "",
    onboarded: p.onboarded,
    createdAt: p.createdAt,
  };
}

// ── Installments (اقساط) — pure payment tracker, no accounting ──

function stepDate(d: Date, frequency: string): Date {
  switch (frequency) {
    case "DAILY":
      return addDays(d, 1);
    case "WEEKLY":
      return addDays(d, 7);
    case "YEARLY":
      return addYears(d, 1);
    default:
      return addMonths(d, 1);
  }
}

/** Due date of installment #n (1-based) = startDate + (n−1) × frequency. */
function installmentDueDate(
  r: { frequency: string; startDate: string },
  n: number,
): Date {
  let cur = new Date(r.startDate);
  for (let i = 1; i < n && i < 5000; i++) cur = stepDate(cur, r.frequency);
  return cur;
}

/** Backward-compat: synthesize paidMap for legacy rows that only had paidCount. */
function normalizePaidMap(r: RecurringRow): Record<string, string> {
  if (r.paidMap) return r.paidMap;
  const map: Record<string, string> = {};
  const total = r.totalCount ?? Infinity;
  const cnt = Math.min(r.paidCount ?? 0, total);
  for (let n = 1; n <= cnt && n < 5000; n++) {
    map[String(n)] = installmentDueDate(r, n).toISOString();
  }
  return map;
}

/** Keep paidCount / lastPaidAt consistent with paidMap. */
function syncPaidFields(row: RecurringRow): RecurringRow {
  const map = row.paidMap ?? {};
  const dates = Object.values(map).sort();
  return {
    ...row,
    paidCount: Object.keys(map).length,
    lastPaidAt: dates.length ? dates[dates.length - 1] : null,
  };
}

/** First unpaid installment's due date (null = finished or paused). */
function nextDue(r: RecurringRow): Date | null {
  if (!r.isActive) return null;
  const total = r.totalCount;
  if (total != null) {
    const paid = r.paidMap ?? {};
    for (let n = 1; n <= total && n < 5000; n++) {
      if (!paid[String(n)]) return installmentDueDate(r, n);
    }
    return null;
  }
  // legacy rows without a total count: first occurrence after max(lastPaidAt, startDate−1s)
  const last = r.lastPaidAt ? ms(r.lastPaidAt) : -Infinity;
  const reference = Math.max(last, ms(r.startDate) - 1000);
  let cur = new Date(r.startDate);
  let guard = 0;
  while (cur.getTime() <= reference && guard < 5000) {
    cur = stepDate(cur, r.frequency);
    guard += 1;
  }
  if (guard >= 5000) return null;
  if (r.endDate && cur.getTime() > ms(r.endDate)) return null;
  return cur;
}

function recurDTO(r: RecurringRow): RecurringDTO {
  const paidMap = normalizePaidMap(r);
  const paidCount = Object.keys(paidMap).length;
  const nd = nextDue(r);
  const paidDates = Object.values(paidMap).sort();
  return {
    id: r.id,
    title: r.title,
    amount: r.amount,
    frequency: r.frequency as RecurringDTO["frequency"],
    startDate: r.startDate,
    totalCount: r.totalCount,
    paidCount,
    lastPaidAt: paidDates.length ? paidDates[paidDates.length - 1] : r.lastPaidAt,
    isActive: r.isActive,
    nextDue: nd ? nd.toISOString() : null,
    paidMap,
  };
}

// ── Budget item DTO (spent for its own jalali month) ─────────

async function budgetItemDTO(d: HesabyarDB, b: BudgetRow, catMap: CatMap): Promise<BudgetItemDTO> {
  const r = parseMonthKey(b.month);
  const txs = await d.transactions.toArray();
  let spent = 0;
  for (const t of txs) {
    if (t.type !== "EXPENSE") continue;
    if (b.categoryId && t.categoryId !== b.categoryId) continue;
    const ts = ms(t.date);
    if (ts >= r.start.getTime() && ts < r.end.getTime()) spent += t.amount;
  }
  const category = b.categoryId ? catMap.get(b.categoryId) : undefined;
  return {
    id: b.id,
    month: b.month,
    categoryId: b.categoryId,
    categoryName: category?.name ?? null,
    categoryIcon: category?.icon ?? null,
    categoryColor: category?.color ?? null,
    amount: b.amount,
    spent,
    percent: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
  };
}

// ── Debt DTO ─────────────────────────────────────────────────

function debtDTO(d0: DebtRow, payments: DebtPaymentRow[]): DebtDTO {
  const todayStart = startOfDay(new Date());
  const remaining = Math.max(0, d0.amount - d0.paidAmount);
  let status: DebtStatus = "PENDING";
  if (d0.paidAmount >= d0.amount) status = "PAID";
  else if (d0.dueDate && ms(d0.dueDate) < todayStart.getTime()) status = "OVERDUE";
  const sorted = [...payments].sort((a, b) => ms(b.date) - ms(a.date));
  return {
    id: d0.id,
    person: d0.person,
    type: d0.type as DebtType,
    amount: d0.amount,
    paidAmount: d0.paidAmount,
    remaining,
    date: d0.date,
    dueDate: d0.dueDate,
    notes: d0.notes,
    status,
    settledAt: d0.settledAt,
    payments: sorted.map((p) => ({ id: p.id, amount: p.amount, date: p.date, notes: p.notes })),
  };
}

// ── Savings goal DTO ─────────────────────────────────────────

function savingsDTO(g: SavingsGoalRow, deposits: SavingsDepositRow[]): SavingsGoalDTO {
  const current = deposits.reduce((s, x) => s + x.amount, 0);
  const percent = g.targetAmount > 0 ? Math.min(100, Math.round((current / g.targetAmount) * 100)) : 0;
  return {
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    targetDate: g.targetDate,
    color: g.color,
    icon: g.icon,
    current,
    percent,
    deposits: [...deposits]
      .sort((a, b) => ms(b.date) - ms(a.date))
      .map((x) => ({ id: x.id, amount: x.amount, date: x.date, notes: x.notes })),
  };
}

// ── Reminder DTO ─────────────────────────────────────────────

function reminderDTO(r: ReminderRow): ReminderDTO {
  const todayStart = startOfDay(new Date());
  const daysLeft = Math.ceil((startOfDay(new Date(r.date)).getTime() - todayStart.getTime()) / 86_400_000);
  return {
    id: r.id,
    title: r.title,
    type: r.type as ReminderDTO["type"],
    date: r.date,
    time: r.time,
    repeat: r.repeat,
    isDone: r.isDone,
    daysLeft,
  };
}

// ── Account balance (mirror accounts route formula) ──────────

function computeBalance(
  id: string,
  initialBalance: number,
  txs: Array<{ type: string; amount: number; accountId: string; toAccountId: string | null }>,
): number {
  let balance = initialBalance;
  for (const t of txs) {
    if (t.accountId === id) {
      if (t.type === "INCOME") balance += t.amount;
      else if (t.type === "EXPENSE") balance -= t.amount;
      else if (t.type === "TRANSFER") balance -= t.amount;
    }
    if (t.type === "TRANSFER" && t.toAccountId === id) balance += t.amount;
  }
  return balance;
}

function accountDTO(a: AccountRow, txs: TransactionRow[]): AccountDTO {
  return {
    id: a.id,
    name: a.name,
    type: a.type as AccountDTO["type"],
    color: a.color,
    icon: a.icon,
    initialBalance: a.initialBalance,
    isDefault: a.isDefault,
    balance: computeBalance(a.id, a.initialBalance, txs),
  };
}

/** per-account running balances over the FULL ledger (chronological, calendar-day
 *  granularity — mirrors computeBalance) → txId → balance of the row's primary
 *  account right after that transaction */
function buildBalanceAfterMap(
  txs: TransactionRow[],
  accounts: AccountRow[],
): Map<string, number> {
  const chron = [...txs].sort(
    (a, b) => dayMs(a.date) - dayMs(b.date) || ms(a.createdAt) - ms(b.createdAt)
  );
  const running = new Map<string, number>();
  for (const acc of accounts) running.set(acc.id, acc.initialBalance);
  const after = new Map<string, number>();
  for (const t of chron) {
    let r = running.get(t.accountId) ?? 0;
    if (t.type === "INCOME") r += t.amount;
    else r -= t.amount; // EXPENSE or TRANSFER out of the source account
    running.set(t.accountId, r);
    after.set(t.id, r);
    // a TRANSFER row is stored once on the source account with toAccountId on
    // the destination — credit the destination's running balance too (mirrors
    // computeBalance); otherwise every destination-account balance after the
    // transfer drifts down by the transfer amount
    if (t.type === "TRANSFER" && t.toAccountId) {
      running.set(t.toAccountId, (running.get(t.toAccountId) ?? 0) + t.amount);
    }
  }
  return after;
}

// ═════════════════════════════════════════════════════════════
// Settings / Profile  (GET + PATCH /api/settings)
// ═════════════════════════════════════════════════════════════

async function ensureProfile(d: HesabyarDB): Promise<ProfileRow> {
  const existing = await d.profile.get("main");
  if (existing) return existing;
  const created: ProfileRow = {
    id: "main",
    name: "کاربر",
    email: "",
    avatar: null,
    language: "fa",
    theme: "light",
    calendar: "jalali",
    currency: "IRT",
    weekStart: "sat",
    appLock: false,
    pin: null,
    biometricLock: false,
    notificationsEnabled: true,
    dayCounterOnHome: false,
    homeWidgets: "",
    onboarded: false,
    createdAt: new Date().toISOString(),
  };
  await d.profile.add(created);
  return created;
}

export async function getSettings(): Promise<ProfileDTO> {
  const d = db();
  return profileDTO(await ensureProfile(d));
}

export async function updateSettings(patch: object): Promise<ProfileDTO> {
  const d = db();
  const p = patch as Record<string, unknown>;
  const data: Partial<ProfileRow> = {};

  if (p.name !== undefined) data.name = String(p.name);
  if (p.email !== undefined) data.email = String(p.email);
  if (p.avatar !== undefined) data.avatar = p.avatar === null ? null : String(p.avatar);
  if (p.language !== undefined) data.language = String(p.language);
  if (p.theme !== undefined) data.theme = String(p.theme);
  if (p.calendar !== undefined) data.calendar = String(p.calendar);
  if (p.currency !== undefined) data.currency = String(p.currency);
  if (p.weekStart !== undefined) data.weekStart = String(p.weekStart);
  if (p.pin !== undefined) data.pin = p.pin === null ? null : String(p.pin);
  if (p.appLock !== undefined) data.appLock = Boolean(p.appLock);
  if (p.biometricLock !== undefined) data.biometricLock = Boolean(p.biometricLock);
  if (p.notificationsEnabled !== undefined) data.notificationsEnabled = Boolean(p.notificationsEnabled);
  if (p.dayCounterOnHome !== undefined) data.dayCounterOnHome = Boolean(p.dayCounterOnHome);
  if (p.homeWidgets !== undefined) data.homeWidgets = String(p.homeWidgets);
  if (p.onboarded !== undefined) data.onboarded = Boolean(p.onboarded);

  const profile = await ensureProfile(d);
  const updated: ProfileRow = { ...profile, ...data };
  await d.profile.put(updated);
  return profileDTO(updated);
}

// ═════════════════════════════════════════════════════════════
// Auth  (POST /api/auth/login, POST /api/auth/register)
// ═════════════════════════════════════════════════════════════

export async function login(email: string): Promise<ProfileDTO> {
  const d = db();
  const e = typeof email === "string" ? email.trim() : "";
  if (!e) throw new ApiError("ایمیل الزامی است", 400);

  const profile = await d.profile.get("main");
  if (!profile || profile.email !== e) {
    throw new ApiError("ایمیل یافت نشد", 401);
  }
  return profileDTO(profile);
}

export async function register(body: { name?: string; email?: string }): Promise<ProfileDTO> {
  const d = db();
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "کاربر";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) throw new ApiError("ایمیل الزامی است", 400);

  const existing = await d.profile.get("main");
  const row: ProfileRow = existing
    ? { ...existing, name, email, onboarded: true }
    : {
        id: "main",
        name,
        email,
        avatar: null,
        language: "fa",
        theme: "light",
        calendar: "jalali",
        currency: "IRT",
        weekStart: "sat",
        appLock: false,
        pin: null,
        biometricLock: false,
        notificationsEnabled: true,
        dayCounterOnHome: false,
        homeWidgets: "",
        onboarded: true,
        createdAt: new Date().toISOString(),
      };
  await d.profile.put(row);
  return profileDTO(row);
}

// ═════════════════════════════════════════════════════════════
// Transactions  (GET/POST /api/transactions, /api/transactions/[id])
// ═════════════════════════════════════════════════════════════

export interface TxFilters {
  type?: string;
  q?: string;
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  limit?: number;
}

export async function getTransactions(filters: TxFilters = {}): Promise<TransactionDTO[]> {
  const d = db();
  const [txs, accounts, { accMap, catMap, walletMap }] = await Promise.all([
    d.transactions.toArray(),
    d.accounts.toArray(),
    loadMaps(d),
  ]);

  const type = filters.type;
  const q = filters.q;
  const accountId = filters.accountId;
  const categoryId = filters.categoryId;
  const from = toDt(filters.from);
  const to = toDt(filters.to);
  const sort = filters.sort ?? "date_desc";
  const limitRaw = toInt(filters.limit);
  const limit = Math.min(Math.max(limitRaw ?? 200, 1), 500);

  let rows = txs;
  if (type && TX_TYPES.includes(type)) rows = rows.filter((t) => t.type === type);
  if (accountId) rows = rows.filter((t) => t.accountId === accountId);
  if (categoryId === "none") rows = rows.filter((t) => t.categoryId === null);
  else if (categoryId) rows = rows.filter((t) => t.categoryId === categoryId);
  if (q) {
    // LIKE '%q%' — case-insensitive for ASCII; Persian has no case.
    const needle = q.toLowerCase();
    rows = rows.filter(
      (t) =>
        (t.title ?? "").toLowerCase().includes(needle) ||
        (t.description ?? "").toLowerCase().includes(needle) ||
        (t.notes ?? "").toLowerCase().includes(needle),
    );
  }
  if (from || to) {
    // bare "YYYY-MM-DD" `to` includes the whole end day
    const bareTo =
      typeof filters.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filters.to.trim())
        ? to!
        : null;
    const toTs = bareTo
      ? new Date(bareTo.getFullYear(), bareTo.getMonth(), bareTo.getDate(), 23, 59, 59, 999).getTime()
      : to
        ? to.getTime()
        : null;
    rows = rows.filter((t) => {
      const ts = ms(t.date);
      if (from && ts < from.getTime()) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }

  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case "date_asc":
        return dayMs(a.date) - dayMs(b.date) || ms(a.createdAt) - ms(b.createdAt);
      case "amount_desc":
        return b.amount - a.amount || dayMs(b.date) - dayMs(a.date);
      case "amount_asc":
        return a.amount - b.amount || dayMs(b.date) - dayMs(a.date);
      default:
        return dayMs(b.date) - dayMs(a.date) || ms(b.createdAt) - ms(a.createdAt);
    }
  });

  // running balance per account over the FULL ledger — a filtered view still
  // shows the real account balance after each transaction. Only meaningful for
  // date-based sorts.
  const dateSorted = sort === "date_desc" || sort === "date_asc";
  const after = dateSorted ? buildBalanceAfterMap(txs, accounts) : new Map<string, number>();
  return sorted
    .slice(0, limit)
    .map((row) => {
      const dto = txDTO(row, accMap, catMap, walletMap);
      dto.balanceAfter = dateSorted ? (after.get(row.id) ?? null) : null;
      return dto;
    });
}

export async function getTransaction(id: string): Promise<TransactionDTO> {
  const d = db();
  const row = await d.transactions.get(id);
  if (!row) throw new ApiError("تراکنش یافت نشد", 404);
  const { accMap, catMap, walletMap } = await loadMaps(d);
  return txDTO(row, accMap, catMap, walletMap);
}

// ── Wallet-sourced transactions (add-transaction screen, wallet source) ──
// source === "WALLET": always creates a WalletEntry (IN/OUT). When the user
// also picks a linked account, a paired Transaction row is created on that
// account too — walletId + walletEntryId tie the two ledgers together so the
// account takes part in the financial calculations. Picking «هیچکدام» keeps
// the impact wallet-only (no transaction row, no accounting side-effects).

async function saveWalletTransaction(
  d: HesabyarDB,
  body: Record<string, unknown>,
): Promise<TransactionDTO | WalletEntryDTO> {
  const type = typeof body.type === "string" ? body.type : "";
  if (type !== "INCOME" && type !== "EXPENSE")
    throw new ApiError("برای تراکنش کیف پول فقط درآمد یا هزینه مجاز است", 400);

  const amount = toNum(body.amount);
  if (amount === undefined || amount <= 0)
    throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);

  const walletId = toStr(body.walletId);
  if (!walletId) throw new ApiError("کیف پول الزامی است", 400);
  const wallet = await d.wallets.get(walletId);
  if (!wallet) throw new ApiError("کیف پول یافت نشد", 404);

  // optional linked account — must be one of the wallet's linked accounts
  let linkedAccountId: string | null = null;
  if (typeof body.linkedAccountId === "string" && body.linkedAccountId) {
    if (!wallet.linkedAccountIds.includes(body.linkedAccountId))
      throw new ApiError("حساب انتخاب‌شده به این کیف پول متصل نیست", 400);
    const account = await d.accounts.get(body.linkedAccountId);
    if (!account) throw new ApiError("حساب یافت نشد", 400);
    linkedAccountId = account.id;
  }

  let categoryId: string | null = null;
  if (typeof body.categoryId === "string" && body.categoryId) {
    const category = await d.categories.get(body.categoryId);
    if (!category) throw new ApiError("دسته‌بندی یافت نشد", 400);
    categoryId = category.id;
  }

  const date = (toDt(body.date) ?? new Date()).toISOString();
  const note =
    toStr(body.title)?.trim() || toStr(body.description)?.trim() || toStr(body.notes)?.trim() || null;

  const entry: WalletEntryRow = {
    id: newId(),
    walletId,
    type: type === "INCOME" ? "IN" : "OUT",
    amount,
    note,
    date,
    createdAt: new Date().toISOString(),
  };
  await d.walletEntries.add(entry);

  // «هیچکدام» → wallet-only: only the wallet number is affected
  if (!linkedAccountId) return walletEntryDTO(entry);

  const created: TransactionRow = {
    id: newId(),
    type,
    amount,
    title: toStr(body.title) || null,
    description: toStr(body.description) || null,
    notes: toStr(body.notes) || null,
    receiptUrl: toStr(body.receiptUrl) || null,
    accountId: linkedAccountId,
    toAccountId: null,
    categoryId,
    debtId: null,
    recurringId: null,
    walletId,
    walletEntryId: entry.id,
    date,
    createdAt: new Date().toISOString(),
  };
  await d.transactions.add(created);
  const { accMap, catMap, walletMap } = await loadMaps(d);
  return txDTO(created, accMap, catMap, walletMap);
}

async function patchWalletTransaction(
  d: HesabyarDB,
  existing: TransactionRow,
  body: Record<string, unknown>,
): Promise<TransactionDTO | WalletEntryDTO> {
  const walletId = existing.walletId as string;
  const wallet = await d.wallets.get(walletId);
  if (!wallet) throw new ApiError("کیف پول یافت نشد", 404);

  let type = existing.type;
  if (body.type !== undefined) {
    if (typeof body.type !== "string" || (body.type !== "INCOME" && body.type !== "EXPENSE"))
      throw new ApiError("برای تراکنش کیف پول فقط درآمد یا هزینه مجاز است", 400);
    type = body.type;
  }

  let amount = existing.amount;
  if (body.amount !== undefined) {
    const a = toNum(body.amount);
    if (a === undefined || a <= 0) throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);
    amount = a;
  }

  // linked account: change within wallet links, or remove (null → wallet-only)
  let accountId: string | null = existing.accountId;
  if (body.linkedAccountId !== undefined) {
    const raw =
      typeof body.linkedAccountId === "string" && body.linkedAccountId
        ? body.linkedAccountId
        : null;
    if (raw && !wallet.linkedAccountIds.includes(raw))
      throw new ApiError("حساب انتخاب‌شده به این کیف پول متصل نیست", 400);
    if (raw) {
      const account = await d.accounts.get(raw);
      if (!account) throw new ApiError("حساب یافت نشد", 400);
      accountId = account.id;
    } else {
      accountId = null;
    }
  }

  let date = existing.date;
  if (body.date !== undefined) {
    const dt = toDt(body.date);
    if (!dt) throw new ApiError("تاریخ نامعتبر است", 400);
    date = dt.toISOString();
  }

  let title = existing.title;
  if (body.title !== undefined) title = toStr(body.title) || null;
  let description = existing.description;
  if (body.description !== undefined) description = toStr(body.description) || null;
  let notes = existing.notes;
  if (body.notes !== undefined) notes = toStr(body.notes) || null;
  let receiptUrl = existing.receiptUrl;
  if (body.receiptUrl !== undefined) receiptUrl = toStr(body.receiptUrl) || null;

  let categoryId = existing.categoryId;
  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      categoryId = null;
    } else if (typeof body.categoryId === "string") {
      const category = await d.categories.get(body.categoryId);
      if (!category) throw new ApiError("دسته‌بندی یافت نشد", 400);
      categoryId = category.id;
    }
  }

  const note = title?.trim() || description?.trim() || notes?.trim() || null;

  // keep the paired wallet entry in sync
  const walletEntryId = existing.walletEntryId;
  if (walletEntryId) {
    const entry = await d.walletEntries.get(walletEntryId);
    if (entry) {
      await d.walletEntries.put({
        ...entry,
        type: type === "INCOME" ? "IN" : "OUT",
        amount,
        note,
        date,
      });
    }
  }

  // linked account removed → keep only the wallet side: delete the paired
  // transaction row entirely (wallet-only from now on, no accounting impact)
  if (!accountId) {
    if (walletEntryId) {
      const entry = await d.walletEntries.get(walletEntryId);
      if (entry) {
        await d.transactions.delete(existing.id);
        return walletEntryDTO(entry);
      }
    }
    const fallback: WalletEntryRow = {
      id: newId(),
      walletId,
      type: type === "INCOME" ? "IN" : "OUT",
      amount,
      note,
      date,
      createdAt: new Date().toISOString(),
    };
    await d.walletEntries.add(fallback);
    await d.transactions.delete(existing.id);
    return walletEntryDTO(fallback);
  }

  const updated: TransactionRow = {
    ...existing,
    type,
    amount,
    accountId,
    toAccountId: null,
    categoryId,
    title,
    description,
    notes,
    receiptUrl,
    date,
  };
  await d.transactions.put(updated);
  const { accMap, catMap, walletMap } = await loadMaps(d);
  return txDTO(updated, accMap, catMap, walletMap);
}

export async function saveTransaction(
  payload: Record<string, unknown> & { id?: string },
): Promise<TransactionDTO | WalletEntryDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id && body.source === "WALLET") return saveWalletTransaction(d, body);

  if (!id) {
    // ── POST ──
    const type = typeof body.type === "string" ? body.type : "";
    if (!TX_TYPES.includes(type))
      throw new ApiError("نوع تراکنش باید INCOME، EXPENSE یا TRANSFER باشد", 400);

    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);

    const accountId = typeof body.accountId === "string" && body.accountId ? body.accountId : null;
    if (!accountId) throw new ApiError("حساب مبدأ الزامی است", 400);
    const account = await d.accounts.get(accountId);
    if (!account) throw new ApiError("حساب مبدأ یافت نشد", 400);

    let toAccountId: string | null = null;
    if (type === "TRANSFER") {
      toAccountId =
        typeof body.toAccountId === "string" && body.toAccountId ? body.toAccountId : null;
      if (!toAccountId) throw new ApiError("حساب مقصد برای انتقال الزامی است", 400);
      if (toAccountId === accountId)
        throw new ApiError("حساب مقصد نباید با حساب مبدأ یکسان باشد", 400);
      const toAccount = await d.accounts.get(toAccountId);
      if (!toAccount) throw new ApiError("حساب مقصد یافت نشد", 400);
    }

    let categoryId: string | null = null;
    if (typeof body.categoryId === "string" && body.categoryId) {
      const category = await d.categories.get(body.categoryId);
      if (!category) throw new ApiError("دسته‌بندی یافت نشد", 400);
      categoryId = category.id;
    }

    const created: TransactionRow = {
      id: newId(),
      type,
      amount,
      title: toStr(body.title) || null,
      description: toStr(body.description) || null,
      notes: toStr(body.notes) || null,
      receiptUrl: toStr(body.receiptUrl) || null,
      accountId,
      toAccountId,
      categoryId,
      debtId: null,
      recurringId: null,
      walletId: null,
      walletEntryId: null,
      date: (toDt(body.date) ?? new Date()).toISOString(),
      createdAt: new Date().toISOString(),
    };
    await d.transactions.add(created);
    const { accMap, catMap, walletMap } = await loadMaps(d);
    return txDTO(created, accMap, catMap, walletMap);
  }

  // ── PATCH ──
  const existing = await d.transactions.get(id);
  if (!existing) throw new ApiError("تراکنش یافت نشد", 404);

  // wallet-linked transaction → dedicated sync path (wallet entry + optional account)
  if (existing.walletId) return patchWalletTransaction(d, existing, body);

  let type = existing.type;
  if (body.type !== undefined) {
    if (typeof body.type !== "string" || !TX_TYPES.includes(body.type))
      throw new ApiError("نوع تراکنش باید INCOME، EXPENSE یا TRANSFER باشد", 400);
    type = body.type;
  }

  let amount = existing.amount;
  if (body.amount !== undefined) {
    const a = toNum(body.amount);
    if (a === undefined || a <= 0) throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);
    amount = a;
  }

  let accountId = existing.accountId;
  if (body.accountId !== undefined) {
    if (typeof body.accountId !== "string" || !body.accountId)
      throw new ApiError("حساب مبدأ الزامی است", 400);
    const account = await d.accounts.get(body.accountId);
    if (!account) throw new ApiError("حساب مبدأ یافت نشد", 400);
    accountId = account.id;
  }

  let toAccountId = existing.toAccountId;
  if (body.toAccountId !== undefined) {
    if (body.toAccountId === null || body.toAccountId === "") {
      toAccountId = null;
    } else if (typeof body.toAccountId === "string") {
      const toAccount = await d.accounts.get(body.toAccountId);
      if (!toAccount) throw new ApiError("حساب مقصد یافت نشد", 400);
      toAccountId = toAccount.id;
    }
  }

  if (type === "TRANSFER") {
    if (!toAccountId) throw new ApiError("حساب مقصد برای انتقال الزامی است", 400);
    if (toAccountId === accountId)
      throw new ApiError("حساب مقصد نباید با حساب مبدأ یکسان باشد", 400);
  } else if (toAccountId) {
    toAccountId = null;
  }

  let categoryId = existing.categoryId;
  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      categoryId = null;
    } else if (typeof body.categoryId === "string") {
      const category = await d.categories.get(body.categoryId);
      if (!category) throw new ApiError("دسته‌بندی یافت نشد", 400);
      categoryId = category.id;
    }
  }

  let title = existing.title;
  if (body.title !== undefined) title = toStr(body.title) || null;
  let description = existing.description;
  if (body.description !== undefined) description = toStr(body.description) || null;
  let notes = existing.notes;
  if (body.notes !== undefined) notes = toStr(body.notes) || null;
  let receiptUrl = existing.receiptUrl;
  if (body.receiptUrl !== undefined) receiptUrl = toStr(body.receiptUrl) || null;

  let date = existing.date;
  if (body.date !== undefined) {
    const dt = toDt(body.date);
    if (!dt) throw new ApiError("تاریخ نامعتبر است", 400);
    date = dt.toISOString();
  }

  const updated: TransactionRow = {
    ...existing,
    type,
    amount,
    accountId,
    toAccountId,
    categoryId,
    title,
    description,
    notes,
    receiptUrl,
    date,
  };
  await d.transactions.put(updated);
  const { accMap, catMap, walletMap } = await loadMaps(d);
  return txDTO(updated, accMap, catMap, walletMap);
}

export async function deleteTransaction(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.transactions.get(id);
  if (!existing) throw new ApiError("تراکنش یافت نشد", 404);
  // wallet-linked transaction → remove the paired wallet entry as well
  if (existing.walletEntryId) await d.walletEntries.delete(existing.walletEntryId);
  await d.transactions.delete(id);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════
// Accounts  (GET/POST /api/accounts, /api/accounts/[id])
// ═════════════════════════════════════════════════════════════

export async function getAccounts(): Promise<AccountDTO[]> {
  const d = db();
  const [accounts, txs] = await Promise.all([d.accounts.toArray(), d.transactions.toArray()]);
  const ordered = [...accounts].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return ms(a.createdAt) - ms(b.createdAt);
  });
  return ordered.map((a) => accountDTO(a, txs));
}

export async function saveAccount(
  payload: Record<string, unknown> & { id?: string },
): Promise<AccountDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id) {
    // ── POST ──
    const name = toStr(body.name)?.trim();
    if (!name) throw new ApiError("نام حساب الزامی است", 400);

    const type = typeof body.type === "string" && body.type ? body.type : "BANK";
    if (!ACCOUNT_TYPES.includes(type)) throw new ApiError("نوع حساب نامعتبر است", 400);

    const initialBalance = toNum(body.initialBalance) ?? 0;
    if (initialBalance < 0) throw new ApiError("موجودی اولیه نمی‌تواند منفی باشد", 400);

    const count = await d.accounts.count();
    const created: AccountRow = {
      id: newId(),
      name,
      type,
      color: toStr(body.color) || "#4E9B72",
      icon: toStr(body.icon) || "landmark",
      initialBalance,
      isDefault: count === 0,
      createdAt: new Date().toISOString(),
    };
    await d.accounts.add(created);
    return {
      id: created.id,
      name: created.name,
      type: created.type as AccountDTO["type"],
      color: created.color,
      icon: created.icon,
      initialBalance: created.initialBalance,
      isDefault: created.isDefault,
      balance: initialBalance,
    };
  }

  // ── PATCH ──
  const existing = await d.accounts.get(id);
  if (!existing) throw new ApiError("حساب یافت نشد", 404);

  const data: Partial<AccountRow> = {};
  if (body.name !== undefined) {
    const name = toStr(body.name)?.trim();
    if (!name) throw new ApiError("نام حساب الزامی است", 400);
    data.name = name;
  }
  if (body.type !== undefined) {
    const type = toStr(body.type) ?? "";
    if (!ACCOUNT_TYPES.includes(type)) throw new ApiError("نوع حساب نامعتبر است", 400);
    data.type = type;
  }
  if (body.color !== undefined) data.color = toStr(body.color) || existing.color;
  if (body.icon !== undefined) data.icon = toStr(body.icon) || existing.icon;
  if (body.initialBalance !== undefined) {
    const initialBalance = toNum(body.initialBalance);
    if (initialBalance === undefined || initialBalance < 0)
      throw new ApiError("موجودی اولیه نمی‌تواند منفی باشد", 400);
    data.initialBalance = initialBalance;
  }

  const updated: AccountRow = { ...existing, ...data };
  await d.accounts.put(updated);
  const txs = await d.transactions.toArray();
  return accountDTO(updated, txs);
}

export async function deleteAccount(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.accounts.get(id);
  if (!existing) throw new ApiError("حساب یافت نشد", 404);

  const count = (await d.transactions.toArray()).filter((t) => t.accountId === id).length;
  if (count > 0) {
    throw new ApiError("این حساب تراکنش دارد و قابل حذف نیست", 409);
  }
  // mirror Prisma cascade: transactions.toAccount → SetNull
  // (اقساط are no longer account-bound — deleting an account never touches them)
  await d.transaction("rw", d.accounts, d.transactions, async () => {
    const toTxs = await d.transactions.where("toAccountId").equals(id).toArray();
    await d.transactions.bulkPut(toTxs.map((t) => ({ ...t, toAccountId: null })));
    await d.accounts.delete(id);
  });
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════
// Categories  (GET/POST /api/categories, /api/categories/[id])
// ═════════════════════════════════════════════════════════════

function categoryDTO(c: CategoryRow): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    type: c.type as CategoryType,
    icon: c.icon,
    color: c.color,
    isDefault: c.isDefault,
  };
}

export async function getCategories(type?: string, stats?: boolean): Promise<CategoryDTO[]> {
  const d = db();
  const categories = await d.categories.toArray();
  let list = categories;
  if (type && CATEGORY_TYPES.includes(type)) list = categories.filter((c) => c.type === type);
  list = [...list].sort((a, b) => {
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    return ms(a.createdAt) - ms(b.createdAt);
  });

  if (!stats) return list.map(categoryDTO);

  // stats: spent for the CURRENT jalali month (EXPENSE only), count over ALL txs
  const month = jalaliMonthRange(new Date());
  const txs = await d.transactions.toArray();
  const spentBy = new Map<string, number>();
  const countBy = new Map<string, number>();
  for (const t of txs) {
    if (!t.categoryId) continue;
    countBy.set(t.categoryId, (countBy.get(t.categoryId) ?? 0) + 1);
    if (t.type === "EXPENSE") {
      const ts = ms(t.date);
      if (ts >= month.start.getTime() && ts < month.end.getTime()) {
        spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + t.amount);
      }
    }
  }

  return list.map((c) => {
    const base: CategoryDTO = {
      ...categoryDTO(c),
      count: countBy.get(c.id) ?? 0,
    };
    if (c.type === "EXPENSE") base.spent = spentBy.get(c.id) ?? 0;
    return base;
  });
}

export async function saveCategory(
  payload: Record<string, unknown> & { id?: string },
): Promise<CategoryDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id) {
    // ── POST ──
    const name = toStr(body.name)?.trim();
    if (!name) throw new ApiError("نام دسته‌بندی الزامی است", 400);
    const type = toStr(body.type) ?? "";
    if (!CATEGORY_TYPES.includes(type))
      throw new ApiError("نوع دسته‌بندی باید INCOME یا EXPENSE باشد", 400);

    const created: CategoryRow = {
      id: newId(),
      name,
      type,
      icon: toStr(body.icon) || "tag",
      color: toStr(body.color) || "#4E9B72",
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    await d.categories.add(created);
    return categoryDTO(created);
  }

  // ── PATCH ──
  const existing = await d.categories.get(id);
  if (!existing) throw new ApiError("دسته‌بندی یافت نشد", 404);

  const data: Partial<CategoryRow> = {};
  if (body.name !== undefined) {
    const name = toStr(body.name)?.trim();
    if (!name) throw new ApiError("نام دسته‌بندی الزامی است", 400);
    data.name = name;
  }
  if (body.type !== undefined) {
    const type = toStr(body.type) ?? "";
    if (!CATEGORY_TYPES.includes(type)) throw new ApiError("نوع دسته‌بندی نامعتبر است", 400);
    data.type = type;
  }
  if (body.icon !== undefined) data.icon = toStr(body.icon) || existing.icon;
  if (body.color !== undefined) data.color = toStr(body.color) || existing.color;

  const updated: CategoryRow = { ...existing, ...data };
  await d.categories.put(updated);
  return categoryDTO(updated);
}

export async function deleteCategory(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.categories.get(id);
  if (!existing) throw new ApiError("دسته‌بندی یافت نشد", 404);

  const count = (await d.transactions.toArray()).filter((t) => t.categoryId === id).length;
  if (count > 0) {
    throw new ApiError("این دسته‌بندی تراکنش دارد و قابل حذف نیست", 409);
  }
  // budgets cascade (schema onDelete: Cascade)
  await d.transaction("rw", d.categories, d.budgets, async () => {
    const bs = await d.budgets.where("categoryId").equals(id).toArray();
    await d.budgets.bulkDelete(bs.map((b) => b.id));
    await d.categories.delete(id);
  });
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════
// Budgets  (GET/POST /api/budgets, /api/budgets/[id])
// ═════════════════════════════════════════════════════════════

export async function getBudgets(month?: string): Promise<BudgetsDTO> {
  const d = db();
  const r = parseMonthKey(month ?? null);
  const [budgets, { catMap }, txs] = await Promise.all([
    d.budgets.toArray(),
    loadMaps(d),
    d.transactions.toArray(),
  ]);
  const monthBudgets = budgets.filter((b) => b.month === r.key);

  let overallSpent = 0;
  const spentBy = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "EXPENSE") continue;
    const ts = ms(t.date);
    if (ts < r.start.getTime() || ts >= r.end.getTime()) continue;
    overallSpent += t.amount;
    if (t.categoryId) spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + t.amount);
  }

  const overall = monthBudgets.find((b) => !b.categoryId) ?? null;
  const items = monthBudgets
    .filter((b) => b.categoryId)
    .map((b) => {
      const category = b.categoryId ? catMap.get(b.categoryId) : undefined;
      const spent = spentBy.get(b.categoryId as string) ?? 0;
      return {
        id: b.id,
        month: b.month,
        categoryId: b.categoryId,
        categoryName: category?.name ?? null,
        categoryIcon: category?.icon ?? null,
        categoryColor: category?.color ?? null,
        amount: b.amount,
        spent,
        percent: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  return { month: r.key, total: overall?.amount ?? 0, items, overallSpent };
}

export async function saveBudget(
  payload: Record<string, unknown> & { id?: string },
): Promise<BudgetItemDTO> {
  const d = db();
  const { id, ...body } = payload;
  const { catMap } = await loadMaps(d);

  if (!id) {
    // ── POST → upsert by (month, categoryId) ──
    const month =
      typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month.trim())
        ? body.month.trim()
        : jalaliMonthKey(new Date());
    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ بودجه باید بزرگ‌تر از صفر باشد", 400);

    let categoryId: string | null = null;
    if (body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== "") {
      if (typeof body.categoryId !== "string") throw new ApiError("دسته‌بندی نامعتبر است", 400);
      const category = await d.categories.get(body.categoryId);
      if (!category) throw new ApiError("دسته‌بندی یافت نشد", 400);
      categoryId = category.id;
    }

    const budgets = await d.budgets.toArray();
    const existing = budgets.find((b) => b.month === month && b.categoryId === categoryId);
    const row: BudgetRow = existing
      ? { ...existing, amount }
      : { id: newId(), month, categoryId, amount, createdAt: new Date().toISOString() };
    await d.budgets.put(row);
    return budgetItemDTO(d, row, catMap);
  }

  // ── PATCH ──
  const existing = await d.budgets.get(id);
  if (!existing) throw new ApiError("بودجه یافت نشد", 404);

  const amount = toNum(body.amount);
  if (amount === undefined || amount <= 0)
    throw new ApiError("مبلغ بودجه باید بزرگ‌تر از صفر باشد", 400);

  const updated: BudgetRow = { ...existing, amount };
  await d.budgets.put(updated);
  return budgetItemDTO(d, updated, catMap);
}

export async function deleteBudget(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.budgets.get(id);
  if (!existing) throw new ApiError("بودجه یافت نشد", 404);
  await d.budgets.delete(id);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════
// Debts  (GET/POST /api/debts, [id], [id]/payments)
// ═════════════════════════════════════════════════════════════

export async function getDebts(): Promise<DebtDTO[]> {
  const d = db();
  const [debts, payments] = await Promise.all([d.debts.toArray(), d.debtPayments.toArray()]);
  const byDebt = new Map<string, DebtPaymentRow[]>();
  for (const p of payments) {
    const arr = byDebt.get(p.debtId);
    if (arr) arr.push(p);
    else byDebt.set(p.debtId, [p]);
  }
  const dtos = debts.map((x) => debtDTO(x, byDebt.get(x.id) ?? []));
  dtos.sort((a, b) => {
    const au = a.status !== "PAID";
    const bu = b.status !== "PAID";
    if (au !== bu) return au ? -1 : 1;
    if (au) {
      const ad = a.dueDate ? Date.parse(a.dueDate) : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? Date.parse(b.dueDate) : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }
    return Date.parse(b.settledAt ?? "0") - Date.parse(a.settledAt ?? "0");
  });
  return dtos;
}

export async function saveDebt(
  payload: Record<string, unknown> & { id?: string },
): Promise<DebtDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id) {
    // ── POST ──
    const person = toStr(body.person)?.trim();
    if (!person) throw new ApiError("نام شخص الزامی است", 400);
    const type = toStr(body.type) ?? "";
    if (!DEBT_TYPES.includes(type))
      throw new ApiError("نوع بدهی باید OWED_TO_ME یا I_OWE باشد", 400);
    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);

    const created: DebtRow = {
      id: newId(),
      person,
      type,
      amount,
      paidAmount: 0,
      date: (toDt(body.date) ?? new Date()).toISOString(),
      dueDate: toDt(body.dueDate)?.toISOString() ?? null,
      notes: toStr(body.notes) || null,
      settledAt: null,
      createdAt: new Date().toISOString(),
    };
    await d.debts.add(created);
    return debtDTO(created, []);
  }

  // ── PATCH ──
  const existing = await d.debts.get(id);
  if (!existing) throw new ApiError("بدهی یافت نشد", 404);

  const data: Partial<DebtRow> = {};
  if (body.person !== undefined) {
    const person = toStr(body.person)?.trim();
    if (!person) throw new ApiError("نام شخص الزامی است", 400);
    data.person = person;
  }
  if (body.amount !== undefined) {
    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);
    data.amount = amount;
  }
  if (body.dueDate !== undefined) data.dueDate = toDt(body.dueDate)?.toISOString() ?? null;
  if (body.notes !== undefined) data.notes = toStr(body.notes) || null;

  const updated: DebtRow = { ...existing, ...data };
  await d.debts.put(updated);
  const payments = await d.debtPayments.where("debtId").equals(id).toArray();
  return debtDTO(updated, payments);
}

export async function deleteDebt(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.debts.get(id);
  if (!existing) throw new ApiError("بدهی یافت نشد", 404);
  // payments cascade
  await d.transaction("rw", d.debts, d.debtPayments, async () => {
    const ps = await d.debtPayments.where("debtId").equals(id).toArray();
    await d.debtPayments.bulkDelete(ps.map((p) => p.id));
    await d.debts.delete(id);
  });
  return { ok: true };
}

export async function addDebtPayment(body: {
  debtId: string;
  amount: number;
  date?: string;
  notes?: string;
}): Promise<DebtDTO> {
  const d = db();
  const debt = await d.debts.get(body.debtId);
  if (!debt) throw new ApiError("بدهی یافت نشد", 404);
  if (debt.paidAmount >= debt.amount) {
    throw new ApiError("این بدهی تسویه شده است", 409);
  }

  const amount = toNum(body.amount);
  if (amount === undefined || amount <= 0)
    throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);

  const remaining = debt.amount - debt.paidAmount;
  if (amount > remaining) {
    throw new ApiError("مبلغ بیشتر از باقیمانده است", 400);
  }

  const date = toDt(body.date) ?? new Date();
  const notes = toStr(body.notes) || null;

  const payment: DebtPaymentRow = {
    id: newId(),
    debtId: debt.id,
    amount,
    date: date.toISOString(),
    notes,
  };
  const updated: DebtRow = {
    ...debt,
    paidAmount: debt.paidAmount + amount,
    ...(debt.paidAmount + amount >= debt.amount ? { settledAt: date.toISOString() } : {}),
  };
  await d.transaction("rw", d.debtPayments, d.debts, async () => {
    await d.debtPayments.add(payment);
    await d.debts.put(updated);
  });

  const payments = await d.debtPayments.where("debtId").equals(debt.id).toArray();
  return debtDTO(updated, payments);
}

// ═════════════════════════════════════════════════════════════
// Installments (اقساط)  (GET/POST /api/recurring, [id]) — pure tracker
// ═════════════════════════════════════════════════════════════

export async function getRecurring(): Promise<RecurringDTO[]> {
  const d = db();
  const rows = await d.recurrings.toArray();
  return rows
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
    .map((r) => recurDTO(r));
}

export async function saveRecurring(
  payload: Record<string, unknown> & { id?: string },
): Promise<RecurringDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id) {
    // ── POST ──
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان الزامی است", 400);
    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);

    const frequency = toStr(body.frequency) ?? "MONTHLY";
    if (!FREQUENCIES.includes(frequency)) throw new ApiError("تناوب نامعتبر است", 400);

    const totalCount = toInt(body.totalCount);
    if (totalCount === undefined || totalCount < 1)
      throw new ApiError("تعداد اقساط باید حداقل ۱ باشد", 400);

    const paidBefore = Math.max(0, toInt(body.paidCount) ?? 0);
    if (paidBefore > totalCount)
      throw new ApiError("تعداد پرداخت‌شده نمی‌تواند بیشتر از تعداد اقساط باشد", 400);

    // اقساط has no accounting impact → no account/category/transactions
    const skeleton: RecurringRow = {
      id: newId(),
      title,
      type: "EXPENSE",
      amount,
      accountId: "",
      categoryId: null,
      frequency,
      startDate: (toDt(body.startDate) ?? new Date()).toISOString(),
      endDate: null,
      totalCount,
      paidCount: 0,
      lastPaidAt: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    // pre-existing payments (تعداد پرداخت‌های از قبل) default to their due dates
    const map: Record<string, string> = {};
    for (let n = 1; n <= paidBefore; n++) {
      map[String(n)] = installmentDueDate(skeleton, n).toISOString();
    }
    const created = syncPaidFields({ ...skeleton, paidMap: map });
    await d.recurrings.add(created);
    return recurDTO(created);
  }

  // ── PATCH ──
  const existing = await d.recurrings.get(id);
  if (!existing) throw new ApiError("قسط یافت نشد", 404);

  const data: Partial<RecurringRow> = {};
  if (body.title !== undefined) {
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان الزامی است", 400);
    data.title = title;
  }
  if (body.amount !== undefined) {
    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);
    data.amount = amount;
  }
  if (body.frequency !== undefined) {
    const frequency = toStr(body.frequency) ?? "";
    if (!FREQUENCIES.includes(frequency)) throw new ApiError("تناوب نامعتبر است", 400);
    data.frequency = frequency;
  }
  if (body.startDate !== undefined) {
    const startDate = toDt(body.startDate);
    if (!startDate) throw new ApiError("تاریخ شروع نامعتبر است", 400);
    data.startDate = startDate.toISOString();
  }
  if (body.totalCount !== undefined) {
    const tc = toInt(body.totalCount);
    if (tc === undefined || tc < 1) throw new ApiError("تعداد اقساط باید حداقل ۱ باشد", 400);
    data.totalCount = tc;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  let merged: RecurringRow = { ...existing, ...data };

  // «تعداد پرداخت‌های انجام‌شده از قبل» — rebuild paidMap for first N installments
  if (body.paidCount !== undefined) {
    const paidBefore = Math.max(0, toInt(body.paidCount) ?? 0);
    if (merged.totalCount != null && paidBefore > merged.totalCount)
      throw new ApiError("تعداد پرداخت‌شده نمی‌تواند بیشتر از تعداد اقساط باشد", 400);
    const prevMap = normalizePaidMap(existing);
    const map: Record<string, string> = {};
    for (let n = 1; n <= paidBefore; n++) {
      // keep manual payment dates of already-paid installments; default to due date
      map[String(n)] = prevMap[String(n)] ?? installmentDueDate(merged, n).toISOString();
    }
    merged = { ...merged, paidMap: map };
  }

  // if totalCount shrank, drop payments beyond the schedule
  if (merged.totalCount != null) {
    const map = { ...(merged.paidMap ?? {}) };
    let dropped = false;
    for (const k of Object.keys(map)) {
      if (parseInt(k, 10) > merged.totalCount) {
        delete map[k];
        dropped = true;
      }
    }
    if (dropped) merged = { ...merged, paidMap: map };
  }

  merged = syncPaidFields(merged);
  await d.recurrings.put(merged);
  return recurDTO(merged);
}

export async function deleteRecurring(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.recurrings.get(id);
  if (!existing) throw new ApiError("قسط یافت نشد", 404);
  await d.recurrings.delete(id);
  return { ok: true };
}

/**
 * Toggle a single installment's paid state (the tick in the schedule view).
 * No transaction is created — اقساط has no accounting impact.
 * paidAt is optional: defaults to the installment's scheduled due date.
 */
export async function setInstallmentPaid(body: {
  id: string;
  n: number;
  paid: boolean;
  paidAt?: string;
}): Promise<{ ok: boolean; recurring: RecurringDTO }> {
  const d = db();
  const existing = await d.recurrings.get(body.id);
  if (!existing) throw new ApiError("قسط یافت نشد", 404);

  const total = existing.totalCount ?? 0;
  if (!Number.isInteger(body.n) || body.n < 1 || (total > 0 && body.n > total))
    throw new ApiError("شماره قسط نامعتبر است", 400);

  const map = { ...normalizePaidMap(existing) };
  if (body.paid) {
    const paidAt = body.paidAt ? toDt(body.paidAt) : null;
    map[String(body.n)] = (paidAt ?? installmentDueDate(existing, body.n)).toISOString();
  } else {
    delete map[String(body.n)];
  }

  const updated = syncPaidFields({ ...existing, paidMap: map });
  await d.recurrings.put(updated);
  return { ok: true, recurring: recurDTO(updated) };
}

// ═════════════════════════════════════════════════════════════
// Savings  (GET/POST /api/savings, [id], [id]/deposits)
// ═════════════════════════════════════════════════════════════

export async function getSavings(): Promise<SavingsGoalDTO[]> {
  const d = db();
  const [goals, deposits] = await Promise.all([d.savingsGoals.toArray(), d.savingsDeposits.toArray()]);
  const byGoal = new Map<string, SavingsDepositRow[]>();
  for (const x of deposits) {
    const arr = byGoal.get(x.goalId);
    if (arr) arr.push(x);
    else byGoal.set(x.goalId, [x]);
  }
  return goals
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
    .map((g) => savingsDTO(g, byGoal.get(g.id) ?? []));
}

export async function saveGoal(
  payload: Record<string, unknown> & { id?: string },
): Promise<SavingsGoalDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id) {
    // ── POST ──
    const name = toStr(body.name)?.trim();
    if (!name) throw new ApiError("نام هدف الزامی است", 400);
    const targetAmount = toNum(body.targetAmount);
    if (targetAmount === undefined || targetAmount <= 0)
      throw new ApiError("مبلغ هدف باید بزرگ‌تر از صفر باشد", 400);

    const created: SavingsGoalRow = {
      id: newId(),
      name,
      targetAmount,
      targetDate: toDt(body.targetDate)?.toISOString() ?? null,
      color: toStr(body.color) || "#4E9B72",
      icon: toStr(body.icon) || "target",
      createdAt: new Date().toISOString(),
    };
    await d.savingsGoals.add(created);
    return savingsDTO(created, []);
  }

  // ── PATCH ──
  const existing = await d.savingsGoals.get(id);
  if (!existing) throw new ApiError("هدف پس‌انداز یافت نشد", 404);

  const data: Partial<SavingsGoalRow> = {};
  if (body.name !== undefined) {
    const name = toStr(body.name)?.trim();
    if (!name) throw new ApiError("نام هدف الزامی است", 400);
    data.name = name;
  }
  if (body.targetAmount !== undefined) {
    const targetAmount = toNum(body.targetAmount);
    if (targetAmount === undefined || targetAmount <= 0)
      throw new ApiError("مبلغ هدف باید بزرگ‌تر از صفر باشد", 400);
    data.targetAmount = targetAmount;
  }
  if (body.targetDate !== undefined) data.targetDate = toDt(body.targetDate)?.toISOString() ?? null;
  if (body.color !== undefined) data.color = toStr(body.color) || existing.color;
  if (body.icon !== undefined) data.icon = toStr(body.icon) || existing.icon;

  const updated: SavingsGoalRow = { ...existing, ...data };
  await d.savingsGoals.put(updated);
  const deposits = await d.savingsDeposits.where("goalId").equals(id).toArray();
  return savingsDTO(updated, deposits);
}

export async function deleteGoal(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.savingsGoals.get(id);
  if (!existing) throw new ApiError("هدف پس‌انداز یافت نشد", 404);
  // deposits cascade
  await d.transaction("rw", d.savingsGoals, d.savingsDeposits, async () => {
    const ds = await d.savingsDeposits.where("goalId").equals(id).toArray();
    await d.savingsDeposits.bulkDelete(ds.map((x) => x.id));
    await d.savingsGoals.delete(id);
  });
  return { ok: true };
}

/** POST /api/savings/[id]/deposits {amount (+ or −), date?, notes?} */
export async function addDeposit(body: {
  goalId: string;
  amount: number;
  date?: string;
  notes?: string;
}): Promise<SavingsGoalDTO> {
  const d = db();
  const goal = await d.savingsGoals.get(body.goalId);
  if (!goal) throw new ApiError("هدف پس‌انداز یافت نشد", 404);

  const amount = toNum(body.amount);
  if (amount === undefined || amount === 0)
    throw new ApiError("مبلغ باید غیرصفر باشد (واریز +، برداشت −)", 400);

  const deposits = await d.savingsDeposits.where("goalId").equals(goal.id).toArray();
  const current = deposits.reduce((s, x) => s + x.amount, 0);
  if (current + amount < 0) {
    throw new ApiError("مبلغ برداشت بیشتر از پس‌انداز فعلی است", 400);
  }

  const created: SavingsDepositRow = {
    id: newId(),
    goalId: goal.id,
    amount,
    date: (toDt(body.date) ?? new Date()).toISOString(),
    notes: toStr(body.notes) || null,
  };
  await d.savingsDeposits.add(created);

  const updated = await d.savingsDeposits.where("goalId").equals(goal.id).toArray();
  return savingsDTO(goal, updated);
}

// ═════════════════════════════════════════════════════════════
// Reminders  (GET/POST /api/reminders, /api/reminders/[id])
// ═════════════════════════════════════════════════════════════

export async function getReminders(pendingOnly = false): Promise<ReminderDTO[]> {
  const d = db();
  const rows = await d.reminders.toArray();
  const filtered = pendingOnly ? rows.filter((r) => !r.isDone) : rows;
  const dtos = filtered.map(reminderDTO);
  dtos.sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (!a.isDone) return Date.parse(a.date) - Date.parse(b.date);
    return Date.parse(b.date) - Date.parse(a.date);
  });
  return dtos;
}

export async function saveReminder(
  payload: Record<string, unknown> & { id?: string },
): Promise<ReminderDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id) {
    // ── POST ──
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان یادآور الزامی است", 400);
    const date = toDt(body.date);
    if (!date) throw new ApiError("تاریخ یادآور الزامی است", 400);

    const type = toStr(body.type) ?? "CUSTOM";
    if (!REMINDER_TYPES.includes(type)) throw new ApiError("نوع یادآور نامعتبر است", 400);
    const repeat = toStr(body.repeat) ?? "NONE";
    if (!REPEATS.includes(repeat)) throw new ApiError("تکرار نامعتبر است", 400);

    const created: ReminderRow = {
      id: newId(),
      title,
      type,
      date: date.toISOString(),
      time: toStr(body.time) || null,
      repeat,
      isDone: false,
      createdAt: new Date().toISOString(),
    };
    await d.reminders.add(created);
    return reminderDTO(created);
  }

  // ── PATCH ──
  const existing = await d.reminders.get(id);
  if (!existing) throw new ApiError("یادآور یافت نشد", 404);

  const data: Partial<ReminderRow> = {};
  if (body.title !== undefined) {
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان یادآور الزامی است", 400);
    data.title = title;
  }
  if (body.type !== undefined) {
    const type = toStr(body.type) ?? "";
    if (!REMINDER_TYPES.includes(type)) throw new ApiError("نوع یادآور نامعتبر است", 400);
    data.type = type;
  }
  if (body.date !== undefined) {
    const date = toDt(body.date);
    if (!date) throw new ApiError("تاریخ نامعتبر است", 400);
    data.date = date.toISOString();
  }
  if (body.time !== undefined) data.time = toStr(body.time) || null;
  if (body.repeat !== undefined) {
    const repeat = toStr(body.repeat) ?? "NONE";
    if (!REPEATS.includes(repeat)) throw new ApiError("تکرار نامعتبر است", 400);
    data.repeat = repeat;
  }
  if (body.isDone !== undefined) data.isDone = Boolean(body.isDone);

  const updated: ReminderRow = { ...existing, ...data };
  await d.reminders.put(updated);
  return reminderDTO(updated);
}

export async function toggleReminder(body: { id: string; isDone: boolean }): Promise<ReminderDTO> {
  return saveReminder({ id: body.id, isDone: body.isDone });
}

export async function deleteReminder(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.reminders.get(id);
  if (!existing) throw new ApiError("یادآور یافت نشد", 404);
  await d.reminders.delete(id);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════
// Dashboard  (GET /api/dashboard)
// ═════════════════════════════════════════════════════════════

export async function getDashboard(): Promise<DashboardDTO> {
  const d = db();
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrow = addDays(todayStart, 1);
  const month = jalaliMonthRange(now);
  const monthKey = jalaliMonthKey(now);

  const [accountRows, txRows, budgetRows, debtRows, recurringRows, reminderRows, goalRows, depositRows, { accMap, catMap, walletMap }] =
    await Promise.all([
      d.accounts.toArray(),
      d.transactions.toArray(),
      d.budgets.toArray(),
      d.debts.toArray(),
      d.recurrings.toArray(),
      d.reminders.toArray(),
      d.savingsGoals.toArray(),
      d.savingsDeposits.toArray(),
      loadMaps(d),
    ]);

  const accounts = [...accountRows].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return ms(a.createdAt) - ms(b.createdAt);
  });
  const txs = [...txRows].sort(
    (a, b) => dayMs(b.date) - dayMs(a.date) || ms(b.createdAt) - ms(a.createdAt),
  );
  const budgets = budgetRows.filter((b) => b.month === monthKey);

  // ---- balances ----
  const totalBalance =
    accounts.reduce((s, a) => s + a.initialBalance, 0) +
    txs.reduce(
      (s, t) => (t.type === "INCOME" ? s + t.amount : t.type === "EXPENSE" ? s - t.amount : s),
      0,
    );

  // ---- today / month sums ----
  let todayIncome = 0;
  let todayExpense = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  for (const t of txs) {
    if (t.type === "INCOME" || t.type === "EXPENSE") {
      const ts = ms(t.date);
      if (ts >= todayStart.getTime() && ts < tomorrow.getTime()) {
        if (t.type === "INCOME") todayIncome += t.amount;
        else todayExpense += t.amount;
      }
      if (ts >= month.start.getTime() && ts < month.end.getTime()) {
        if (t.type === "INCOME") monthIncome += t.amount;
        else monthExpense += t.amount;
      }
    }
  }

  // ---- overall budget ----
  const overall = budgets.find((b) => !b.categoryId) ?? null;
  const budget = overall
    ? {
        total: overall.amount,
        spent: monthExpense,
        percent: overall.amount > 0 ? Math.round((monthExpense / overall.amount) * 100) : 0,
      }
    : null;

  // ---- last 7 days (oldest → newest, including today) ----
  const week: Array<{ date: string; income: number; expense: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(todayStart, -i);
    const next = addDays(day, 1);
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.type !== "INCOME" && t.type !== "EXPENSE") continue;
      const ts = ms(t.date);
      if (ts >= day.getTime() && ts < next.getTime()) {
        if (t.type === "INCOME") income += t.amount;
        else expense += t.amount;
      }
    }
    week.push({
      date: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
      income,
      expense,
    });
  }

  // ---- recent transactions (with running account balance) ----
  const after = buildBalanceAfterMap(txRows, accountRows);
  const recent = txs.slice(0, 6).map((row) => {
    const dto = txDTO(row, accMap, catMap, walletMap);
    dto.balanceAfter = after.get(row.id) ?? null;
    return dto;
  });

  // ---- upcoming (next 5 within 30 days) ----
  const upcoming: UpcomingDTO[] = [];
  for (const r of recurringRows) {
    const nd = nextDue(r);
    if (!nd) continue;
    const dl = dayDiff(nd, todayStart);
    if (dl < 0 || dl > 30) continue;
    upcoming.push({
      id: r.id,
      title: r.title,
      amount: r.amount,
      date: nd.toISOString(),
      kind: "RECURRING",
      daysLeft: dl,
    });
  }
  for (const x of debtRows) {
    if (x.paidAmount >= x.amount || !x.dueDate) continue;
    const dl = dayDiff(new Date(x.dueDate), todayStart);
    if (dl < 0 || dl > 30) continue;
    upcoming.push({
      id: x.id,
      title: x.person,
      amount: Math.max(0, x.amount - x.paidAmount),
      date: x.dueDate,
      kind: "DEBT",
      daysLeft: dl,
    });
  }
  for (const r of reminderRows) {
    if (r.isDone) continue;
    const dl = dayDiff(new Date(r.date), todayStart);
    if (dl < 0 || dl > 30) continue;
    upcoming.push({
      id: r.id,
      title: r.title,
      amount: null,
      date: r.date,
      kind: "REMINDER",
      daysLeft: dl,
    });
  }
  upcoming.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  // ---- debts summary (unsettled only) ----
  const debtsSummary = { owedToMe: 0, iOwe: 0 };
  for (const x of debtRows) {
    if (x.paidAmount >= x.amount) continue;
    const remaining = Math.max(0, x.amount - x.paidAmount);
    if (x.type === "OWED_TO_ME") debtsSummary.owedToMe += remaining;
    else debtsSummary.iOwe += remaining;
  }

  // ---- goals (top 3 by percent) ----
  const depositsByGoal = new Map<string, SavingsDepositRow[]>();
  for (const x of depositRows) {
    const arr = depositsByGoal.get(x.goalId);
    if (arr) arr.push(x);
    else depositsByGoal.set(x.goalId, [x]);
  }
  const goals = goalRows
    .map((g) => {
      const gDeposits = depositsByGoal.get(g.id) ?? [];
      const current = gDeposits.reduce((s, x) => s + x.amount, 0);
      const percent =
        g.targetAmount > 0 ? Math.min(100, Math.round((current / g.targetAmount) * 100)) : 0;
      return { id: g.id, name: g.name, percent, current, target: g.targetAmount, color: g.color };
    })
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  return {
    totalBalance,
    todayIncome,
    todayExpense,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
    budget,
    week,
    recent,
    upcoming: upcoming.slice(0, 5),
    debts: debtsSummary,
    goals,
  };
}

// ═════════════════════════════════════════════════════════════
// Reports  (GET /api/reports?period=&offset=)
// ═════════════════════════════════════════════════════════════

function jMonthRange(jy: number, jm: number) {
  const start = toGregorian(jy, jm, 1);
  const nm = jm === 12 ? 1 : jm + 1;
  const ny = jm === 12 ? jy + 1 : jy;
  const end = toGregorian(ny, nm, 1);
  return { start, end };
}

function shiftJalali(jy: number, jm: number, delta: number) {
  let m = jm + delta;
  let y = jy;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { jy: y, jm: m };
}

export async function getReports(periodRaw?: string, offsetRaw?: number): Promise<ReportsDTO> {
  const d = db();
  const period: ReportPeriod = ["daily", "weekly", "monthly", "yearly"].includes(periodRaw ?? "")
    ? (periodRaw as ReportPeriod)
    : "monthly";
  const offset = Math.max(0, toInt(offsetRaw) ?? 0);
  const now = new Date();
  const todayStart = startOfDay(now);

  let from: Date;
  let to: Date;
  let seriesFrom: Date;
  const months: Array<{ jy: number; jm: number }> = [];
  const days: Date[] = [];
  const years: number[] = [];

  if (period === "daily") {
    from = startOfDay(now);
    to = endOfDay(now);
    seriesFrom = startOfDay(addDays(todayStart, -6));
    for (let i = 6; i >= 0; i--) days.push(addDays(todayStart, -i));
  } else if (period === "weekly") {
    const endDay = addDays(todayStart, -offset * 7);
    to = endOfDay(endDay);
    from = startOfDay(addDays(endDay, -6));
    seriesFrom = from;
    for (let i = 6; i >= 0; i--) days.push(addDays(endDay, -i));
  } else if (period === "monthly") {
    const j = toJalali(todayStart);
    const anchor = shiftJalali(j.jy, j.jm, -offset);
    const anchorRange = jMonthRange(anchor.jy, anchor.jm);
    from = anchorRange.start;
    to = endOfDay(addDays(anchorRange.end, -1));
    const start6 = shiftJalali(anchor.jy, anchor.jm, -5);
    seriesFrom = jMonthRange(start6.jy, start6.jm).start;
    for (let i = 5; i >= 0; i--) months.push(shiftJalali(anchor.jy, anchor.jm, -i));
  } else {
    const y = now.getFullYear() - offset;
    from = new Date(y, 0, 1, 0, 0, 0, 0);
    to = new Date(y, 11, 31, 23, 59, 59, 999);
    seriesFrom = new Date(y - 2, 0, 1, 0, 0, 0, 0);
    for (let i = 2; i >= 0; i--) years.push(y - i);
  }

  const [txRows, accountRowsAll, { catMap }] = await Promise.all([
    d.transactions.toArray(),
    d.accounts.toArray(),
    loadMaps(d),
  ]);
  const txs = txRows.filter(
    (t) =>
      (t.type === "INCOME" || t.type === "EXPENSE") &&
      ms(t.date) >= seriesFrom.getTime() &&
      ms(t.date) <= to.getTime(),
  );
  const accounts = [...accountRowsAll].sort((a, b) => ms(a.createdAt) - ms(b.createdAt));

  const inRange = txs.filter(
    (t) => ms(t.date) >= from.getTime() && ms(t.date) <= to.getTime(),
  );
  let income = 0;
  let expense = 0;
  for (const t of inRange) {
    if (t.type === "INCOME") income += t.amount;
    else expense += t.amount;
  }

  // ---- series ----
  const series: Array<{ label: string; income: number; expense: number }> = [];
  if (period === "monthly") {
    for (const m of months) {
      const r = jMonthRange(m.jy, m.jm);
      let si = 0;
      let se = 0;
      for (const t of txs) {
        const ts = ms(t.date);
        if (ts < r.start.getTime() || ts >= r.end.getTime()) continue;
        if (t.type === "INCOME") si += t.amount;
        else se += t.amount;
      }
      series.push({ label: `${m.jy}-${pad(m.jm)}`, income: si, expense: se });
    }
  } else if (period === "daily" || period === "weekly") {
    for (const day of days) {
      const next = addDays(day, 1);
      let si = 0;
      let se = 0;
      for (const t of txs) {
        const ts = ms(t.date);
        if (ts < day.getTime() || ts >= next.getTime()) continue;
        if (t.type === "INCOME") si += t.amount;
        else se += t.amount;
      }
      series.push({
        label: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
        income: si,
        expense: se,
      });
    }
  } else {
    for (const y of years) {
      const s = new Date(y, 0, 1);
      const e = new Date(y + 1, 0, 1);
      let si = 0;
      let se = 0;
      for (const t of txs) {
        const ts = ms(t.date);
        if (ts < s.getTime() || ts >= e.getTime()) continue;
        if (t.type === "INCOME") si += t.amount;
        else se += t.amount;
      }
      const labelJy = toJalali(new Date(y, 6, 1)).jy; // dominant jalali year of that gregorian year
      series.push({ label: String(labelJy), income: si, expense: se });
    }
  }

  // ---- category breakdowns (range only, categorized txs) ----
  const breakdown = (type: "INCOME" | "EXPENSE") => {
    const map = new Map<string, { categoryId: string; name: string; color: string; total: number }>();
    let sum = 0;
    for (const t of inRange) {
      if (t.type !== type || !t.categoryId) continue;
      sum += t.amount;
      const cat = catMap.get(t.categoryId);
      const entry = map.get(t.categoryId);
      if (entry) entry.total += t.amount;
      else
        map.set(t.categoryId, {
          categoryId: t.categoryId,
          name: cat?.name ?? "بدون نام",
          color: cat?.color ?? "#4E9B72",
          total: t.amount,
        });
    }
    return [...map.values()]
      .map((e) => ({ ...e, percent: sum > 0 ? Math.round((e.total / sum) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  };

  // ---- per-account totals (range only) ----
  const accountRows = accounts.map((a) => {
    let ai = 0;
    let ae = 0;
    for (const t of inRange) {
      if (t.accountId !== a.id) continue;
      if (t.type === "INCOME") ai += t.amount;
      else if (t.type === "EXPENSE") ae += t.amount;
    }
    return { accountId: a.id, name: a.name, color: a.color, income: ai, expense: ae };
  });

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    income,
    expense,
    net: income - expense,
    series,
    categories: breakdown("EXPENSE"),
    incomeCategories: breakdown("INCOME"),
    accounts: accountRows,
  };
}

// ═════════════════════════════════════════════════════════════
// Export CSV  (GET /api/export — UTF-8 with BOM)
// ═════════════════════════════════════════════════════════════

const TYPE_FA: Record<string, string> = {
  INCOME: "درآمد",
  EXPENSE: "هزینه",
  TRANSFER: "انتقال",
};

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

export async function exportCsv(filters?: { from?: string; to?: string }): Promise<string> {
  const d = db();
  const from = toDt(filters?.from);
  const to = toDt(filters?.to);

  const [txRows, { accMap, catMap }] = await Promise.all([d.transactions.toArray(), loadMaps(d)]);
  let rows = txRows;
  if (from || to) {
    rows = rows.filter((t) => {
      const ts = ms(t.date);
      if (from && ts < from.getTime()) return false;
      if (to && ts > to.getTime()) return false;
      return true;
    });
  }
  rows = [...rows].sort((a, b) => ms(a.date) - ms(b.date));

  const header = "نوع,عنوان,مبلغ,حساب,دسته,تاریخ,توضیحات";
  const lines = rows.map((t) => {
    const account = accMap.get(t.accountId);
    const toAccount = t.toAccountId ? accMap.get(t.toAccountId) : undefined;
    const acc =
      t.type === "TRANSFER" && toAccount ? `${account?.name ?? ""} → ${toAccount.name}` : account?.name ?? "";
    const cells = [
      TYPE_FA[t.type] ?? t.type,
      t.title ?? "",
      String(t.amount),
      acc,
      t.categoryId ? catMap.get(t.categoryId)?.name ?? "" : "",
      t.date,
      t.description ?? t.notes ?? "",
    ];
    return cells.map(csvEscape).join(",");
  });

  // \uFEFF BOM so Excel opens Persian text correctly
  return "\uFEFF" + header + "\n" + lines.join("\n") + (lines.length ? "\n" : "");
}

// ═════════════════════════════════════════════════════════════
// Backup / Restore  (GET /api/backup, POST /api/backup/restore)
// ═════════════════════════════════════════════════════════════

export interface BackupFile {
  profile: ProfileRow | null;
  accounts: AccountRow[];
  categories: CategoryRow[];
  transactions: TransactionRow[];
  budgets: BudgetRow[];
  debts: DebtRow[];
  debtPayments: DebtPaymentRow[];
  recurring: RecurringRow[];
  savingsGoals: SavingsGoalRow[];
  savingsDeposits: SavingsDepositRow[];
  reminders: ReminderRow[];
  wallets: WalletRow[];
  walletEntries: WalletEntryRow[];
  dayCounters: DayCounterRow[];
  exportedAt: string;
}

export async function getBackup(): Promise<BackupFile> {
  const d = db();
  const [profile, accounts, categories, transactions, budgets, debts, debtPayments, recurring, savingsGoals, savingsDeposits, reminders, wallets, walletEntries, dayCounters] =
    await Promise.all([
      d.profile.toArray(),
      d.accounts.toArray(),
      d.categories.toArray(),
      d.transactions.toArray(),
      d.budgets.toArray(),
      d.debts.toArray(),
      d.debtPayments.toArray(),
      d.recurrings.toArray(),
      d.savingsGoals.toArray(),
      d.savingsDeposits.toArray(),
      d.reminders.toArray(),
      d.wallets.toArray(),
      d.walletEntries.toArray(),
      d.dayCounters.toArray(),
    ]);

  return {
    profile: profile[0] ?? null,
    accounts,
    categories,
    transactions,
    budgets,
    debts,
    debtPayments,
    recurring,
    savingsGoals,
    savingsDeposits,
    reminders,
    wallets,
    walletEntries,
    dayCounters,
    exportedAt: new Date().toISOString(),
  };
}

/** Picks the whitelisted fields per row; date fields parsed (invalid → null). */
function pick(rows: unknown, fields: string[], dateFields: string[] = []): Row[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Row => typeof r === "object" && r !== null)
    .map((r) => {
      const out: Row = {};
      for (const f of fields) {
        if (r[f] === undefined) continue;
        if (dateFields.includes(f)) {
          if (r[f] === null) {
            out[f] = null;
          } else {
            const dt = new Date(r[f] as string | number);
            out[f] = isNaN(dt.getTime()) ? null : dt.toISOString();
          }
        } else {
          out[f] = r[f];
        }
      }
      return out;
    });
}

// Corrupt-backup guard: tables with a required createdAt get an epoch fallback
// (Prisma would reject these rows entirely; we keep the rest of the row usable).
function asRows(rows: Row[]): Row[] {
  return rows.map((r) =>
    r.createdAt === null || r.createdAt === undefined ? { ...r, createdAt: new Date(0).toISOString() } : r,
  );
}

export async function restoreBackup(body: unknown): Promise<{ ok: boolean; counts: Record<string, number> }> {
  const d = db();
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as Row).accounts) ||
    !Array.isArray((body as Row).transactions)
  ) {
    throw new ApiError("فایل پشتیبان نامعتبر است", 400);
  }
  const b = body as Row;

  const accounts = asRows(pick(b.accounts, ["id", "name", "type", "color", "icon", "initialBalance", "isDefault", "createdAt"], ["createdAt"]));
  const categories = asRows(pick(b.categories, ["id", "name", "type", "icon", "color", "isDefault", "createdAt"], ["createdAt"]));
  const transactions = asRows(
    pick(
      b.transactions,
      ["id", "type", "amount", "title", "description", "notes", "receiptUrl", "accountId", "toAccountId", "categoryId", "debtId", "recurringId", "walletId", "walletEntryId", "date", "createdAt"],
      ["date", "createdAt"],
    ),
  );
  const budgets = asRows(pick(b.budgets, ["id", "month", "amount", "categoryId", "createdAt"], ["createdAt"]));
  const debts = asRows(pick(b.debts, ["id", "person", "type", "amount", "paidAmount", "date", "dueDate", "notes", "settledAt", "createdAt"], ["date", "dueDate", "settledAt", "createdAt"]));
  const debtPayments = pick(b.debtPayments, ["id", "debtId", "amount", "date", "notes"], ["date"]);
  const recurring = asRows(pick(b.recurring, ["id", "title", "type", "amount", "accountId", "categoryId", "frequency", "startDate", "endDate", "totalCount", "paidCount", "lastPaidAt", "isActive", "createdAt"], ["startDate", "endDate", "lastPaidAt", "createdAt"]));
  const savingsGoals = asRows(pick(b.savingsGoals, ["id", "name", "targetAmount", "targetDate", "color", "icon", "createdAt"], ["targetDate", "createdAt"]));
  const savingsDeposits = pick(b.savingsDeposits, ["id", "goalId", "amount", "date", "notes"], ["date"]);
  const reminders = asRows(pick(b.reminders, ["id", "title", "type", "date", "time", "repeat", "isDone", "createdAt"], ["date", "createdAt"]));
  const wallets = pick(b.wallets, ["id", "title", "ceiling", "linkedAccountIds", "createdAt"], ["createdAt"]);
  const walletEntries = pick(b.walletEntries, ["id", "walletId", "type", "amount", "note", "date", "createdAt"], ["date", "createdAt"]);
  const dayCounters = pick(b.dayCounters, ["id", "title", "startDate", "endDate", "design", "alarmEnabled", "alarmDays", "alarmSound", "color", "createdAt"], ["startDate", "endDate", "createdAt"]);

  const counts = (await d.transaction(
    "rw",
    [
      d.accounts,
      d.categories,
      d.transactions,
      d.budgets,
      d.debts,
      d.debtPayments,
      d.recurrings,
      d.savingsGoals,
      d.savingsDeposits,
      d.reminders,
      d.wallets,
      d.walletEntries,
      d.dayCounters,
    ],
    async () => {
      // wipe — FK-safe order
      await d.dayCounters.clear();
      await d.walletEntries.clear();
      await d.wallets.clear();
      await d.debtPayments.clear();
      await d.savingsDeposits.clear();
      await d.transactions.clear();
      await d.budgets.clear();
      await d.recurrings.clear();
      await d.reminders.clear();
      await d.savingsGoals.clear();
      await d.debts.clear();
      await d.categories.clear();
      await d.accounts.clear();

      // insert — FK order
      type TableName =
        | "accounts"
        | "categories"
        | "transactions"
        | "budgets"
        | "debts"
        | "debtPayments"
        | "recurrings"
        | "savingsGoals"
        | "savingsDeposits"
        | "reminders"
        | "wallets"
        | "walletEntries"
        | "dayCounters";
      const insert = async (name: TableName, rows: Row[]): Promise<number> => {
        if (!rows.length) return 0;
        await (d[name] as unknown as import("dexie").Table<Row, string>).bulkAdd(rows);
        return rows.length;
      };
      return {
        accounts: await insert("accounts", accounts),
        categories: await insert("categories", categories),
        transactions: await insert("transactions", transactions),
        budgets: await insert("budgets", budgets),
        debts: await insert("debts", debts),
        debtPayments: await insert("debtPayments", debtPayments),
        recurring: await insert("recurrings", recurring),
        savingsGoals: await insert("savingsGoals", savingsGoals),
        savingsDeposits: await insert("savingsDeposits", savingsDeposits),
        reminders: await insert("reminders", reminders),
        wallets: await insert("wallets", wallets),
        walletEntries: await insert("walletEntries", walletEntries),
        dayCounters: await insert("dayCounters", dayCounters),
      } as Record<string, number>;
    },
  ));

  // restore profile (single-user app) if present
  if (b.profile && typeof b.profile === "object") {
    const p = pick(
      [b.profile],
      ["id", "name", "email", "avatar", "language", "theme", "calendar", "currency", "weekStart", "appLock", "pin", "notificationsEnabled", "dayCounterOnHome", "homeWidgets", "onboarded", "createdAt"],
      ["createdAt"],
    )[0];
    if (p) {
      const targetId = typeof p.id === "string" ? p.id : "main";
      const existing = await d.profile.get(targetId);
      if (existing) {
        await d.profile.put({ ...existing, ...(p as Partial<ProfileRow>) });
      } else {
        // Prisma create: schema defaults for missing fields, id forced to "main"
        const created: ProfileRow = {
          id: "main",
          name: (p.name as string) ?? "کاربر",
          email: (p.email as string) ?? "",
          avatar: (p.avatar as string | null) ?? null,
          language: (p.language as string) ?? "fa",
          theme: (p.theme as string) ?? "light",
          calendar: (p.calendar as string) ?? "jalali",
          currency: (p.currency as string) ?? "IRT",
          weekStart: (p.weekStart as string) ?? "sat",
          appLock: Boolean(p.appLock ?? false),
          pin: (p.pin as string | null) ?? null,
          biometricLock: false, // not picked → schema default
          notificationsEnabled: Boolean(p.notificationsEnabled ?? true),
          dayCounterOnHome: Boolean(p.dayCounterOnHome ?? false),
          homeWidgets: (p.homeWidgets as string) ?? "",
          onboarded: Boolean(p.onboarded ?? false),
          createdAt: (p.createdAt as string) ?? new Date().toISOString(),
        };
        await d.profile.put(created);
      }
    }
  }

  return { ok: true, counts };
}

// ═════════════════════════════════════════════════════════════
// Wallets (کیف پول) — GET/POST /api/wallets, [id], [id]/entries
// Standalone money pockets with own balance + spending ceiling.
// No accounting impact (like اقساط).
// ═════════════════════════════════════════════════════════════

const WALLET_ENTRY_TYPES = ["IN", "OUT"];

function walletDTO(w: WalletRow, entries: WalletEntryRow[]): WalletDTO {
  let totalIn = 0;
  let totalOut = 0;
  let lastEntryAt: string | null = null;
  for (const e of entries) {
    if (e.type === "IN") totalIn += e.amount;
    else totalOut += e.amount;
    if (!lastEntryAt || e.date > lastEntryAt) lastEntryAt = e.date;
  }
  return {
    id: w.id,
    title: w.title,
    ceiling: w.ceiling,
    linkedAccountIds: Array.isArray(w.linkedAccountIds) ? w.linkedAccountIds : [],
    balance: totalIn - totalOut,
    totalIn,
    totalOut,
    entryCount: entries.length,
    lastEntryAt,
    createdAt: w.createdAt,
  };
}

function walletEntryDTO(e: WalletEntryRow, txId: string | null = null): WalletEntryDTO {
  return {
    id: e.id,
    walletId: e.walletId,
    type: e.type as WalletEntryDTO["type"],
    amount: e.amount,
    note: e.note,
    date: e.date,
    createdAt: e.createdAt,
    txId,
  };
}

export async function getWallets(): Promise<WalletDTO[]> {
  const d = db();
  const [rows, entries] = await Promise.all([d.wallets.toArray(), d.walletEntries.toArray()]);
  const byWallet = new Map<string, WalletEntryRow[]>();
  for (const e of entries) {
    const arr = byWallet.get(e.walletId);
    if (arr) arr.push(e);
    else byWallet.set(e.walletId, [e]);
  }
  return rows
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
    .map((w) => walletDTO(w, byWallet.get(w.id) ?? []));
}

export async function getWalletsOverview(): Promise<WalletsOverviewDTO> {
  const d = db();
  const [wallets, accounts, txs, entries] = await Promise.all([
    getWallets(),
    d.accounts.toArray(),
    d.transactions.toArray(),
    d.walletEntries.toArray(),
  ]);

  const titleById = new Map(wallets.map((w) => [w.id, w.title]));

  // ceiling alerts (مصرف ≥ 80% of سقف)
  const alerts: WalletAlertDTO[] = [];
  for (const w of wallets) {
    if (w.ceiling == null || w.ceiling <= 0) continue;
    const percent = Math.round((w.totalOut / w.ceiling) * 100);
    if (percent >= 80) {
      alerts.push({
        walletId: w.id,
        walletTitle: w.title,
        level: percent >= 100 ? "OVER" : "WARN",
        spent: w.totalOut,
        ceiling: w.ceiling,
        percent: Math.min(100, percent),
      });
    }
  }
  alerts.sort((a, b) => (a.level === b.level ? b.percent - a.percent : a.level === "OVER" ? -1 : 1));

  // accounts linked to any wallet
  const linkedAccounts: WalletLinkedAccountDTO[] = [];
  for (const w of wallets) {
    for (const accId of w.linkedAccountIds) {
      const acc = accounts.find((a) => a.id === accId);
      if (!acc) continue;
      linkedAccounts.push({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: computeBalance(acc.id, acc.initialBalance, txs),
        walletId: w.id,
        walletTitle: w.title,
      });
    }
  }

  // last 10 entries across all wallets
  const recentEntries = [...entries]
    .sort((a, b) => ms(b.date) - ms(a.date))
    .slice(0, 10)
    .map((e) => ({
      ...walletEntryDTO(e),
      walletTitle: titleById.get(e.walletId) ?? "",
    }));

  return {
    wallets,
    totalBalance: wallets.reduce((s, w) => s + w.balance, 0),
    totalIn: wallets.reduce((s, w) => s + w.totalIn, 0),
    totalOut: wallets.reduce((s, w) => s + w.totalOut, 0),
    walletCount: wallets.length,
    alerts,
    linkedAccounts,
    recentEntries,
  };
}

export async function saveWallet(
  payload: Record<string, unknown> & { id?: string },
): Promise<WalletDTO> {
  const d = db();
  const { id, ...body } = payload;

  // linked accounts — must reference existing accounts
  let linkedAccountIds: string[] | undefined;
  if (body.linkedAccountIds !== undefined) {
    const raw = Array.isArray(body.linkedAccountIds) ? body.linkedAccountIds : [];
    const all = await d.accounts.toArray();
    const validIds = new Set(all.map((a) => a.id));
    linkedAccountIds = raw.map((x) => String(x)).filter((x) => validIds.has(x));
  }

  if (!id) {
    // ── POST ──
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان کیف پول الزامی است", 400);

    const ceiling =
      body.ceiling === undefined || body.ceiling === null || body.ceiling === ""
        ? null
        : toNum(body.ceiling);
    if (ceiling !== null && (ceiling === undefined || ceiling < 0))
      throw new ApiError("سقف مصرف نمی‌تواند منفی باشد", 400);

    const row: WalletRow = {
      id: newId(),
      title,
      ceiling,
      linkedAccountIds: linkedAccountIds ?? [],
      createdAt: new Date().toISOString(),
    };
    await d.wallets.add(row);

    // optional initial balance → an IN entry «موجودی اولیه»
    const initialBalance = toNum(body.initialBalance);
    if (initialBalance !== undefined && initialBalance > 0) {
      const now = new Date().toISOString();
      const entry: WalletEntryRow = {
        id: newId(),
        walletId: row.id,
        type: "IN",
        amount: initialBalance,
        note: "موجودی اولیه",
        date: now,
        createdAt: now,
      };
      await d.walletEntries.add(entry);
    }

    const entries = await d.walletEntries.where("walletId").equals(row.id).toArray();
    return walletDTO(row, entries);
  }

  // ── PATCH ──
  const existing = await d.wallets.get(id);
  if (!existing) throw new ApiError("کیف پول یافت نشد", 404);

  const data: Partial<WalletRow> = {};
  if (body.title !== undefined) {
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان کیف پول الزامی است", 400);
    data.title = title;
  }
  if (body.ceiling !== undefined) {
    const ceiling = body.ceiling === null || body.ceiling === "" ? null : toNum(body.ceiling);
    if (ceiling !== null && (ceiling === undefined || ceiling < 0))
      throw new ApiError("سقف مصرف نمی‌تواند منفی باشد", 400);
    data.ceiling = ceiling;
  }
  if (linkedAccountIds !== undefined) data.linkedAccountIds = linkedAccountIds;

  const merged = { ...existing, ...data };
  await d.wallets.put(merged);
  const entries = await d.walletEntries.where("walletId").equals(id).toArray();
  return walletDTO(merged, entries);
}

export async function deleteWallet(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.wallets.get(id);
  if (!existing) throw new ApiError("کیف پول یافت نشد", 404);
  await d.transaction("rw", d.wallets, d.walletEntries, async () => {
    await d.walletEntries.where("walletId").equals(id).delete();
    await d.wallets.delete(id);
  });
  return { ok: true };
}

export async function getWalletEntries(walletId: string): Promise<WalletEntryDTO[]> {
  const d = db();
  const existing = await d.wallets.get(walletId);
  if (!existing) throw new ApiError("کیف پول یافت نشد", 404);
  const rows = await d.walletEntries.where("walletId").equals(walletId).toArray();
  // map paired main transactions (transaction-form rows with a linked account)
  // so the UI can route edit/delete of those rows through the transaction itself
  const paired = new Map<string, string>(); // walletEntryId → txId
  const txs = await d.transactions.toArray();
  for (const t of txs) if (t.walletEntryId) paired.set(t.walletEntryId, t.id);
  const sorted = rows
    .sort(
      (a, b) =>
        dayMs(b.date) - dayMs(a.date) || ms(b.createdAt) - ms(a.createdAt)
    );
  // running wallet balance (newest → oldest): balanceAfter = wallet balance right
  // after that entry; wallet balance = Σ IN − Σ OUT over all entries, so stepping
  // backwards from the newest entry unwinds each amount
  let running = sorted.reduce((s, e) => s + (e.type === "IN" ? e.amount : -e.amount), 0);
  return sorted.map((e) => {
    const dto = walletEntryDTO(e, paired.get(e.id) ?? null);
    dto.balanceAfter = running;
    running += e.type === "OUT" ? e.amount : -e.amount; // step to the older entry
    return dto;
  });
}

export async function saveWalletEntry(
  payload: Record<string, unknown> & { id?: string },
): Promise<WalletEntryDTO> {
  const d = db();
  const { id, ...body } = payload;

  if (!id) {
    // ── POST ──
    const walletId = toStr(body.walletId);
    if (!walletId) throw new ApiError("کیف پول الزامی است", 400);
    const wallet = await d.wallets.get(walletId);
    if (!wallet) throw new ApiError("کیف پول یافت نشد", 404);

    const type = toStr(body.type) ?? "OUT";
    if (!WALLET_ENTRY_TYPES.includes(type)) throw new ApiError("نوع تراکنش نامعتبر است", 400);

    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);

    const note = toStr(body.note)?.trim() || null;
    const date = (toDt(body.date) ?? new Date()).toISOString();

    const row: WalletEntryRow = {
      id: newId(),
      walletId,
      type,
      amount,
      note,
      date,
      createdAt: new Date().toISOString(),
    };
    await d.walletEntries.add(row);
    return walletEntryDTO(row);
  }

  // ── PATCH ──
  const existing = await d.walletEntries.get(id);
  if (!existing) throw new ApiError("تراکنش یافت نشد", 404);

  const data: Partial<WalletEntryRow> = {};
  if (body.type !== undefined) {
    const t = toStr(body.type);
    if (!t || !WALLET_ENTRY_TYPES.includes(t))
      throw new ApiError("نوع تراکنش نامعتبر است", 400);
    data.type = t;
  }
  if (body.amount !== undefined) {
    const amount = toNum(body.amount);
    if (amount === undefined || amount <= 0)
      throw new ApiError("مبلغ باید بزرگ‌تر از صفر باشد", 400);
    data.amount = amount;
  }
  if (body.note !== undefined) data.note = toStr(body.note)?.trim() || null;
  if (body.date !== undefined) {
    const date = toDt(body.date);
    if (!date) throw new ApiError("تاریخ نامعتبر است", 400);
    data.date = date.toISOString();
  }

  const merged = { ...existing, ...data };
  await d.walletEntries.put(merged);
  return walletEntryDTO(merged);
}

export async function deleteWalletEntry(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.walletEntries.get(id);
  if (!existing) throw new ApiError("تراکنش یافت نشد", 404);
  await d.walletEntries.delete(id);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════
// روز شمار (Day counters) — countdown between two dates
// ═════════════════════════════════════════════════════════════

function dayCounterDTO(row: DayCounterRow): DayCounterDTO {
  const c = computeDayCounter(row.startDate, row.endDate, new Date(), row.alarmEnabled, row.alarmDays);
  return {
    id: row.id,
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    design: (DC_DESIGNS.includes(row.design) ? row.design : "RING") as DayCounterDesign,
    alarmEnabled: row.alarmEnabled,
    alarmDays: row.alarmDays,
    alarmSound: row.alarmSound,
    color: row.color,
    createdAt: row.createdAt,
    ...c,
  };
}

export async function getDayCounters(): Promise<DayCounterDTO[]> {
  const d = db();
  const rows = await d.dayCounters.toArray();
  return rows
    .map(dayCounterDTO)
    .sort((a, b) => a.remainingDays - b.remainingDays || ms(b.createdAt) - ms(a.createdAt));
}

export async function saveDayCounter(
  payload: Record<string, unknown> & { id?: string },
): Promise<DayCounterDTO> {
  const d = db();
  const { id, ...body } = payload;

  const parseDesign = (v: unknown): DayCounterDesign | undefined => {
    const s = toStr(v);
    if (!s) return undefined;
    return DC_DESIGNS.includes(s) ? (s as DayCounterDesign) : undefined;
  };

  const parseAlarmDays = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = toInt(v);
    if (n === undefined || n < 1 || n > 999)
      throw new ApiError("آستانه هشدار باید عددی بین ۱ تا ۹۹۹ باشد", 400);
    return n;
  };

  if (!id) {
    // ── POST ──
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان روز شمار الزامی است", 400);

    const startDate = toDt(body.startDate);
    const endDate = toDt(body.endDate);
    if (!startDate) throw new ApiError("تاریخ شروع الزامی است", 400);
    if (!endDate) throw new ApiError("تاریخ پایان الزامی است", 400);
    if (endOfDay(endDate).getTime() < startOfDay(startDate).getTime())
      throw new ApiError("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد", 400);

    const row: DayCounterRow = {
      id: newId(),
      title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      design: parseDesign(body.design) ?? "RING",
      alarmEnabled: body.alarmEnabled === true,
      alarmDays: parseAlarmDays(body.alarmDays) ?? 3,
      alarmSound: body.alarmSound === true,
      color: toStr(body.color) || "#4E9B72",
      createdAt: new Date().toISOString(),
    };
    await d.dayCounters.add(row);
    return dayCounterDTO(row);
  }

  // ── PATCH ──
  const existing = await d.dayCounters.get(id);
  if (!existing) throw new ApiError("روز شمار یافت نشد", 404);

  const data: Partial<DayCounterRow> = {};
  if (body.title !== undefined) {
    const title = toStr(body.title)?.trim();
    if (!title) throw new ApiError("عنوان روز شمار الزامی است", 400);
    data.title = title;
  }
  if (body.startDate !== undefined) {
    const startDate = toDt(body.startDate);
    if (!startDate) throw new ApiError("تاریخ شروع نامعتبر است", 400);
    data.startDate = startDate.toISOString();
  }
  if (body.endDate !== undefined) {
    const endDate = toDt(body.endDate);
    if (!endDate) throw new ApiError("تاریخ پایان نامعتبر است", 400);
    data.endDate = endDate.toISOString();
  }
  const nextStart = data.startDate ?? existing.startDate;
  const nextEnd = data.endDate ?? existing.endDate;
  if (endOfDay(new Date(nextEnd)).getTime() < startOfDay(new Date(nextStart)).getTime())
    throw new ApiError("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد", 400);
  if (body.design !== undefined) {
    data.design = parseDesign(body.design) ?? existing.design;
  }
  if (body.alarmEnabled !== undefined) data.alarmEnabled = body.alarmEnabled === true;
  if (body.alarmDays !== undefined) {
    const n = parseAlarmDays(body.alarmDays);
    if (n !== undefined) data.alarmDays = n;
  }
  if (body.alarmSound !== undefined) data.alarmSound = body.alarmSound === true;
  if (body.color !== undefined) data.color = toStr(body.color) || existing.color;

  const merged = { ...existing, ...data };
  await d.dayCounters.put(merged);
  return dayCounterDTO(merged);
}

export async function deleteDayCounter(id: string): Promise<{ ok: boolean }> {
  const d = db();
  const existing = await d.dayCounters.get(id);
  if (!existing) throw new ApiError("روز شمار یافت نشد", 404);
  await d.dayCounters.delete(id);
  return { ok: true };
}
