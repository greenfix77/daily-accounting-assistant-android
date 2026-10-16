"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useBudgets, useSaveBudget, useDeleteBudget, useCategories } from "@/lib/hooks";
import type { BudgetItemDTO } from "@/lib/types";
import { jalaliMonthKey, toEnDigits } from "@/lib/jalali";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useAppFormat,
  ScreenHeader,
  EmptyState,
  MonthSwitcher,
  ProgressBar,
  IconBubble,
  GradientButton,
  ConfirmDialog,
  Field,
  PillInput,
} from "@/components/app/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BudgetScreen({ params }: { params?: Record<string, unknown> }) {
  const f = useAppFormat();
  const back = useAppStore((s) => s.back);

  const paramMonth = typeof params?.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : null;
  const [monthKey, setMonthKey] = React.useState(paramMonth ?? jalaliMonthKey(new Date()));

  const { data: budget, isLoading } = useBudgets(monthKey);
  const { data: expenseCats } = useCategories("EXPENSE");

  const save = useSaveBudget();
  const del = useDeleteBudget();

  const [totalOpen, setTotalOpen] = React.useState(false);
  const [totalAmount, setTotalAmount] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [addCatId, setAddCatId] = React.useState<string | null>(null);
  const [addAmount, setAddAmount] = React.useState("");
  const [editItem, setEditItem] = React.useState<BudgetItemDTO | null>(null);
  const [editAmount, setEditAmount] = React.useState("");
  const [toDelete, setToDelete] = React.useState<BudgetItemDTO | null>(null);

  const total = budget?.total ?? 0;
  const overallSpent = budget?.overallSpent ?? 0;
  const items = budget?.items ?? [];
  const percent = total > 0 ? Math.round((overallSpent / total) * 100) : 0;

  // expense categories without a budget for this month
  const availableCats = React.useMemo(
    () => (expenseCats ?? []).filter((c) => !items.some((it) => it.categoryId === c.id)),
    [expenseCats, items]
  );

  const openTotal = () => {
    setTotalAmount(total ? formatAmountInput(String(total), f.lang) : "");
    setTotalOpen(true);
  };

  const handleSaveTotal = async () => {
    try {
      await save.mutateAsync({ month: monthKey, categoryId: null, amount: parseAmountInput(totalAmount) });
      toast.success(f.t("common.saved"));
      setTotalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : f.t("common.error"));
    }
  };

  const openAdd = () => {
    setAddCatId(availableCats[0]?.id ?? null);
    setAddAmount("");
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!addCatId) {
      toast.error(f.t("common.required"));
      return;
    }
    const amount = parseAmountInput(addAmount);
    if (amount <= 0) {
      toast.error(f.t("common.required"));
      return;
    }
    try {
      await save.mutateAsync({ month: monthKey, categoryId: addCatId, amount });
      toast.success(f.t("common.saved"));
      setAddOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : f.t("common.error"));
    }
  };

  const openEditItem = (it: BudgetItemDTO) => {
    setEditItem(it);
    setEditAmount(formatAmountInput(String(it.amount), f.lang));
  };

  const handleSaveItem = async () => {
    if (!editItem) return;
    try {
      await save.mutateAsync({ id: editItem.id, amount: parseAmountInput(editAmount) });
      toast.success(f.t("common.saved"));
      setEditItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : f.t("common.error"));
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      await del.mutateAsync(target.id);
      toast.success(f.t("common.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : f.t("common.error"));
    }
  };

  const empty = !isLoading && total === 0 && items.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={f.t("bud.title")} onBack={back} />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />

        {isLoading ? (
          <>
            <div className="h-[140px] rounded-3xl bg-secondary/60 animate-pulse" />
            <div className="h-[96px] rounded-2xl bg-secondary/50 animate-pulse" />
            <div className="h-[96px] rounded-2xl bg-secondary/50 animate-pulse" />
          </>
        ) : empty ? (
          <EmptyState
            icon={<PiggyBank className="w-7 h-7" />}
            title={f.t("bud.noBudget")}
            desc={f.t("bud.noBudgetDesc")}
            action={<GradientButton onClick={openTotal}>{f.t("bud.setTotal")}</GradientButton>}
          />
        ) : (
          <>
            {/* ── Monthly budget hero ── */}
            <div className="relative overflow-hidden app-gradient text-white rounded-3xl p-5 shadow-md shadow-primary/20 shrink-0">
              <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -bottom-14 -left-16 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute top-5 left-24 w-8 h-8 rounded-full bg-white/10 pointer-events-none" />
              <div className="relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] text-white/80 font-medium">{f.t("bud.monthly")}</p>
                    <p className="text-[24px] font-extrabold mt-1.5 num-input">{f.money(total)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={openTotal}
                    aria-label={f.t("bud.editTotal")}
                    className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2.5 mt-3">
                  <span className="text-[13px] font-bold num-input shrink-0">{f.fa(percent)}%</span>
                  <ProgressBar value={percent} colorByValue={false} fixedColor="#FFFFFF" className="bg-white/20" />
                </div>
                <p className="text-[11px] text-white/80 mt-2.5 num-input">
                  {f.t("bud.spent")}: {f.money(overallSpent)} • {f.t("bud.remaining")}:{" "}
                  {f.money(Math.max(0, total - overallSpent))}
                </p>
              </div>
            </div>

            {/* ── Category budget items ── */}
            {items.map((it) => {
              const spentColor =
                it.percent >= 100 ? "text-expense" : it.percent >= 80 ? "text-warn" : "text-income";
              return (
                <div key={it.id} className="bg-card rounded-2xl card-soft p-4">
                  <div className="flex items-center gap-3">
                    <IconBubble icon={it.categoryIcon ?? "tag"} color={it.categoryColor} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[14px] text-foreground truncate">
                          {it.categoryName ?? "—"}
                        </p>
                        {it.percent >= 100 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-expense-soft text-expense shrink-0">
                            {f.t("bud.overBudget")}
                          </span>
                        ) : it.percent >= 80 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn-soft text-warn shrink-0">
                            {f.t("bud.warn80")}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 num-input">
                        {f.t("bud.allowed")}: {f.money(it.amount)}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className={cn("num-input text-[12px] font-bold", spentColor)}>{f.money(it.spent)}</p>
                      <p className="text-[10px] text-muted-foreground num-input">{f.fa(it.percent)}%</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditItem(it)}
                        aria-label={f.t("bud.editItem")}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(it)}
                        aria-label={f.t("common.delete")}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-expense hover:bg-expense-soft transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <ProgressBar value={it.percent} className="mt-3" />
                </div>
              );
            })}

            {/* ── Add category budget ── */}
            <GradientButton onClick={openAdd}>
              <span className="flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                {f.t("bud.addCategoryBudget")}
              </span>
            </GradientButton>
          </>
        )}
      </div>

      {/* ── total budget dialog ── */}
      <Dialog open={totalOpen} onOpenChange={setTotalOpen}>
        <DialogContent className="max-w-[340px] rounded-3xl bg-card p-5 gap-4">
          <DialogHeader className="text-right space-y-0">
            <DialogTitle className="text-[15px] font-bold">{f.t("bud.editTotal")}</DialogTitle>
          </DialogHeader>
          <Field label={f.t("common.amount")} required>
            <div className="relative">
              <PillInput
                dir="ltr"
                inputMode="numeric"
                value={totalAmount}
                onChange={(e) => setTotalAmount(formatAmountInput(toEnDigits(e.target.value), f.lang))}
                placeholder="0"
                className="pl-20 text-right"
                autoFocus
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                {f.t("common.toman")}
              </span>
            </div>
          </Field>
          <GradientButton onClick={handleSaveTotal} disabled={save.isPending}>
            {save.isPending ? "..." : f.t("common.save")}
          </GradientButton>
        </DialogContent>
      </Dialog>

      {/* ── add category budget dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[340px] rounded-3xl bg-card p-5 gap-4">
          <DialogHeader className="text-right space-y-0">
            <DialogTitle className="text-[15px] font-bold">{f.t("bud.addCategoryBudget")}</DialogTitle>
          </DialogHeader>
          <Field label={f.t("bud.selectCategory")} required>
            <div className="max-h-44 overflow-y-auto app-screen-scroll flex flex-col gap-1.5">
              {availableCats.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">
                  {f.t("bud.emptyItems")}
                </p>
              ) : (
                availableCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAddCatId(c.id)}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-2xl text-right transition-all",
                      addCatId === c.id
                        ? "bg-primary/10 ring-1 ring-primary"
                        : "bg-secondary/60 hover:bg-secondary"
                    )}
                  >
                    <IconBubble icon={c.icon} color={c.color} size="sm" />
                    <span className="text-[13px] font-semibold flex-1 truncate">{c.name}</span>
                    {addCatId === c.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </Field>
          <Field label={f.t("common.amount")} required>
            <div className="relative">
              <PillInput
                dir="ltr"
                inputMode="numeric"
                value={addAmount}
                onChange={(e) => setAddAmount(formatAmountInput(toEnDigits(e.target.value), f.lang))}
                placeholder="0"
                className="pl-20 text-right"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                {f.t("common.toman")}
              </span>
            </div>
          </Field>
          <GradientButton onClick={handleAdd} disabled={save.isPending}>
            {save.isPending ? "..." : f.t("common.save")}
          </GradientButton>
        </DialogContent>
      </Dialog>

      {/* ── edit item dialog ── */}
      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent className="max-w-[340px] rounded-3xl bg-card p-5 gap-4">
          <DialogHeader className="text-right space-y-0">
            <DialogTitle className="text-[15px] font-bold">{f.t("bud.editItem")}</DialogTitle>
          </DialogHeader>
          <Field label={f.t("common.amount")} required>
            <div className="relative">
              <PillInput
                dir="ltr"
                inputMode="numeric"
                value={editAmount}
                onChange={(e) => setEditAmount(formatAmountInput(toEnDigits(e.target.value), f.lang))}
                placeholder="0"
                className="pl-20 text-right"
                autoFocus
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                {f.t("common.toman")}
              </span>
            </div>
          </Field>
          <GradientButton onClick={handleSaveItem} disabled={save.isPending}>
            {save.isPending ? "..." : f.t("common.save")}
          </GradientButton>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        onConfirm={handleDelete}
        title={f.t("bud.deleteConfirm")}
      />
    </div>
  );
}
