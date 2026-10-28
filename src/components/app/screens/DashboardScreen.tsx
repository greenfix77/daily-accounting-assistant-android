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
  CalendarClock,
  Wallet,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useAppFormat,
  AmountText,
  IconBubble,
  ProgressBar,
} from "@/components/app/ui";
import { useDashboard, useSettings, useReminders, useRecurring, useDayCounters, useUpdateSettings, useWalletsOverview } from "@/lib/hooks";
import { CounterDisplay } from "@/components/app/screens/DayCounterWidgets";
import {
  parseHomeWidgets,
  serializeHomeWidgets,
  type HomeWidgetId,
} from "@/lib/home-widgets";
import { useAppStore } from "@/lib/store";
import { WEEKDAY_NAMES_FA, WEEKDAY_NAMES_EN } from "@/lib/jalali";
import type { TransactionDTO, ReminderDTO, RecurringDTO } from "@/lib/types";
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
      <span className="flex flex-col items-end gap-0.5 shrink-0">
        <AmountText value={tx.amount} type={tx.type} className="text-[13px]" withUnit={false} />
        {tx.balanceAfter != null && (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {f.t("common.balanceAfter")}:
            <span className="num-input" dir="ltr">
              {" "}
              {f.money(tx.balanceAfter, false)}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

// ── Installment row (ویجت اقساط) ─────────────────────────
function InstallmentRow({ r }: { r: RecurringDTO }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const due = r.nextDue!;
  const dl = Math.round(
    (new Date(due).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  const urgent = dl < 3;
  return (
    <button
      onClick={() => push("recurring")}
      className="w-full flex items-center gap-3 py-2.5 text-start hover:bg-secondary/40 rounded-xl px-1 transition-colors"
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "#5E9EA01f", color: "#5E9EA0" }}
      >
        <Repeat className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{r.title}</p>
        <p className={cn("text-[11px]", urgent ? "text-expense font-semibold" : "text-muted-foreground")}>
          {f.dateShort(due)}
          {dl >= 0 ? ` • ${f.daysLabel(due)}` : ""}
          {r.totalCount ? ` • ${f.t("rec.installmentOf", { x: f.fa(r.paidCount + 1), y: f.fa(r.totalCount) })}` : ""}
        </p>
      </div>
      <span className="num-input text-[12px] font-bold text-foreground shrink-0">
        {f.money(r.amount, false)}
      </span>
    </button>
  );
}

// ── Reminder row (ویجت یادآوری‌ها) ─────────────────────────
function ReminderRow({ r }: { r: ReminderDTO }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const urgent = r.daysLeft < 3;
  return (
    <button
      onClick={() => push("reminders")}
      className="w-full flex items-center gap-3 py-2.5 text-start hover:bg-secondary/40 rounded-xl px-1 transition-colors"
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: "#E5757A1f", color: "#E5757A" }}
      >
        <Bell className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{r.title}</p>
        <p className={cn("text-[11px]", urgent ? "text-expense font-semibold" : "text-muted-foreground")}>
          {f.dateShort(r.date)}
          {r.daysLeft >= 0 ? ` • ${f.daysLabel(r.date)}` : ""}
        </p>
      </div>
    </button>
  );
}

// ── سنسور موس: فقط pointerType «mouse» — روی لمس، TouchSensor مالک ژست است.
// اگر PointerSensor روی لمس فعال شود، WebView به‌محض حرکت انگشت ژست را برای
// اسکرول می‌گیرد و pointercancel درگ را لغو می‌کند (باگ «ویجت‌ها تکان می‌خورند
// ولی جابجا نمی‌شوند»). TouchSensor بعد از فعال‌سازی روی touchmove
// preventDefault می‌زند و اسکرول را قفل می‌کند.
class MousePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: React.PointerEvent) =>
        event.pointerType === "mouse" && event.isPrimary && event.button === 0,
    },
  ];
}

// ── Sortable wrapper: long-press (250ms) then drag to reorder ──
// touchAction پیش‌فرض pan-y است (درگ عمودی بدون ربودن اسکرول صفحه)؛
// ویجت‌های با اسکرول افقی داخلی (مثل کیف پول‌ها) pan-x pan-y می‌گیرند.
function SortableCard({
  id,
  touchAction = "pan-y",
  children,
}: {
  id: string;
  touchAction?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction,
        WebkitTouchCallout: "none",
      } as React.CSSProperties}
      className={cn(
        "relative select-none",
        isDragging && "z-20 opacity-90 scale-[1.01] drop-shadow-lg"
      )}
    >
      {children}
    </div>
  );
}

export default function DashboardScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const { data: settings } = useSettings();
  const { data: d, isLoading } = useDashboard();
  const { data: pendingReminders } = useReminders(true);
  const { data: recurringAll } = useRecurring();
  // ویجت «اقساط» — قسط‌های فعال با سررسید بعدی، نزدیک‌ترین اول
  const upcomingInstallments = React.useMemo(
    () =>
      (recurringAll ?? [])
        .filter((r) => r.isActive && r.nextDue)
        .sort((a, b) => Date.parse(a.nextDue!) - Date.parse(b.nextDue!)),
    [recurringAll]
  );
  const { data: dayCounters } = useDayCounters();
  const { data: walOv } = useWalletsOverview();
  const updateSettings = useUpdateSettings();

  const budget = d?.budget ?? null;

  // نزدیک‌ترین شمارندهٔ فعال — نمایشش با سیستم ویجت‌ها کنترل می‌شود
  const homeCounter =
    dayCounters && dayCounters.length > 0
      ? dayCounters.find((c) => c.status === "ACTIVE") ?? dayCounters[0]
      : null;

  // ── ویجت‌های صفحه اصلی: ترتیب + روشن/خاموش (پایدار در پروفایل) ──
  // موس: درگ با حرکت ۶px | لمس: نگه‌داشتن ۲۵۰ms (با تحمل ۸px) و بعد درگ —
  // TouchSensor حین درگ روی touchmove.preventDefault می‌زند تا صفحه اسکرول نکند.
  const sensors = useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );
  const parsedWidgets = React.useMemo(
    () => parseHomeWidgets(settings?.homeWidgets, settings?.dayCounterOnHome),
    [settings?.homeWidgets, settings?.dayCounterOnHome]
  );
  const [widgets, setWidgets] = React.useState(parsedWidgets);
  const widgetsRef = React.useRef(widgets);
  const applyWidgets = React.useCallback((next: typeof parsedWidgets) => {
    widgetsRef.current = next;
    setWidgets(next);
  }, []);
  React.useEffect(() => {
    applyWidgets(parsedWidgets);
  }, [parsedWidgets, applyWidgets]);

  const reorderTo = React.useCallback((activeId: string, overId: string) => {
    const cur = widgetsRef.current;
    const from = cur.order.indexOf(activeId as HomeWidgetId);
    const to = cur.order.indexOf(overId as HomeWidgetId);
    if (from < 0 || to < 0 || from === to) return;
    applyWidgets({ order: arrayMove(cur.order, from, to), off: cur.off });
  }, [applyWidgets]);

  // حین درگ، جای آیتم‌ها زنده جابجا می‌شود (بدون ذخیره)
  const onDragOver = React.useCallback(
    (e: DragOverEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      reorderTo(String(active.id), String(over.id));
    },
    [reorderTo]
  );

  // پایان درگ → ذخیره پایدار ترتیب نهایی
  const onDragEnd = React.useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (over && active.id !== over.id) reorderTo(String(active.id), String(over.id));
      const cur = widgetsRef.current;
      updateSettings.mutate({ homeWidgets: serializeHomeWidgets(cur) });
    },
    [reorderTo, updateSettings]
  );

  const widgetOn = React.useCallback(
    (id: HomeWidgetId) => !widgets.off.includes(id),
    [widgets.off]
  );
  const debtsOn = !widgets.off.includes("debts");
  const goalsOn = !widgets.off.includes("goals");

  const visibleOrder = widgets.order.filter((id) => {
    if (id === "budget") return widgetOn("budget") && !!budget && budget.total > 0;
    if (id === "summary") return widgetOn("summary") && (debtsOn || goalsOn);
    if (id === "dayCounter") return widgetOn("dayCounter") && !!homeCounter;
    return widgetOn(id);
  });
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

            {/* ── ویجت‌ها: قابل خاموش/روشن در تنظیمات + جابجایی با نگه‌داشتن انگشت ── */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
                {visibleOrder.map((wid) => (
                  <SortableCard key={wid} id={wid} touchAction={wid === "wallets" ? "pan-x pan-y" : "pan-y"}>
                    {wid === "budget" && (
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

                    {wid === "recentTx" && (
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
                            {d.recent.slice(0, 6).map((tx) => (
                              <TxRow key={tx.id} tx={tx} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {wid === "upcoming" && (
                      <div className="bg-card rounded-3xl p-4 card-soft" aria-label={f.t("dash.upcoming")}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-[14px] text-foreground">{f.t("dash.upcoming")}</p>
                          <button
                            onClick={() => push("recurring")}
                            className="text-primary text-[12px] font-bold"
                          >
                            {f.t("dash.viewAll")}
                          </button>
                        </div>
                        {upcomingInstallments.length === 0 ? (
                          <p className="text-[12px] text-muted-foreground text-center py-6">
                            {f.t("dash.noUpcoming")}
                          </p>
                        ) : (
                          <div className="flex flex-col divide-y divide-border/50">
                            {upcomingInstallments.slice(0, 4).map((r) => (
                              <InstallmentRow key={r.id} r={r} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {wid === "reminders" && (
                      <div className="bg-card rounded-3xl p-4 card-soft" aria-label={f.t("rem.title")}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-[14px] text-foreground">{f.t("rem.title")}</p>
                          <button
                            onClick={() => push("reminders")}
                            className="text-primary text-[12px] font-bold"
                          >
                            {f.t("dash.viewAll")}
                          </button>
                        </div>
                        {(pendingReminders ?? []).length === 0 ? (
                          <p className="text-[12px] text-muted-foreground text-center py-6">
                            {f.t("rem.empty")}
                          </p>
                        ) : (
                          <div className="flex flex-col divide-y divide-border/50">
                            {(pendingReminders ?? []).slice(0, 4).map((r) => (
                              <ReminderRow key={r.id} r={r} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {wid === "summary" && (
                      <div className={cn("grid gap-3", debtsOn && goalsOn ? "grid-cols-2" : "grid-cols-1")}>
                        {debtsOn && (
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
                        )}
                        {goalsOn && (
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
                        )}
                      </div>
                    )}

                    {wid === "dayCounter" && homeCounter && (
                      <button
                        onClick={() => push("dc-details", { id: homeCounter.id })}
                        className="w-full text-start bg-card rounded-3xl p-4 card-soft flex flex-col gap-3 hover:bg-accent/30 active:scale-[0.99] transition-all"
                        aria-label={`${f.t("dc.title")} — ${homeCounter.title}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${homeCounter.color}1f`,
                              color: homeCounter.color,
                            }}
                          >
                            <CalendarClock className="w-4.5 h-4.5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[14px] text-foreground truncate">{homeCounter.title}</p>
                            <p className="text-[11px] text-muted-foreground">{f.t("dash.dayCounter")}</p>
                          </div>
                        </div>
                        <CounterDisplay
                          startIso={homeCounter.startDate}
                          endIso={homeCounter.endDate}
                          design={homeCounter.design}
                          color={homeCounter.color}
                          size="sm"
                        />
                      </button>
                    )}

                    {wid === "prices" && (
                      <div className="bg-card rounded-3xl p-4 card-soft" aria-label={f.t("dash.prices")}>
                        <p className="font-bold text-[14px] text-foreground mb-1">{f.t("dash.prices")}</p>
                        {/* reserved empty area — live asset prices (gold, USD, …) will land here */}
                        <div className="h-[190px]" aria-hidden="true" />
                      </div>
                    )}

                    {wid === "wallets" && (
                      <div className="bg-card rounded-3xl p-4 card-soft" aria-label={f.t("set.wgWallets")}>
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="font-bold text-[14px] text-foreground">{f.t("set.wgWallets")}</p>
                          <button
                            onClick={() => push("wallet")}
                            className="text-primary text-[12px] font-bold"
                          >
                            {f.t("dash.viewAll")}
                          </button>
                        </div>
                        {(walOv?.wallets ?? []).length === 0 ? (
                          <p className="text-[12px] text-muted-foreground text-center py-6">
                            {f.t("wal.walletsWidgetEmpty")}
                          </p>
                        ) : (
                          <div className="flex gap-3 overflow-x-auto app-screen-scroll snap-x snap-mandatory pb-1 -mx-1 px-1">
                            {(walOv?.wallets ?? []).map((w) => {
                              const remainPct =
                                w.totalIn > 0
                                  ? Math.max(0, Math.min(100, Math.round((w.balance / w.totalIn) * 100)))
                                  : 0;
                              return (
                                <button
                                  key={w.id}
                                  onClick={() => push("wallet-details", { id: w.id })}
                                  aria-label={w.title}
                                  className="w-[172px] shrink-0 snap-start rounded-2xl bg-secondary/50 p-3.5 flex flex-col gap-2 text-start hover:bg-secondary/70 active:scale-[0.98] transition-all"
                                >
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C08052]/15 text-[#C08052] shrink-0">
                                      <Wallet className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="font-bold text-[13px] text-foreground truncate">
                                      {w.title}
                                    </span>
                                  </span>
                                  <span
                                    className={cn(
                                      "num-input text-[17px] font-extrabold leading-none",
                                      w.balance < 0 ? "text-expense" : "text-foreground"
                                    )}
                                    dir="ltr"
                                  >
                                    {f.money(w.balance, false)}
                                  </span>
                                  <span className="flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
                                    <span>{f.t("wal.remainingOfCharge")}</span>
                                    <span className="num-input font-bold text-foreground" dir="ltr">
                                      {f.fa(remainPct)}%
                                    </span>
                                  </span>
                                  <ProgressBar value={remainPct} className="h-1.5" />
                                  <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                                    <span className="text-income font-bold">+</span>
                                    <span className="num-input font-bold" dir="ltr">
                                      {f.money(w.totalIn, false)}
                                    </span>
                                    <span>{f.t("wal.totalIn")}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </SortableCard>
                ))}
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
    </div>
  );
}
