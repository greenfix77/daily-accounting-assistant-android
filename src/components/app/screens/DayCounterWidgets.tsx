"use client";

import * as React from "react";
import { ProgressBar, ProgressRing, useAppFormat } from "../ui";
import { computeDayCounter, msUntilMidnight } from "@/lib/day-counter";
import { cn } from "@/lib/utils";
import type { DayCounterComputed } from "@/lib/day-counter";
import type { DayCounterDesign } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Live day-counter widgets.
// The value is always derived from the device clock, and the tree
// re-renders at every local midnight (plus on regaining focus), so
// the counter automatically drops by one each passing day.
// ─────────────────────────────────────────────────────────────

/** Ticks at every local midnight + whenever the app becomes visible again. */
export function useMidnightNow(): Date {
  const [now, setNow] = React.useState<Date>(() => new Date());
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilMidnight(new Date()));
    };
    schedule();
    const onVis = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return now;
}

/** Shared stat row: elapsed • percent • total */
function StatRow({ c, compact }: { c: DayCounterComputed; compact?: boolean }) {
  const f = useAppFormat();
  return (
    <div
      className={cn(
        "flex items-center justify-between w-full rounded-xl bg-secondary/60 text-muted-foreground",
        compact ? "text-[10.5px] px-2.5 py-1.5" : "text-[12px] px-3 py-2"
      )}
    >
      <span>
        {f.t("dc.elapsedDays")}: <b className="text-foreground">{f.fa(c.elapsedDays)}</b>
      </span>
      <span>
        {f.t("dc.percentPassed")}: <b className="text-foreground">{f.fa(c.percent)}٪</b>
      </span>
      <span>
        {f.t("dc.totalDays")}: <b className="text-foreground">{f.fa(c.totalDays)}</b>
      </span>
    </div>
  );
}

/** Flip-clock digit tile */
function FlipDigits({ value, small }: { value: number; small?: boolean }) {
  const f = useAppFormat();
  const s = String(Math.max(0, value)).padStart(2, "0");
  return (
    <div className="flex items-center gap-1.5" dir="ltr">
      {s.split("").map((d, i) => (
        <span
          key={i}
          className={cn(
            "relative rounded-xl overflow-hidden flex items-center justify-center text-white font-extrabold num-input",
            small ? "w-7 h-9 text-[19px]" : "w-12 h-16 text-[34px]"
          )}
          style={{
            background: "linear-gradient(180deg,#2B3040 0%,#171B27 100%)",
            boxShadow: "inset 0 -2px 5px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.12)",
          }}
        >
          <span className="absolute top-1/2 left-0 right-0 h-px bg-black/50" />
          <span className="relative z-10">{f.fa(d)}</span>
        </span>
      ))}
    </div>
  );
}

export interface CounterDisplayProps {
  startIso: string;
  endIso: string;
  design: DayCounterDesign;
  color: string;
  size?: "lg" | "sm";
  className?: string;
}

/** The live counter — three user-selectable designs (RING / FLIP / BAR). */
export function CounterDisplay({
  startIso,
  endIso,
  design,
  color,
  size = "lg",
  className,
}: CounterDisplayProps) {
  const f = useAppFormat();
  const now = useMidnightNow();
  const c = React.useMemo(
    () => computeDayCounter(startIso, endIso, now),
    [startIso, endIso, now]
  );
  const remaining = Math.max(0, c.remainingDays);
  const statusLabel =
    c.remainingDays === 0
      ? f.t("dc.todayIsEnd")
      : c.status === "FINISHED"
        ? f.t("dc.statusFinished")
        : c.status === "NOT_STARTED"
          ? f.t("dc.statusNotStarted")
          : f.t("dc.remainingDays");

  const chip = (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[11.5px] font-bold",
        c.status === "FINISHED" || c.remainingDays === 0
          ? "bg-expense-soft text-expense"
          : "bg-secondary text-foreground"
      )}
    >
      {statusLabel}
    </span>
  );

  if (design === "RING") {
    return (
      <div className={cn("flex flex-col items-center gap-3 w-full", className)}>
        <ProgressRing
          percent={c.percent}
          size={size === "lg" ? 188 : 132}
          stroke={size === "lg" ? 12 : 9}
          color={color}
        >
          <span
            className={cn(
              "num-input font-extrabold leading-none",
              size === "lg" ? "text-[46px]" : "text-[30px]"
            )}
            style={{ color }}
          >
            {f.fa(remaining)}
          </span>
          <span className={cn("text-muted-foreground", size === "lg" ? "text-[12px]" : "text-[10px]")}>
            {f.t("dc.daysUnit")}
          </span>
        </ProgressRing>
        {chip}
        <StatRow c={c} compact={size === "sm"} />
      </div>
    );
  }

  if (design === "FLIP") {
    return (
      <div className={cn("flex flex-col items-center gap-3 w-full", className)}>
        <FlipDigits value={remaining} small={size === "sm"} />
        {chip}
        <ProgressBar
          value={c.percent}
          className={size === "lg" ? "h-2" : "h-1.5"}
          fixedColor={color}
        />
        <StatRow c={c} compact={size === "sm"} />
      </div>
    );
  }

  // BAR — big number + progress bar
  return (
    <div className={cn("flex flex-col items-center gap-2 w-full", className)}>
      <span
        className={cn("num-input font-extrabold leading-none", size === "lg" ? "text-[64px]" : "text-[40px]")}
        style={{ color }}
      >
        {f.fa(remaining)}
      </span>
      {chip}
      <ProgressBar
        value={c.percent}
        className={cn("w-full", size === "lg" ? "h-2.5" : "h-1.5")}
        fixedColor={color}
      />
      <StatRow c={c} compact={size === "sm"} />
    </div>
  );
}
