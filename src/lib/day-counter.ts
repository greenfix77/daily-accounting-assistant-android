// ─────────────────────────────────────────────────────────────
// روز شمار (Day Counter) — pure computation helpers + alarm
// effects (beep sound / browser notification). The counter value
// is always derived from the device date, so it automatically
// decrements as days pass (re-render is scheduled at midnight).
// ─────────────────────────────────────────────────────────────

import type { DayCounterAlarmLevel, DayCounterStatus } from "./types";

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export interface DayCounterComputed {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  percent: number;
  status: DayCounterStatus;
  alarmLevel: DayCounterAlarmLevel;
}

/**
 * Computes the live counter values for a [startDate → endDate] range.
 * `now` defaults to the device clock (call sites re-render at midnight
 * so the number drops automatically each day).
 */
export function computeDayCounter(
  startIso: string,
  endIso: string,
  now: Date = new Date(),
  alarmEnabled = false,
  alarmDays = 0
): DayCounterComputed {
  const start = startOfDay(new Date(startIso));
  const end = startOfDay(new Date(endIso));
  const today = startOfDay(now);

  const totalDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const remainingDays = Math.round((end.getTime() - today.getTime()) / DAY_MS);
  const elapsedRaw = Math.round((today.getTime() - start.getTime()) / DAY_MS);

  const status: DayCounterStatus =
    remainingDays <= 0 ? "FINISHED" : elapsedRaw < 0 ? "NOT_STARTED" : "ACTIVE";

  const elapsedDays = Math.min(totalDays, Math.max(0, elapsedRaw));
  const percent =
    totalDays > 0
      ? Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))
      : remainingDays <= 0
        ? 100
        : 0;

  let alarmLevel: DayCounterAlarmLevel = "NONE";
  if (alarmEnabled) {
    if (remainingDays < 0) alarmLevel = "OVER";
    else if (remainingDays === 0) alarmLevel = "TODAY";
    else if (remainingDays <= alarmDays) alarmLevel = "NEAR";
  }

  return { totalDays, elapsedDays, remainingDays, percent, status, alarmLevel };
}

/** ms until the next local midnight (min 1s) — used to auto-decrement at day change. */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

// ── Alarm effects ───────────────────────────────────────────

/** Short attention beep (3 pulses) via Web Audio — safe no-op when unavailable. */
export function playAlarmBeep(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.2);
    };
    beep(0);
    beep(0.26);
    beep(0.52);
    setTimeout(() => void ctx.close().catch(() => {}), 1200);
  } catch {
    // ignore — sound is best-effort
  }
}

/** Fire a system notification when permission is granted (no-op otherwise). */
export function fireDayCounterNotification(title: string, body: string): void {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, silent: false });
    }
  } catch {
    // ignore — notification is best-effort
  }
}

/** Ask for notification permission (call when user enables the alarm). */
export function requestAlarmPermission(): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    // ignore
  }
}
