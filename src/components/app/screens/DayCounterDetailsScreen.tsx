"use client";

import * as React from "react";
import {
  BellOff,
  BellRing,
  CalendarClock,
  MoreVertical,
  Pencil,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ScreenHeader, useAppFormat } from "../ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDayCounters, useDeleteDayCounter } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import type { DayCounterDTO } from "@/lib/types";
import { CounterDisplay } from "./DayCounterWidgets";

function InfoRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className={strong ? "text-[13.5px] font-bold text-foreground" : "text-[13px] text-foreground"}>
        {value}
      </span>
    </div>
  );
}

export default function DayCounterDetailsScreen({ params }: { params?: Record<string, unknown> }) {
  const p = params ?? {};
  const id = typeof p.id === "string" ? p.id : undefined;

  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const push = useAppStore((s) => s.push);
  const { data, isLoading } = useDayCounters();
  const deleteCounter = useDeleteDayCounter();

  const ctr: DayCounterDTO | undefined = React.useMemo(
    () => (id ? data?.find((c) => c.id === id) : undefined),
    [data, id]
  );

  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const confirmDeleteFn = () => {
    if (!id) return;
    deleteCounter.mutate(id, {
      onSuccess: () => {
        toast.success(f.t("common.deleted"));
        back();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  if (isLoading || !ctr) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <ScreenHeader title={f.t("dc.title")} onBack={back} />
        <p className="text-center text-[13px] text-muted-foreground py-10">
          {isLoading ? f.t("common.loading") : f.t("dc.empty")}
        </p>
      </div>
    );
  }

  const designLabel =
    ctr.design === "FLIP"
      ? f.t("dc.designFlip")
      : ctr.design === "BAR"
        ? f.t("dc.designBar")
        : f.t("dc.designRing");

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader
        title={ctr.title}
        onBack={back}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="more"
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl bg-card w-44">
              <DropdownMenuItem
                onClick={() => push("dc-form", { id: ctr.id })}
                className="text-[13px] gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                {f.t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-[13px] gap-2 text-expense focus:text-expense"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {f.t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {/* live counter */}
        <section className="flex flex-col gap-2" aria-label={f.t("dc.liveCounter")}>
          <h2 className="text-[13px] font-bold text-foreground px-1 flex items-center gap-1.5">
            <Timer className="w-4 h-4" style={{ color: ctr.color }} />
            {f.t("dc.liveCounter")}
          </h2>
          <div className="bg-card rounded-3xl card-soft p-5">
            <CounterDisplay
              startIso={ctr.startDate}
              endIso={ctr.endDate}
              design={ctr.design}
              color={ctr.color}
              size="lg"
            />
          </div>
        </section>

        {/* info */}
        <section className="flex flex-col gap-2" aria-label={f.t("dc.infoStart")}>
          <h2 className="text-[13px] font-bold text-foreground px-1 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-primary" />
            {f.t("dc.title")}
          </h2>
          <div className="bg-card rounded-2xl card-soft px-4 py-1 divide-y divide-border/50">
            <InfoRow label={f.t("dc.infoStart")} value={f.dateLong(ctr.startDate)} />
            <InfoRow label={f.t("dc.infoEnd")} value={f.dateLong(ctr.endDate)} />
            <InfoRow
              label={f.t("dc.infoTotal")}
              value={`${f.fa(ctr.totalDays)} ${f.t("dc.daysUnit")}`}
            />
            <InfoRow
              label={f.t("dc.infoElapsed")}
              value={`${f.fa(Math.max(0, ctr.elapsedDays))} ${f.t("dc.daysUnit")}`}
            />
            <InfoRow
              label={f.t("dc.infoRemaining")}
              value={
                <span className={ctr.remainingDays <= 0 ? "text-expense" : undefined}>
                  {f.fa(Math.max(0, ctr.remainingDays))} {f.t("dc.daysUnit")}
                </span>
              }
              strong
            />
            <InfoRow
              label={f.t("dc.infoPercent")}
              value={`${f.fa(ctr.percent)}٪`}
            />
            <InfoRow label={f.t("dc.infoDesign")} value={designLabel} />
          </div>
        </section>

        {/* alarm status */}
        <section className="flex flex-col gap-2" aria-label={f.t("dc.alarmSettings")}>
          <h2 className="text-[13px] font-bold text-foreground px-1">{f.t("dc.alarmSettings")}</h2>
          <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              {ctr.alarmEnabled ? (
                <BellRing className="w-4.5 h-4.5 w-[18px] h-[18px] text-primary shrink-0" />
              ) : (
                <BellOff className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
              )}
              <span className="text-[13px] font-bold text-foreground">
                {ctr.alarmEnabled ? f.t("dc.alarmActive") : f.t("dc.alarmOff")}
              </span>
              {ctr.alarmEnabled && (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-foreground ms-auto">
                  {f.t("dc.alarmThreshold")}: {f.fa(ctr.alarmDays)} {f.t("dc.daysUnit")}
                </span>
              )}
            </div>
            {ctr.alarmEnabled && (
              <p className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
                {ctr.alarmSound ? (
                  <Volume2 className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                {f.t("dc.alarmSound")}:{" "}
                <span className="font-bold">{ctr.alarmSound ? "✓" : "—"}</span>
              </p>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={confirmDeleteFn}
        title={f.t("dc.deleteConfirm")}
      />
    </div>
  );
}
