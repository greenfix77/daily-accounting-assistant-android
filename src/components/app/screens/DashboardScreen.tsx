"use client";

import * as React from "react";
import {
  Bell,
  Settings,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Repeat,
  HandCoins,
} from "lucide-react";
import {
  useAppFormat,
  AmountText,
  IconBubble,
  ProgressBar,
} from "@/components/app/ui";
import { useDashboard, useSettings, useReminders } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { WEEKDAY_NAMES_FA, WEEKDAY_NAMES_EN } from "@/lib/jalali";
import type { TransactionDTO, UpcomingDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const INCOME_COLOR = "#4E9B72";
const EXPENSE_COLOR = "#F0A868";

// ── Recent transaction row ───────────────────────────────────
function TxRow({ tx }: { tx: TransactionDTO }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  return (
    <button
      onClick={() => push("transaction-details", { id: tx.id })}
      className="w-full flex items-center gap-3 py-2.5 text-start hover:bg-secondary/40 rounded-xl px-1 transition-colors"
    >
      <IconBubble
        icon={tx.categoryIcon ?? (tx.type === "INCOME" ? "briefcase" : "shopping-cart")}
        color={tx.categoryColor ?? (tx.type === "INCOME" ? INCOME_COLOR : EXPENSE_COLOR)}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-foreground truncate">
          {tx.title ?? tx.categoryName ?? (tx.type === "INCOME" ? f.t("rep.income") : tx.type === "EXPENSE" ? f.t("rep.expense") : f.t("rep.balance"))}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {tx.accountName} • {f.dateShort(tx.date)}
        </p>
      </div>
      <AmountText value={tx.amount} type={tx.type} className="text-[13px] shrink-0" withUnit={false} />
    </button>
  );
}

// ── Upcoming row ─────────────────────────────────────────────
function UpcomingRow({ item }: { item: UpcomingDTO }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const Icon = item.kind === "RECURRING" ? Repeat : item.kind === "DEBT" ? HandCoins : Bell;
  const color =
    item.kind === "RECURRING" ? "#5E9EA0" : item.kind === "DEBT" ? "#E5B84E" : "#D97BA6";
  const urgent = item.daysLeft < 3;
  return (
    <button
      onClick={() =>
        item.kind === "RECURRING"
          ? push("recurring")
          : item.kind === "DEBT"
            ? push("debts")
            : push("reminders")
      }
      className="w-full flex items-center gap-3 py-2.5 text-start hover:bg-secondary/40 rounded-xl px-1 transition-colors"
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{item.title}</p>
        <p className={cn("text-[11px]", urgent ? "text-expense font-semibold" : "text-muted-foreground")}>
          {f.daysLabel(item.date)}
        </p>
      </div>
      {item.amount != null && (
        <span className="num-input text-[12px] font-bold text-foreground shrink-0">
          {f.money(item.amount, false)}
        </span>
      )}
    </button>
  );
}

export default function DashboardScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const { data: settings } = useSettings();
  const { data: d, isLoading } = useDashboard();
  const { data: pendingReminders } = useReminders(true);
  const push = useAppStore((s) => s.push);
  const setTab = useAppStore((s) => s.setTab);
  const [show, setShow] = React.useState(true);

  const firstName = (settings?.name ?? "").split(" ")[0] || settings?.name || "";
  const reminderCount = pendingReminders?.length ?? 0;

  // «شنبه ۲۴ مرداد ۱۴۰۳» — respects calendar/language settings
  const todayLabel = React.useMemo(() => {
    const now = new Date();
    const wd = (now.getDay() + 1) % 7; // Saturday-first
    const wdName = f.lang === "fa" ? WEEKDAY_NAMES_FA[wd] : (WEEKDAY_NAMES_EN[wd] ?? "");
    return `${wdName} ${f.dateLong(now)}`.trim();
  }, [f]);

  const budget = d?.budget ?? null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* ── Header (custom, tab root — no back) ── */}
      <header className="flex items-center gap-2 px-4 py-3 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-extrabold text-foreground leading-tight truncate">
            {f.t("dash.greeting", { name: firstName })}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{todayLabel}</p>
        </div>
        <button
          onClick={() => push("reminders")}
          aria-label="reminders"
          className="relative w-10 h-10 rounded-full bg-card card-soft flex items-center justify-center text-foreground"
        >
          <Bell className="w-5 h-5" />
          {reminderCount > 0 && (
            <span className="absolute top-1.5 end-1.5 w-2.5 h-2.5 rounded-full bg-expense border-2 border-card" />
          )}
        </button>
        <button
          onClick={() => setTab("settings")}
          aria-label="settings"
          className="w-10 h-10 rounded-full bg-card card-soft flex items-center justify-center text-foreground"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-4">
        {isLoading || !d ? (
          <>
            <div className="animate-pulse bg-secondary rounded-2xl h-20" />
            <div className="animate-pulse bg-secondary rounded-2xl h-28" />
            <div className="grid grid-cols-2 gap-3">
              <div className="animate-pulse bg-secondary rounded-2xl h-20" />
              <div className="animate-pulse bg-secondary rounded-2xl h-20" />
            </div>
            <div className="animate-pulse bg-secondary rounded-2xl h-40" />
            <div className="animate-pulse bg-secondary rounded-2xl h-44" />
          </>
        ) : (
          <>
            {/* ── Hero: total balance ── */}
            <div className="relative app-gradient text-white rounded-3xl p-5 overflow-hidden shrink-0">
              <div className="absolute -top-8 -start-8 w-28 h-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -end-6 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <button
                onClick={() => setShow((v) => !v)}
                aria-label="toggle balance"
                className="absolute top-4 end-4 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                {show ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <p className="text-white/80 text-[13px]">{f.t("dash.totalBalance")}</p>
              <p className="num-input text-[26px] font-extrabold mt-1 leading-snug" dir="ltr">
                {show ? f.money(d.totalBalance) : "•••••"}
              </p>
            </div>

            {/* ── Today stats ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-income-soft rounded-2xl p-4">
                <div className="flex items-center gap-1.5 text-income/80">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[12px]">{f.t("dash.todayIncome")}</span>
                </div>
                <p className="num-input text-income font-bold text-[16px] mt-2" dir="ltr">
                  {f.money(d.todayIncome)}
                </p>
              </div>
              <div className="bg-expense-soft rounded-2xl p-4">
                <div className="flex items-center gap-1.5 text-expense/80">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-[12px]">{f.t("dash.todayExpense")}</span>
                </div>
                <p className="num-input text-expense font-bold text-[16px] mt-2" dir="ltr">
                  {f.money(d.todayExpense)}
                </p>
              </div>
            </div>

            {/* ── Budget ── */}
            {budget && budget.total > 0 && (
              <button
                onClick={() => push("budget")}
                className="w-full text-start bg-card rounded-3xl p-4 card-soft flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[14px] text-foreground">
                    {f.t("dash.monthBudget")}
                  </span>
                  <span
                    className={cn(
                      "num-input text-[13px] font-extrabold",
                      budget.percent >= 100 ? "text-expense" : budget.percent >= 80 ? "text-warn" : "text-primary"
                    )}
                  >
                    {f.fa(budget.percent)}%
                  </span>
                </div>
                <ProgressBar value={budget.percent} />
                <p className="text-[11px] text-muted-foreground">
                  {f.t("dash.budgetUsed")}{" "}
                  <span className="num-input font-semibold" dir="ltr">
                    {f.money(budget.spent)} / {f.money(budget.total)}
                  </span>
                </p>
              </button>
            )}

            {/* ── Recent transactions ── */}
            <div className="bg-card rounded-3xl p-4 card-soft">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-[14px] text-foreground">{f.t("dash.recentTx")}</p>
                <button
                  onClick={() => setTab("transactions")}
                  className="text-primary text-[12px] font-bold"
                >
                  {f.t("dash.viewAll")}
                </button>
              </div>
              {d.recent.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-6">
                  {f.t("common.empty")}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {d.recent.map((tx) => (
                    <TxRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Upcoming payments ── */}
            <div className="bg-card rounded-3xl p-4 card-soft">
              <p className="font-bold text-[14px] text-foreground mb-1">{f.t("dash.upcoming")}</p>
              {d.upcoming.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-6">
                  {f.t("dash.noUpcoming")}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {d.upcoming.slice(0, 3).map((u) => (
                    <UpcomingRow key={`${u.kind}-${u.id}`} item={u} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Debts + Goals ── */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => push("debts")}
                className="text-start bg-card rounded-3xl p-4 card-soft flex flex-col gap-3"
              >
                <p className="font-bold text-[13px] text-foreground">{f.t("dash.debtsSummary")}</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{f.t("dash.owedToMe")}</span>
                    <span className="num-input text-[12px] font-bold text-income" dir="ltr">
                      {f.money(d.debts.owedToMe, false)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{f.t("dash.iOwe")}</span>
                    <span className="num-input text-[12px] font-bold text-expense" dir="ltr">
                      {f.money(d.debts.iOwe, false)}
                    </span>
                  </div>
                </div>
              </button>
              <button
                onClick={() => push("savings")}
                className="text-start bg-card rounded-3xl p-4 card-soft flex flex-col gap-3"
              >
                <p className="font-bold text-[13px] text-foreground">{f.t("dash.goals")}</p>
                {d.goals.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{f.t("common.empty")}</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {d.goals.slice(0, 2).map((g) => (
                      <div key={g.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-foreground truncate">{g.name}</span>
                          <span className="num-input text-[10px] text-muted-foreground">
                            {f.fa(g.percent)}%
                          </span>
                        </div>
                        <ProgressBar value={g.percent} fixedColor={g.color} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </div>

            {/* ── Prices (قیمت لحظه‌ای طلا، دلار و…) — فعلاً خالی ── */}
            <div className="bg-card rounded-3xl p-4 card-soft" aria-label={f.t("dash.prices")}>
              <p className="font-bold text-[14px] text-foreground mb-1">{f.t("dash.prices")}</p>
              {/* reserved empty area — live asset prices (gold, USD, …) will land here */}
              <div className="h-[190px]" aria-hidden="true" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
