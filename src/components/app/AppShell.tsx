"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Home, ArrowLeftRight, BarChart3, LayoutGrid, Plus, Loader2 } from "lucide-react";
import { useAppStore, useCurrentScreen, isTabRoot, type Tab } from "@/lib/store";
import { useSettings } from "@/lib/hooks";
import { makeT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import WelcomeScreen from "./screens/WelcomeScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import LockScreen from "./screens/LockScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AboutScreen from "./screens/AboutScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ReportsScreen from "./screens/ReportsScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import TransactionFormScreen from "./screens/TransactionFormScreen";
import TransactionDetailsScreen from "./screens/TransactionDetailsScreen";
import AccountsScreen from "./screens/AccountsScreen";
import AccountFormScreen from "./screens/AccountFormScreen";
import CategoriesScreen from "./screens/CategoriesScreen";
import CategoryFormScreen from "./screens/CategoryFormScreen";
import BudgetScreen from "./screens/BudgetScreen";
import DebtsScreen from "./screens/DebtsScreen";
import DebtFormScreen from "./screens/DebtFormScreen";
import RecurringScreen from "./screens/RecurringScreen";
import RecurringFormScreen from "./screens/RecurringFormScreen";
import RecurringDetailsScreen from "./screens/RecurringDetailsScreen";
import WalletScreen from "./screens/WalletScreen";
import WalletFormScreen from "./screens/WalletFormScreen";
import WalletDetailsScreen from "./screens/WalletDetailsScreen";
import SavingsScreen from "./screens/SavingsScreen";
import GoalFormScreen from "./screens/GoalFormScreen";
import PlanningScreen from "./screens/PlanningScreen";
import RemindersScreen from "./screens/RemindersScreen";
import ExportScreen from "./screens/ExportScreen";

const SCREENS: Record<string, React.ComponentType<{ params?: Record<string, unknown> }>> = {
  welcome: WelcomeScreen,
  login: LoginScreen,
  signup: SignupScreen,
  settings: SettingsScreen,
  profile: ProfileScreen,
  about: AboutScreen,
  home: DashboardScreen,
  reports: ReportsScreen,
  transactions: TransactionsScreen,
  "transaction-form": TransactionFormScreen,
  "transaction-details": TransactionDetailsScreen,
  accounts: AccountsScreen,
  "account-form": AccountFormScreen,
  categories: CategoriesScreen,
  "category-form": CategoryFormScreen,
  budget: BudgetScreen,
  debts: DebtsScreen,
  "debt-form": DebtFormScreen,
  recurring: RecurringScreen,
  "recurring-form": RecurringFormScreen,
  "recurring-details": RecurringDetailsScreen,
  wallet: WalletScreen,
  "wallet-form": WalletFormScreen,
  "wallet-details": WalletDetailsScreen,
  savings: SavingsScreen,
  "goal-form": GoalFormScreen,
  planning: PlanningScreen,
  reminders: RemindersScreen,
  export: ExportScreen,
};

const TABS: { id: Tab; icon: React.ElementType; labelKey: string }[] = [
  { id: "home", icon: Home, labelKey: "nav.home" },
  { id: "transactions", icon: ArrowLeftRight, labelKey: "nav.transactions" },
  { id: "reports", icon: BarChart3, labelKey: "nav.reports" },
  { id: "planning", icon: LayoutGrid, labelKey: "nav.planning" },
];

function TabButton({
  tb,
  active,
  onClick,
  t,
}: {
  tb: { id: Tab; icon: React.ElementType; labelKey: string };
  active: boolean;
  onClick: () => void;
  t: (k: string) => string;
}) {
  const Icon = tb.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl min-w-[52px] transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className={cn("w-[22px] h-[22px]", active && "stroke-[2.4]")} />
      <span className="text-[10px] font-semibold">{t(tb.labelKey)}</span>
    </button>
  );
}

function BottomNav() {
  const { tab, setTab, push } = useAppStore();
  const { data: settings } = useSettings();
  const t = React.useMemo(() => makeT(settings?.language ?? "fa"), [settings?.language]);
  return (
    <nav className="relative z-30 shrink-0 bg-card/95 backdrop-blur-md border-t border-border/60 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end justify-around">
        {TABS.slice(0, 2).map((tb) => (
          <TabButton key={tb.id} tb={tb} active={tab === tb.id} onClick={() => setTab(tb.id)} t={t} />
        ))}
        <div className="w-16 flex justify-center -mt-6">
          <button
            onClick={() => push("transaction-form", { mode: "add" })}
            aria-label="add transaction"
            className="app-gradient w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/35 border-4 border-card active:scale-95 transition-transform"
          >
            <Plus className="w-7 h-7" strokeWidth={2.5} />
          </button>
        </div>
        {TABS.slice(2).map((tb) => (
          <TabButton key={tb.id} tb={tb} active={tab === tb.id} onClick={() => setTab(tb.id)} t={t} />
        ))}
      </div>
    </nav>
  );
}

function LockGate({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();
  const [locked, setLocked] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    setLocked(
      !!(settings?.appLock && settings.pin && sessionStorage.getItem("app-unlocked") !== "1")
    );
  }, [settings?.appLock, settings?.pin]);
  if (locked === null || locked) {
    return <LockScreen onUnlock={() => setLocked(false)} visible={locked !== null} />;
  }
  return <>{children}</>;
}

export default function AppShell() {
  const { data: settings, isLoading } = useSettings();
  const current = useCurrentScreen();
  const { authed, setAuthed, stack } = useAppStore();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    if (settings?.theme) setTheme(settings.theme);
  }, [settings?.theme, setTheme]);

  React.useEffect(() => {
    if (!settings) return;
    document.documentElement.dir = settings.language === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = settings.language;
  }, [settings?.language]);

  React.useEffect(() => {
    if (settings && settings.onboarded) setAuthed(true);
  }, [settings?.onboarded, setAuthed]);

  // Android hardware back button → walk our internal screen stack
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener("backButton", () => {
      const s = useAppStore.getState();
      if (s.stack.length > 0) s.back();
      else if (s.tab !== "home") s.setTab("home");
      else void CapApp.exitApp();
    }).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, []);

  if (isLoading || !settings) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-background">
        <div className="app-gradient w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/30">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      </div>
    );
  }

  const inWelcomeFlow = !authed;
  const showNav = !inWelcomeFlow && isTabRoot(current.id) && stack.length === 0;
  const screenId = inWelcomeFlow && isTabRoot(current.id) ? "welcome" : current.id;
  const ScreenComp = SCREENS[screenId] ?? DashboardScreen;

  return (
    <LockGate>
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenId + JSON.stringify(current.params ?? {})}
            initial={{ opacity: 0, x: stack.length > 0 ? -14 : 0, y: stack.length > 0 ? 0 : 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 14 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex-1 flex flex-col min-h-0"
          >
            <ScreenComp params={current.params} />
          </motion.div>
        </AnimatePresence>
        {showNav && <BottomNav />}
      </div>
    </LockGate>
  );
}
