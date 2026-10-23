"use client";

import * as React from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  ChevronLeft,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, EmptyState, IconBubble, ProgressBar, ScreenHeader, useAppFormat } from "../ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteDayCounter, useDayCounters } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { fireDayCounterNotification, playAlarmBeep } from "@/lib/day-counter";
import type { DayCounterDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMidnightNow } from "./DayCounterWidgets";
import { computeDayCounter } from "@/lib/day-counter";

// ── Alarm banner ─────────────────────────────────────────────
function AlarmBanner({ ctr }: { ctr: DayCounterDTO }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const today = ctr.alarmLevel === "TODAY";
  const over = ctr.alarmLevel === "OVER";
  return (
    <button
      type="button"
      onClick={() => push("dc-details", { id: ctr.id })}
      className={cn(
        "w-full rounded-2xl p-3.5 flex flex-col gap-2 text-start cursor-pointer transition-transform active:scale-[0.99]",
        over || today ? "bg-expense-soft" : "bg-[#F0A8681f]"
      )}
    >
      <div className="flex items-center gap-2">
        {over || today ? (
          <TriangleAlert className="w-[18px] h-[18px] text-expense shrink-0" />
        ) : (
          <AlertTriangle className="w-[18px] h-[18px] text-[#C77F35] shrink-0" />
        )}
        <span
          className={cn(
            "text-[13px] font-bold",
            over || today ? "text-expense" : "text-[#C77F35]"
          )}
        >
          {over
            ? f.t("dc.alarmOver")
            : today
              ? f.t("dc.alarmToday")
              : f.t("dc.alarmNear")}
        </span>
        <span className="text-[12px] font-bold text-foreground truncate">• {ctr.title}</span>
      </div>
      <ProgressBar value={ctr.percent} fixedColor={over || today ? "#E5757A" : "#F0A868"} />
      <p className="text-[11px] text-muted-foreground">
        {f.t("dc.daysLeftOf", { n: f.fa(Math.max(0, ctr.remainingDays)), v: ctr.title })} (
        {f.fa(ctr.percent)}٪ {f.t("dc.percentPassed")})
      </p>
    </button>
  );
}

// ── Counter row ──────────────────────────────────────────────
function CounterRow({
  item,
  onEdit,
  onDelete,
}: {
  item: DayCounterDTO;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const now = useMidnightNow();
  const c = React.useMemo(
    () => computeDayCounter(item.startDate, item.endDate, now),
    [item.startDate, item.endDate, now]
  );
  const remaining = Math.max(0, c.remainingDays);
  const finished = c.remainingDays < 0;

  return (
    <div className="bg-card rounded-2xl card-soft p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={() => push("dc-details", { id: item.id })}
        aria-label={item.title}
        className="flex-1 min-w-0 flex items-center gap-3 text-start cursor-pointer"
      >
        <IconBubble icon="calendar-clock" color={item.color} />

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <span className="font-bold text-[14px] text-foreground truncate">{item.title}</span>
          <p className="text-[11px] text-muted-foreground truncate">
            {f.t("dc.infoEnd")}: {f.dateShort(item.endDate)}
            {item.alarmEnabled && (
              <span className="inline-flex items-center gap-1 ms-1.5 text-primary">
                • <BellRing className="w-3 h-3" />
                {f.fa(item.alarmDays)} {f.t("dc.daysUnit")}
              </span>
            )}
          </p>
          <ProgressBar value={c.percent} className="h-1.5" fixedColor={item.color} />
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span
            className={cn(
              "num-input text-[22px] font-extrabold leading-none",
              finished || c.remainingDays === 0 ? "text-expense" : "text-foreground"
            )}
            dir="ltr"
          >
            {f.fa(remaining)}
          </span>
          <span className="text-[10px] text-muted-foreground">{f.t("dc.daysUnit")}</span>
          <ChevronLeft className="w-4 h-4 text-muted-foreground rtl:rotate-0 ltr:rotate-180 mt-0.5" />
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="more"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl bg-card w-44">
          <DropdownMenuItem onClick={onEdit} className="text-[13px] gap-2">
            <Pencil className="w-3.5 h-3.5" />
            {f.t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-[13px] gap-2 text-expense focus:text-expense"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {f.t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function DayCounterScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const push = useAppStore((s) => s.push);
  const { data, isLoading } = useDayCounters();
  const deleteCounter = useDeleteDayCounter();

  const [deleteTarget, setDeleteTarget] = React.useState<DayCounterDTO | null>(null);
  const firedRef = React.useRef<Set<string>>(new Set());

  const counters = React.useMemo(() => {
    const now = new Date();
    return (data ?? [])
      .map((ctr) => ({ ctr, c: computeDayCounter(ctr.startDate, ctr.endDate, now, ctr.alarmEnabled, ctr.alarmDays) }))
      .sort((a, b) => a.c.remainingDays - b.c.remainingDays);
  }, [data]);

  const alerts = counters.filter(({ ctr, c }) => ctr.alarmEnabled && c.alarmLevel !== "NONE");
  const nextEnding = counters.find(({ c }) => c.remainingDays > 0);

  // fire alarm effects (sound + notification) once per session per state change
  React.useEffect(() => {
    for (const { ctr } of alerts) {
      const key = `${ctr.id}:${ctr.remainingDays}`;
      if (firedRef.current.has(key)) continue;
      firedRef.current.add(key);
      if (ctr.alarmSound) playAlarmBeep();
      const title =
        ctr.alarmLevel === "OVER"
          ? f.t("dc.alarmOver")
          : ctr.alarmLevel === "TODAY"
            ? f.t("dc.alarmToday")
            : f.t("dc.alarmNear");
      const body =
        ctr.alarmLevel === "NEAR"
          ? f.t("dc.daysLeftOf", { n: f.fa(ctr.remainingDays), v: ctr.title })
          : `${ctr.title} — ${f.t("dc.percentPassed")}: ${f.fa(ctr.percent)}٪`;
      fireDayCounterNotification(title, body);
    }
  }, [alerts, f]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteCounter.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(f.t("common.deleted"));
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader
        title={f.t("dc.title")}
        onBack={back}
        right={
          <button
            onClick={() => push("dc-form", {})}
            aria-label="add day counter"
            className="w-9 h-9 rounded-full app-gradient text-white flex items-center justify-center shadow-md shadow-primary/25 shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-center text-[13px] text-muted-foreground py-10">{f.t("common.loading")}</p>
        ) : counters.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="w-7 h-7" />}
            title={f.t("dc.empty")}
            desc={f.t("dc.emptyDesc")}
          />
        ) : (
          <>
            {/* ── hero stats ── */}
            <div className="app-gradient rounded-3xl p-5 text-white shadow-md shadow-primary/20 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] opacity-90">{f.t("dc.countersCount")}</span>
                <span className="num-input text-[26px] font-extrabold" dir="ltr">
                  {f.fa(counters.length)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[12px] opacity-90">{f.t("dc.nextEnding")}</span>
                {nextEnding ? (
                  <>
                    <span className="text-[13px] font-bold truncate max-w-[160px]">
                      {nextEnding.ctr.title}
                    </span>
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                      {f.fa(nextEnding.c.remainingDays)} {f.t("dc.daysUnit")}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] opacity-80">—</span>
                )}
              </div>
            </div>

            {/* ── alerts ── */}
            {alerts.length > 0 && (
              <section className="flex flex-col gap-2" aria-label={f.t("dc.alarm")}>
                <h2 className="text-[13px] font-bold text-foreground px-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-warn" />
                  {f.t("dc.alarm")}
                </h2>
                {alerts.map(({ ctr }) => (
                  <AlarmBanner key={ctr.id} ctr={ctr} />
                ))}
              </section>
            )}

            {/* ── counters list ── */}
            <section className="flex flex-col gap-2" aria-label={f.t("dc.title")}>
              {counters.map(({ ctr }) => (
                <CounterRow
                  key={ctr.id}
                  item={ctr}
                  onEdit={() => push("dc-form", { id: ctr.id })}
                  onDelete={() => setDeleteTarget(ctr)}
                />
              ))}
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={f.t("dc.deleteConfirm")}
      />
    </div>
  );
}
