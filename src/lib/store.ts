"use client";

import { create } from "zustand";

export type Tab = "home" | "transactions" | "reports" | "planning" | "settings";

export type ScreenId =
  | "home"
  | "transactions"
  | "reports"
  | "planning"
  | "settings"
  | "welcome"
  | "login"
  | "signup"
  | "transaction-form"
  | "transaction-details"
  | "accounts"
  | "account-form"
  | "categories"
  | "category-form"
  | "budget"
  | "debts"
  | "debt-form"
  | "recurring"
  | "recurring-form"
  | "recurring-details"
  | "wallet"
  | "wallet-form"
  | "wallet-details"
  | "savings"
  | "goal-form"
  | "reminders"
  | "export"
  | "profile"
  | "about";

export interface ScreenEntry {
  id: ScreenId;
  params?: Record<string, unknown>;
}

interface AppState {
  /** current root tab */
  tab: Tab;
  /** overlay screens stacked above the tab root */
  stack: ScreenEntry[];
  /** whether onboarding is complete (controls welcome flow) */
  authed: boolean;
  setTab: (t: Tab) => void;
  push: (id: ScreenId, params?: Record<string, unknown>) => void;
  replace: (id: ScreenId, params?: Record<string, unknown>) => void;
  back: () => void;
  popToRoot: () => void;
  setAuthed: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tab: "home",
  stack: [],
  authed: false,
  setTab: (t) => set({ tab: t, stack: [] }),
  push: (id, params) =>
    set((s) => ({ stack: [...s.stack, { id, params }] })),
  replace: (id, params) =>
    set((s) => {
      const stack = [...s.stack];
      stack[stack.length - 1] = { id, params };
      return { stack };
    }),
  back: () =>
    set((s) => ({ stack: s.stack.slice(0, -1) })),
  popToRoot: () => set({ stack: [] }),
  setAuthed: (v) => set({ authed: v }),
}));

/** current screen to render (tab root or stack top) */
export function useCurrentScreen(): ScreenEntry {
  const stack = useAppStore((s) => s.stack);
  const tab = useAppStore((s) => s.tab);
  return stack.length > 0 ? stack[stack.length - 1] : { id: tab };
}

export function isTabRoot(id: ScreenId): boolean {
  return id === "home" || id === "transactions" || id === "reports" || id === "planning" || id === "settings";
}
