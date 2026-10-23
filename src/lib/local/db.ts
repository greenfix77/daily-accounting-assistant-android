// ─────────────────────────────────────────────────────────────
// Local (offline) database layer — Dexie/IndexedDB.
// Mirrors prisma/schema.prisma models 1:1 (same field names).
// Dates are stored as ISO strings; amounts as numbers (FLOAT).
// receipts (receiptUrl / avatar) are dataURL strings.
//
// IMPORTANT: this module must be SSR/Node-safe. The app is
// prerendered at build time where indexedDB does NOT exist —
// nothing here touches indexedDB at import time. Call sites use
// getDb() and handle the null case (they throw a friendly error).
// ─────────────────────────────────────────────────────────────

import Dexie, { type Table } from "dexie";

export const isBrowser = typeof window !== "undefined";

// ── Row interfaces (mirror Prisma models) ────────────────────

export interface ProfileRow {
  id: string; // always "main"
  name: string;
  email: string;
  avatar: string | null;
  language: string; // fa | en
  theme: string; // light | dark | system
  calendar: string; // jalali | gregorian
  currency: string; // IRT | IRR | USD
  weekStart: string; // sat | mon
  appLock: boolean;
  pin: string | null;
  biometricLock: boolean;
  notificationsEnabled: boolean;
  onboarded: boolean;
  createdAt: string; // ISO
}

export interface AccountRow {
  id: string;
  name: string;
  type: string; // BANK | CASH | SAVINGS | CUSTOM
  color: string;
  icon: string;
  initialBalance: number;
  isDefault: boolean;
  createdAt: string; // ISO
}

export interface CategoryRow {
  id: string;
  name: string;
  type: string; // INCOME | EXPENSE
  icon: string;
  color: string;
  isDefault: boolean;
  createdAt: string; // ISO
}

export interface TransactionRow {
  id: string;
  type: string; // INCOME | EXPENSE | TRANSFER
  amount: number;
  title: string | null;
  description: string | null;
  notes: string | null;
  receiptUrl: string | null; // dataURL
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  recurringId: string | null;
  /** wallet-linked transaction — wallet the entry belongs to (null = plain account transaction) */
  walletId: string | null;
  /** wallet-linked transaction — the paired WalletEntryRow id (null = plain account transaction) */
  walletEntryId: string | null;
  date: string; // ISO
  createdAt: string; // ISO
}

export interface BudgetRow {
  id: string;
  month: string; // "1403-07" jalali month key
  amount: number;
  categoryId: string | null;
  createdAt: string; // ISO
}

export interface DebtRow {
  id: string;
  person: string;
  type: string; // OWED_TO_ME | I_OWE
  amount: number;
  paidAmount: number;
  date: string; // ISO
  dueDate: string | null; // ISO
  notes: string | null;
  settledAt: string | null; // ISO
  createdAt: string; // ISO
}

export interface DebtPaymentRow {
  id: string;
  debtId: string;
  amount: number;
  date: string; // ISO
  notes: string | null;
}

export interface RecurringRow {
  id: string;
  title: string;
  type: string; // legacy only ("EXPENSE" | "INCOME") — اقساط has no accounting impact
  amount: number;
  accountId: string; // legacy only — new rows store ""
  categoryId: string | null; // legacy only — new rows store null
  frequency: string; // DAILY | WEEKLY | MONTHLY | YEARLY
  startDate: string; // ISO — due date of installment #1
  endDate: string | null; // legacy only — new rows store null
  totalCount: number | null;
  paidCount: number; // synced with paidMap size
  lastPaidAt: string | null; // ISO — max of paidMap values
  /** installment number (as string, 1-based) → actual payment date (ISO) */
  paidMap?: Record<string, string>;
  isActive: boolean;
  createdAt: string; // ISO
}

export interface SavingsGoalRow {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null; // ISO
  color: string;
  icon: string;
  createdAt: string; // ISO
}

export interface SavingsDepositRow {
  id: string;
  goalId: string;
  amount: number; // + deposit, - withdraw
  date: string; // ISO
  notes: string | null;
}

export interface ReminderRow {
  id: string;
  title: string;
  type: string; // BILL | INSTALLMENT | DEBT | SAVINGS | CUSTOM
  date: string; // ISO
  time: string | null;
  repeat: string; // NONE | DAILY | WEEKLY | MONTHLY | YEARLY
  isDone: boolean;
  createdAt: string; // ISO
}

export interface WalletRow {
  id: string;
  title: string;
  ceiling: number | null; // مصرف ceiling (سقف) — null = unlimited
  linkedAccountIds: string[]; // informational links to accounts
  createdAt: string; // ISO
}

export interface WalletEntryRow {
  id: string;
  walletId: string;
  type: string; // IN | OUT
  amount: number;
  note: string | null;
  date: string; // ISO
  createdAt: string; // ISO
}

export interface DayCounterRow {
  id: string;
  title: string;
  startDate: string; // ISO — شروع بازه شمارش
  endDate: string; // ISO — تاریخ پایان (رویداد)
  design: string; // RING | FLIP | BAR — طراحی کانتر
  alarmEnabled: boolean;
  alarmDays: number; // آستانه هشدار (تعداد روز مانده)
  alarmSound: boolean; // پخش بوق هنگام هشدار
  color: string;
  createdAt: string; // ISO
}

// ── Dexie database ───────────────────────────────────────────

export class HesabyarDB extends Dexie {
  profile!: Table<ProfileRow, string>;
  accounts!: Table<AccountRow, string>;
  categories!: Table<CategoryRow, string>;
  transactions!: Table<TransactionRow, string>;
  budgets!: Table<BudgetRow, string>;
  debts!: Table<DebtRow, string>;
  debtPayments!: Table<DebtPaymentRow, string>;
  recurrings!: Table<RecurringRow, string>;
  savingsGoals!: Table<SavingsGoalRow, string>;
  savingsDeposits!: Table<SavingsDepositRow, string>;
  reminders!: Table<ReminderRow, string>;
  wallets!: Table<WalletRow, string>;
  walletEntries!: Table<WalletEntryRow, string>;
  dayCounters!: Table<DayCounterRow, string>;

  constructor() {
    super("hesabyar-reyra");
    this.version(1).stores({
      profile: "id",
      accounts: "id, isDefault, createdAt",
      categories: "id, type, name",
      transactions:
        "id, date, type, accountId, toAccountId, categoryId, debtId, recurringId, createdAt",
      budgets: "id, month, categoryId",
      debts: "id, type",
      debtPayments: "id, debtId, date",
      recurrings: "id",
      savingsGoals: "id",
      savingsDeposits: "id, goalId, date",
      reminders: "id, date, isDone",
    });
    this.version(2).stores({
      wallets: "id",
      walletEntries: "id, walletId, date",
    });
    this.version(3).stores({
      dayCounters: "id",
    });
  }
}

// Lazy singleton — never instantiated during SSR/prerender.
let _db: HesabyarDB | null | undefined;

export function getDb(): HesabyarDB | null {
  if (_db !== undefined) return _db;
  if (!isBrowser || typeof indexedDB === "undefined") {
    _db = null;
    return _db;
  }
  _db = new HesabyarDB();
  return _db;
}

/** id generator: crypto.randomUUID() with a safe fallback. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
