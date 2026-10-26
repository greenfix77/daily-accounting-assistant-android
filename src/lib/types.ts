// ─────────────────────────────────────────────────────────────
// DTO contracts shared between API routes and client screens
// ─────────────────────────────────────────────────────────────

export type Lang = "fa" | "en";
export type ThemeMode = "light" | "dark" | "system";
export type CalType = "jalali" | "gregorian";
export type CurrencyCode = "IRT" | "IRR" | "USD";
export type TxType = "INCOME" | "EXPENSE" | "TRANSFER";
export type AccountType = "BANK" | "CASH" | "SAVINGS" | "CUSTOM";
export type CategoryType = "INCOME" | "EXPENSE";
export type DebtType = "OWED_TO_ME" | "I_OWE";
export type DebtStatus = "PAID" | "PENDING" | "OVERDUE";
export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type ReminderType = "BILL" | "INSTALLMENT" | "DEBT" | "SAVINGS" | "CUSTOM";
export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface ProfileDTO {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  language: Lang;
  theme: ThemeMode;
  calendar: CalType;
  currency: CurrencyCode;
  weekStart: "sat" | "mon";
  appLock: boolean;
  pin: string | null;
  biometricLock: boolean;
  notificationsEnabled: boolean;
  dayCounterOnHome: boolean;
  homeWidgets: string;
  onboarded: boolean;
  createdAt: string;
}

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  icon: string;
  initialBalance: number;
  balance: number;
  isDefault: boolean;
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isDefault: boolean;
  spent?: number;
  count?: number;
}

export interface TransactionDTO {
  id: string;
  type: TxType;
  amount: number;
  title: string | null;
  description: string | null;
  notes: string | null;
  receiptUrl: string | null;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  /** wallet-linked transaction — wallet it also applies to (null = plain account transaction) */
  walletId: string | null;
  walletName: string | null;
  /** wallet-linked transaction — id of the paired wallet entry */
  walletEntryId: string | null;
  date: string;
  createdAt: string;
  /** running balance of the row's primary account right after this transaction — set only for date-based sorts in list results (null/undefined = don't show) */
  balanceAfter?: number | null;
}

export interface BudgetItemDTO {
  id: string;
  month: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  amount: number;
  spent: number;
  percent: number;
}

export interface BudgetsDTO {
  month: string;
  total: number;
  overallSpent: number;
  items: BudgetItemDTO[];
}

export interface DebtPaymentDTO {
  id: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface DebtDTO {
  id: string;
  person: string;
  type: DebtType;
  amount: number;
  paidAmount: number;
  remaining: number;
  date: string;
  dueDate: string | null;
  notes: string | null;
  status: DebtStatus;
  settledAt: string | null;
  payments: DebtPaymentDTO[];
}

/**
 * اقساط — a pure payment-tracker (no accounting impact):
 * every installment is computed from startDate + frequency, and
 * `paidMap` records which installment numbers are already paid
 * (key = 1-based installment number, value = actual payment date ISO,
 * which defaults to the scheduled due date when not provided).
 */
export interface RecurringDTO {
  id: string;
  title: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  totalCount: number | null;
  paidCount: number;
  lastPaidAt: string | null;
  isActive: boolean;
  /** date of the first unpaid installment (null = finished or paused) */
  nextDue: string | null;
  /** installment number (as string) → payment date (ISO) */
  paidMap: Record<string, string>;
}

export interface SavingsDepositDTO {
  id: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface SavingsGoalDTO {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  color: string;
  icon: string;
  current: number;
  percent: number;
  deposits: SavingsDepositDTO[];
}

export interface ReminderDTO {
  id: string;
  title: string;
  type: ReminderType;
  date: string;
  time: string | null;
  repeat: string;
  isDone: boolean;
  daysLeft: number;
}

export interface UpcomingDTO {
  id: string;
  title: string;
  amount: number | null;
  date: string;
  kind: "RECURRING" | "DEBT" | "REMINDER";
  daysLeft: number;
}

export interface DashboardDTO {
  totalBalance: number;
  todayIncome: number;
  todayExpense: number;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  budget: { total: number; spent: number; percent: number } | null;
  week: { date: string; income: number; expense: number }[];
  recent: TransactionDTO[];
  upcoming: UpcomingDTO[];
  debts: { owedToMe: number; iOwe: number };
  goals: { id: string; name: string; percent: number; current: number; target: number; color: string }[];
}

export interface ReportCategoryDTO {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percent: number;
}

export interface ReportsDTO {
  period: ReportPeriod;
  from: string;
  to: string;
  income: number;
  expense: number;
  net: number;
  series: { label: string; income: number; expense: number }[];
  categories: ReportCategoryDTO[];
  incomeCategories: ReportCategoryDTO[];
  accounts: { accountId: string; name: string; color: string; income: number; expense: number }[];
}

export interface ScreenParams {
  [key: string]: unknown;
}

// ── Wallets (کیف پول) ────────────────────────────────────────

export type WalletEntryType = "IN" | "OUT";

/** کیف پول — a standalone money pocket with its own balance and optional spending ceiling. */
export interface WalletDTO {
  id: string;
  title: string;
  /** مصرف ceiling (سقف) — null = unlimited */
  ceiling: number | null;
  /** account ids linked to this wallet (informational) */
  linkedAccountIds: string[];
  /** sum(IN) - sum(OUT) */
  balance: number;
  totalIn: number;
  totalOut: number;
  entryCount: number;
  lastEntryAt: string | null;
  createdAt: string;
}

export interface WalletEntryDTO {
  id: string;
  walletId: string;
  type: WalletEntryType;
  amount: number;
  note: string | null;
  date: string; // ISO
  createdAt: string;
  /** paired main transaction id when this entry was created via the transaction form with a linked account (null = wallet-only row) */
  txId: string | null;
  /** wallet balance right after this entry (running balance, newest first) — set in list results */
  balanceAfter?: number;
}

export interface WalletLinkedAccountDTO {
  id: string;
  name: string;
  type: string;
  balance: number;
  walletId: string;
  walletTitle: string;
}

export interface WalletAlertDTO {
  walletId: string;
  walletTitle: string;
  level: "WARN" | "OVER";
  spent: number;
  ceiling: number;
  percent: number;
}

export interface WalletsOverviewDTO {
  wallets: WalletDTO[];
  totalBalance: number;
  totalIn: number;
  totalOut: number;
  walletCount: number;
  alerts: WalletAlertDTO[];
  linkedAccounts: WalletLinkedAccountDTO[];
  recentEntries: (WalletEntryDTO & { walletTitle: string })[];
}

// ── Day counters (روز شمار) ─────────────────────────────────

export type DayCounterDesign = "RING" | "FLIP" | "BAR";
export type DayCounterStatus = "NOT_STARTED" | "ACTIVE" | "FINISHED";
export type DayCounterAlarmLevel = "NONE" | "NEAR" | "TODAY" | "OVER";

/** روز شمار — countdown between two user-chosen dates with a configurable alarm. */
export interface DayCounterDTO {
  id: string;
  title: string;
  startDate: string; // ISO
  endDate: string; // ISO
  design: DayCounterDesign;
  alarmEnabled: boolean;
  alarmDays: number;
  alarmSound: boolean;
  color: string;
  createdAt: string;
  // computed (at fetch time; UI recomputes live)
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  percent: number;
  status: DayCounterStatus;
  alarmLevel: DayCounterAlarmLevel;
}
