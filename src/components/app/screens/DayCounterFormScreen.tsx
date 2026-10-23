"use client";

import * as React from "react";
import { BellRing, CalendarClock, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import {
  ColorDots,
  ConfirmDialog,
  Field,
  GradientButton,
  JalaliDatePicker,
  PillInput,
  ScreenHeader,
  useAppFormat,
} from "../ui";
import { Switch } from "@/components/ui/switch";
import {
  useDayCounters,
  useDeleteDayCounter,
  useSaveDayCounter,
} from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { requestAlarmPermission } from "@/lib/day-counter";
import { startOfDay, toEnDigits } from "@/lib/jalali";
import type { DayCounterDesign } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CounterDisplay } from "./DayCounterWidgets";

const DC_COLORS = ["#4E9B72", "#5E9EA0", "#8F6BC4", "#E5B84E", "#E5757A", "#C08052", "#D97BA6", "#5E7A9E"];

const DESIGNS: { value: DayCounterDesign; labelKey: string }[] = [
  { value: "RING", labelKey: "dc.designRing" },
  { value: "FLIP", labelKey: "dc.designFlip" },
  { value: "BAR", labelKey: "dc.designBar" },
];

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function DayCounterFormScreen({ params }: { params?: Record<string, unknown> }) {
  const p = params ?? {};
  const id = typeof p.id === "string" ? p.id : undefined;

  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const { data } = useDayCounters();
  const saveCounter = useSaveDayCounter();
  const deleteCounter = useDeleteDayCounter();

  const existing = React.useMemo(
    () => (id ? data?.find((c) => c.id === id) : undefined),
    [data, id]
  );

  const [title, setTitle] = React.useState("");
  const [startDate, setStartDate] = React.useState<Date>(new Date());
  const [endDate, setEndDate] = React.useState<Date>(() => addDays(new Date(), 30));
  const [design, setDesign] = React.useState<DayCounterDesign>("RING");
  const [color, setColor] = React.useState("#4E9B72");
  const [alarmEnabled, setAlarmEnabled] = React.useState(false);
  const [alarmDays, setAlarmDays] = React.useState("3");
  const [alarmSound, setAlarmSound] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setStartDate(new Date(existing.startDate));
    setEndDate(new Date(existing.endDate));
    setDesign(existing.design);
    setColor(existing.color);
    setAlarmEnabled(existing.alarmEnabled);
    setAlarmDays(String(existing.alarmDays));
    setAlarmSound(existing.alarmSound);
  }, [existing]);

  const toggleAlarm = (v: boolean) => {
    setAlarmEnabled(v);
    if (v) requestAlarmPermission();
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error(f.t("common.required"));
      return;
    }
    if (startOfDay(endDate).getTime() < startOfDay(startDate).getTime()) {
      toast.error(f.t("dc.errorEndBeforeStart"));
      return;
    }
    let threshold: number | undefined;
    if (alarmEnabled) {
      const n = parseInt(toEnDigits(alarmDays).replace(/[^\d]/g, ""), 10);
      if (!n || n < 1 || n > 999) {
        toast.error(f.t("dc.alarmThresholdHint"));
        return;
      }
      threshold = n;
    }
    saveCounter.mutate(
      {
        id,
        title: title.trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        design,
        color,
        alarmEnabled,
        alarmDays: threshold ?? (id ? undefined : 3),
        alarmSound,
      },
      {
        onSuccess: () => {
          toast.success(f.t("common.saved"));
          back();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={id ? f.t("dc.editTitle") : f.t("dc.addTitle")} onBack={back} />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {/* title */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <Field label={f.t("dc.name")} required>
            <PillInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={f.t("dc.namePlaceholder")}
            />
          </Field>
        </div>

        {/* dates */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <Field label={f.t("dc.startDate")}>
            <JalaliDatePicker value={startDate} onChange={setStartDate} />
          </Field>
          <Field label={f.t("dc.endDate")}>
            <JalaliDatePicker value={endDate} onChange={setEndDate} />
          </Field>
        </div>

        {/* live preview + design picker */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <p className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-primary" />
            {f.t("dc.design")}
          </p>
          <div className="flex flex-col gap-2">
            {DESIGNS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDesign(d.value)}
                aria-pressed={design === d.value}
                className={cn(
                  "rounded-2xl border-2 p-3 text-start transition-all active:scale-[0.99]",
                  design === d.value
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-transparent bg-secondary/50 hover:border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <CounterDisplay
                      startIso={startDate.toISOString()}
                      endIso={endDate.toISOString()}
                      design={d.value}
                      color={color}
                      size="sm"
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "mt-2 block text-[12px] font-bold text-center",
                    design === d.value ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {f.t(d.labelKey)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{f.t("dc.designHint")}</p>
        </div>

        {/* color */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <p className="text-[13px] font-bold text-foreground">{f.t("dc.color")}</p>
          <ColorDots colors={DC_COLORS} value={color} onChange={setColor} />
        </div>

        {/* alarm settings */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-primary" />
              {f.t("dc.alarm")}
            </p>
            <Switch checked={alarmEnabled} onCheckedChange={toggleAlarm} aria-label={f.t("dc.alarm")} />
          </div>
          <p className="text-[11px] text-muted-foreground">{f.t("dc.alarmHint")}</p>

          {alarmEnabled && (
            <>
              <Field label={f.t("dc.alarmThreshold")}>
                <PillInput
                  inputMode="numeric"
                  className="num-input text-center"
                  value={alarmDays}
                  onChange={(e) => setAlarmDays(toEnDigits(e.target.value).replace(/[^\d]/g, ""))}
                  placeholder="3"
                />
              </Field>
              <p className="text-[11px] text-muted-foreground">{f.t("dc.alarmThresholdHint")}</p>

              <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3.5 py-3">
                <span className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-primary" />
                  {f.t("dc.alarmSound")}
                </span>
                <Switch
                  checked={alarmSound}
                  onCheckedChange={setAlarmSound}
                  aria-label={f.t("dc.alarmSound")}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{f.t("dc.alarmSoundHint")}</p>
            </>
          )}
        </div>

        <GradientButton onClick={submit} disabled={saveCounter.isPending} className="mt-1">
          {f.t("common.save")}
        </GradientButton>

        {id && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-1 h-12 rounded-2xl bg-expense-soft text-expense text-[14px] font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
            {f.t("common.delete")}
          </button>
        )}
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
