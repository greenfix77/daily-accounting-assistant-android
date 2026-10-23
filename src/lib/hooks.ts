"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDebtPayment,
  addDeposit,
  deleteAccount,
  deleteBudget,
  deleteCategory,
  deleteDebt,
  deleteGoal,
  deleteRecurring,
  deleteReminder,
  deleteTransaction,
  getAccounts,
  getBackup,
  getBudgets,
  getCategories,
  getDashboard,
  getDebts,
  getReminders,
  getRecurring,
  getReports,
  getSavings,
  getSettings,
  getTransaction,
  getTransactions,
  login as loginLocal,
  register as registerLocal,
  restoreBackup,
  saveAccount,
  saveBudget,
  saveCategory,
  saveDebt,
  saveGoal,
  saveRecurring,
  saveReminder,
  saveTransaction,
  setInstallmentPaid,
  toggleReminder as toggleReminderLocal,
  updateSettings as updateSettingsLocal,
  deleteWallet,
  deleteWalletEntry,
  getWalletEntries,
  getWalletsOverview,
  saveWallet,
  saveWalletEntry,
} from "./local/api";
import { isBrowser } from "./local/db";
import type {
  AccountDTO,
  BudgetsDTO,
  BudgetItemDTO,
  CategoryDTO,
  DashboardDTO,
  DebtDTO,
  ProfileDTO,
  RecurringDTO,
  ReminderDTO,
  ReportsDTO,
  SavingsGoalDTO,
  TransactionDTO,
  TxType,
  ReportPeriod,
  WalletEntryDTO,
  WalletsOverviewDTO,
} from "./types";

// All data lives in the client-local database (IndexedDB via Dexie).
// Queries must not run during Node prerender → `enabled: isBrowser`.

// ── Settings / Profile ───────────────────────────────────────
export function useSettings() {
  return useQuery<ProfileDTO>({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
    enabled: isBrowser,
    staleTime: 30_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<ProfileDTO>) => updateSettingsLocal(patch),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      qc.invalidateQueries();
    },
  });
}

// ── Dashboard ────────────────────────────────────────────────
export function useDashboard() {
  return useQuery<DashboardDTO>({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    enabled: isBrowser,
  });
}

// ── Transactions ─────────────────────────────────────────────
export type TxFilters = {
  type?: TxType;
  q?: string;
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  limit?: number;
};

export function useTransactions(filters: TxFilters = {}) {
  return useQuery<TransactionDTO[]>({
    queryKey: ["transactions", filters],
    queryFn: () => getTransactions(filters),
    enabled: isBrowser,
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery<TransactionDTO>({
    queryKey: ["transactions", "detail", id],
    queryFn: () => getTransaction(id as string),
    enabled: isBrowser && !!id,
  });
}

export function useSaveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) =>
      saveTransaction(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Accounts ─────────────────────────────────────────────────
export function useAccounts() {
  return useQuery<AccountDTO[]>({
    queryKey: ["accounts"],
    queryFn: () => getAccounts(),
    enabled: isBrowser,
  });
}

export function useSaveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveAccount(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Categories ───────────────────────────────────────────────
export function useCategories(type?: "INCOME" | "EXPENSE", withStats = false) {
  return useQuery<CategoryDTO[]>({
    queryKey: ["categories", type ?? "all", withStats],
    queryFn: () => getCategories(type, withStats),
    enabled: isBrowser,
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveCategory(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Budgets ──────────────────────────────────────────────────
export function useBudgets(month?: string) {
  return useQuery<BudgetsDTO>({
    queryKey: ["budgets", month ?? "current"],
    queryFn: () => getBudgets(month),
    enabled: isBrowser,
  });
}

export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveBudget(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Debts ────────────────────────────────────────────────────
export function useDebts() {
  return useQuery<DebtDTO[]>({
    queryKey: ["debts"],
    queryFn: () => getDebts(),
    enabled: isBrowser,
  });
}

export function useSaveDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveDebt(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDebt(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useAddDebtPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, ...body }: { debtId: string; amount: number; date?: string; notes?: string }) =>
      addDebtPayment({ debtId, ...body }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Recurring ────────────────────────────────────────────────
export function useRecurring() {
  return useQuery<RecurringDTO[]>({
    queryKey: ["recurring"],
    queryFn: () => getRecurring(),
    enabled: isBrowser,
  });
}

export function useSaveRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveRecurring(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecurring(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useSetInstallmentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; n: number; paid: boolean; paidAt?: string }) =>
      setInstallmentPaid(body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Wallets ──────────────────────────────────────────────────
export function useWalletsOverview() {
  return useQuery<WalletsOverviewDTO>({
    queryKey: ["wallets-overview"],
    queryFn: () => getWalletsOverview(),
    enabled: isBrowser,
  });
}

export function useSaveWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveWallet(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWallet(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useWalletEntries(walletId?: string) {
  return useQuery<WalletEntryDTO[]>({
    queryKey: ["wallet-entries", walletId],
    queryFn: () => getWalletEntries(walletId as string),
    enabled: isBrowser && !!walletId,
  });
}

export function useSaveWalletEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveWalletEntry(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteWalletEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWalletEntry(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}
// ── Savings ──────────────────────────────────────────────────
export function useSavings() {
  return useQuery<SavingsGoalDTO[]>({
    queryKey: ["savings"],
    queryFn: () => getSavings(),
    enabled: isBrowser,
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveGoal(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useAddDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, ...body }: { goalId: string; amount: number; date?: string; notes?: string }) =>
      addDeposit({ goalId, ...body }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Reminders ────────────────────────────────────────────────
export function useReminders(pendingOnly = false) {
  return useQuery<ReminderDTO[]>({
    queryKey: ["reminders", pendingOnly],
    queryFn: () => getReminders(pendingOnly),
    enabled: isBrowser,
  });
}

export function useSaveReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id?: string }) => saveReminder(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useToggleReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
      toggleReminderLocal({ id, isDone }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Reports ──────────────────────────────────────────────────
export function useReports(period: ReportPeriod, offset = 0) {
  return useQuery<ReportsDTO>({
    queryKey: ["reports", period, offset],
    queryFn: () => getReports(period, offset),
    enabled: isBrowser,
  });
}

// ── Auth ─────────────────────────────────────────────────────
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => loginLocal(email),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string }) => registerLocal(body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── Backup restore ───────────────────────────────────────────
export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => restoreBackup(payload),
    onSuccess: () => qc.invalidateQueries(),
  });
}
