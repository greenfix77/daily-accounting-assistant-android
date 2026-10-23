"use client";

import * as React from "react";
import {
  Bell,
  Coins,
  HandCoins,
  PieChart,
  Repeat,
  Tags,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ScreenHeader, useAppFormat } from "@/components/app/ui";
import { useAppStore, type ScreenId } from "@/lib/store";
import { cn } from "@/lib/utils";

interface PlanModule {
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
  color: string;
  screen: ScreenId;
  wide?: boolean;
}

const MODULES: PlanModule[] = [
  { titleKey: "plan.accounts", descKey: "plan.accountsDesc", icon: Wallet, color: "#4E9B72", screen: "accounts" },
  { titleKey: "plan.categories", descKey: "plan.categoriesDesc", icon: Tags, color: "#F0A868", screen: "categories" },
  { titleKey: "plan.budget", descKey: "plan.budgetDesc", icon: PieChart, color: "#A78BCA", screen: "budget" },
  { titleKey: "plan.debts", descKey: "plan.debtsDesc", icon: HandCoins, color: "#E5757A", screen: "debts" },
  { titleKey: "plan.recurring", descKey: "plan.recurringDesc", icon: Repeat, color: "#5E9EA0", screen: "recurring" },
  { titleKey: "plan.wallet", descKey: "plan.walletDesc", icon: Coins, color: "#C08052", screen: "wallet" },
  { titleKey: "plan.savings", descKey: "plan.savingsDesc", icon: Target, color: "#E5B84E", screen: "savings" },
  { titleKey: "plan.reminders", descKey: "plan.remindersDesc", icon: Bell, color: "#D97BA6", screen: "reminders", wide: true },
];

export default function PlanningScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={f.t("plan.title")} />
      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        <p className="text-[12px] text-muted-foreground px-1">{f.t("plan.desc")}</p>
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map((m) => (
            <button
              key={m.titleKey}
              type="button"
              onClick={() => push(m.screen)}
              className={cn(
                "bg-card rounded-3xl p-4 card-soft flex flex-col gap-2.5 text-right cursor-pointer",
                "hover:-translate-y-0.5 transition-transform active:scale-[0.98]",
                m.wide && "col-span-2"
              )}
            >
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${m.color}1f`, color: m.color }}
              >
                <m.icon className="w-5 h-5" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[14px] font-bold text-foreground">{f.t(m.titleKey)}</span>
                <span className="text-[11px] text-muted-foreground leading-4">{f.t(m.descKey)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
