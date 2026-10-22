"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  CircleDashed,
  Loader2,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  ProgressBar,
  ScreenHeader,
  JalaliDatePicker,
  useAppFormat,
} from "../ui";
import { useRecurring, useSetInstallmentPaid } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { startOfDay } from "@/lib/jalali";
import type { Frequency, RecurringDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

function frequencyLabel(freq: Frequency, f: ReturnType<typeof useAppFormat>): string {
  switch (freq) {
    case "DAILY":
      return f.t("rec.daily");
    case "WEEKLY":
      return f.t("rec.weekly");
    case "YEARLY":
      return f.t("rec.yearly");
    default:
      return f.t("rec.monthly");
  }
}

interface ScheduleRow {
  n: number;
  dueDate: Date;
  paid: boolean;
  paidAt: Date;
}

/** Full installment schedule computed from startDate + frequency + totalCount. */
function buildSchedule(item: RecurringDTO): ScheduleRow[] {
  const total = item.totalCount ?? 0;
  const rows: ScheduleRow[] = [];
  const start = new Date(item.startDate);
  const stepMs: Record<string, number> = {
    DAILY: 86_400_000,
    WEEKLY: 7 * 86_400_000,
    MONTHLY: 30 * 86_400_000,
    YEARLY: 365 * 86_400_000,
  };
  let cur = new Date(start);
  for (let n = 1; n <= total && n < 5000; n++) {
    rows.push({
      n,
      dueDate: new Date(cur),
      paid: !!item.paidMap[String(n)],
      paidAt: new Date(item.paidMap[String(n)] ?? cur),
    });
    // step forward (calendar-correct stepping via Date arithmetic)
    if (item.frequency === "MONTHLY") {
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, cur.getHours(), cur.getMinutes());
      // keep the day-of-month close to the original start day
      const day = Math.min(start.getDate(), new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate());
      cur.setDate(day);
    } else if (item.frequency === "YEARLY") {
      cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate(), cur.getHours(), cur.getMinutes());
    } else {
      cur = new Date(cur.getTime() + (stepMs[item.frequency] ?? 30 * 86_400_000));
    }
  }
  return rows;
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense" | "plain";
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      <span
        className={cn(
          "num-input text-[14px] font-extrabold",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense"
        )}
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}

export default function RecurringDetailsScreen({ params }: { params?: Record<string, unknown> }) {
  const p = params ?? {};
  const id = typeof p.id === "string" ? p.id : undefined;

  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const { data: items, isLoading } = useRecurring();
  const setPaid = useSetInstallmentPaid();

  const item = React.useMemo(() => items?.find((r) => r.id === id), [items, id]);
  const schedule = React.useMemo(() => (item ? buildSchedule(item) : []), [item]);

  const [editDateFor, setEditDateFor] = React.useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <ScreenHeader title="" onBack={back} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <ScreenHeader title={f.t("rec.title")} onBack={back} />
        <EmptyState icon={<ReceiptText className="w-7 h-7" />} title={f.t("rec.empty")} />
      </div>
    );
  }

  const total = item.totalCount ?? 0;
  const paidCount = item.paidCount;
  const percent = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const finished = total > 0 && paidCount >= total;
  const paidAmount = paidCount * item.amount;
  const remainingAmount = Math.max(0, (total - paidCount) * item.amount);

  const toggle = (row: ScheduleRow, paidAt?: Date) => {
    if (setPaid.isPending) return;
    setPaid.mutate(
      {
        id: item.id,
        n: row.n,
        paid: paidAt !== undefined ? true : !row.paid,
        paidAt: paidAt?.toISOString(),
      },
      {
        onSuccess: () => {
          setEditDateFor(null);
          if (paidAt === undefined) {
            toast.success(
              !row.paid
                ? f.t("rec.markPaid")
                : f.t("rec.markedUnpaid")
            );
          }
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={item.title} onBack={back} />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {/* ── summary card ── */}
        <div className="bg-card rounded-3xl card-soft p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground">{f.t("rec.perInstallment")}</span>
            <span className="num-input text-[16px] font-extrabold text-foreground" dir="ltr">
              {f.money(item.amount, false)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/60">
            <div className="flex flex-col gap-0.5 pt-2">
              <span className="text-[10.5px] text-muted-foreground">{f.t("rec.totalCount")}</span>
              <span className="num-input text-[13px] font-bold">{f.fa(total)}</span>
            </div>
            <div className="flex flex-col gap-0.5 pt-2">
              <span className="text-[10.5px] text-muted-foreground">{f.t("rec.frequency")}</span>
              <span className="text-[13px] font-bold">{frequencyLabel(item.frequency, f)}</span>
            </div>
            <div className="flex flex-col gap-0.5 pt-2">
              <span className="text-[10.5px] text-muted-foreground">{f.t("rec.startDate")}</span>
              <span className="text-[13px] font-bold">{f.dateShort(item.startDate)}</span>
            </div>
          </div>
        </div>

        {/* ── payment status (آمار پرداخت) ── */}
        <div className="bg-card rounded-3xl card-soft p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-[14px] text-foreground">{f.t("rec.payStatus")}</p>
            <span
              className={cn(
                "num-input text-[13px] font-extrabold",
                finished ? "text-income" : percent >= 80 ? "text-warn" : "text-primary"
              )}
            >
              {f.fa(percent)}%
            </span>
          </div>
          <ProgressBar value={percent} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-muted-foreground">
              {f.t("rec.paidCount")}: {f.t("rec.remainingOf", { paid: f.fa(paidCount), total: f.fa(total) })}
            </span>
            {finished && (
              <span className="rounded-full bg-income-soft text-income px-2.5 py-0.5 text-[11px] font-bold">
                {f.t("rec.finished")}
              </span>
            )}
          </div>
          <div className="flex gap-3 pt-1 border-t border-border/60">
            <StatBox label={f.t("rec.paidAmount")} value={f.money(paidAmount, false)} tone="income" />
            <StatBox label={f.t("rec.remainingAmount")} value={f.money(remainingAmount, false)} tone="expense" />
          </div>
          {!finished && item.nextDue && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
              {f.t("rec.nextDue")}:{" "}
              <span className="font-bold text-foreground">{f.dateLong(item.nextDue)}</span>
            </div>
          )}
        </div>

        {/* ── installment schedule ── */}
        <div className="bg-card rounded-3xl card-soft p-4 flex flex-col gap-1">
          <p className="font-bold text-[14px] text-foreground mb-1">{f.t("rec.schedule")}</p>
          <div className="flex flex-col divide-y divide-border/50 max-h-96 overflow-y-auto app-screen-scroll">
            {schedule.map((row) => (
              <div key={row.n} className="py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-xl shrink-0",
                      row.paid ? "bg-income-soft text-income" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {row.paid ? <Check className="w-4 h-4" /> : <CircleDashed className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground">
                      {f.t("rec.installmentN", { n: f.fa(row.n) })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.t("rec.dueDate")}: {f.dateShort(row.dueDate)}
                      {row.paid && (
                        <span className="text-income font-semibold">
                          {" "}
                          • {f.t("rec.paidAt")}: {f.dateShort(row.paidAt)}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="num-input text-[13px] font-bold text-foreground shrink-0" dir="ltr">
                    {f.money(item.amount, false)}
                  </span>
                  {/* the tick */}
                  <button
                    type="button"
                    disabled={setPaid.isPending}
                    aria-label={
                      row.paid
                        ? f.t("rec.markedUnpaid")
                        : f.t("rec.installmentN", { n: f.fa(row.n) })
                    }
                    aria-pressed={row.paid}
                    onClick={() => toggle(row)}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-50",
                      row.paid
                        ? "bg-income text-white shadow-sm"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                    )}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
                {/* optional payment date editor (paid rows only) */}
                {row.paid && editDateFor === row.n && (
                  <div className="ps-11 flex items-center gap-2">
                    <JalaliDatePicker
                      className="h-9 rounded-xl text-[12px]"
                      value={row.paidAt}
                      onChange={(d) => toggle(row, startOfDay(d))}
                    />
                  </div>
                )}
                {row.paid && editDateFor !== row.n && (
                  <button
                    type="button"
                    onClick={() => setEditDateFor(row.n)}
                    className="ps-11 self-start text-[11px] text-primary font-semibold hover:underline"
                  >
                    {f.t("rec.paidAtOptional")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" />
          {f.t("rec.noAccountingHint")}
        </p>
      </div>
    </div>
  );
}
