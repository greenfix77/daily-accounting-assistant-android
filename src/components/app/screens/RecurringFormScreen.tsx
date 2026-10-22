"use client";

import * as React from "react";
import { Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  Field,
  GradientButton,
  JalaliDatePicker,
  PillInput,
  ScreenHeader,
  SegmentedTabs,
  useAppFormat,
} from "../ui";
import { useDeleteRecurring, useRecurring, useSaveRecurring } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { toEnDigits } from "@/lib/jalali";
import type { Frequency } from "@/lib/types";

export default function RecurringFormScreen({ params }: { params?: Record<string, unknown> }) {
  const p = params ?? {};
  const id = typeof p.id === "string" ? p.id : undefined;

  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const { data: items } = useRecurring();
  const saveRecurring = useSaveRecurring();
  const deleteRecurring = useDeleteRecurring();

  const existing = React.useMemo(
    () => (id ? items?.find((r) => r.id === id) : undefined),
    [items, id]
  );

  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [frequency, setFrequency] = React.useState<Frequency>("MONTHLY");
  const [startDate, setStartDate] = React.useState<Date>(new Date());
  const [totalCount, setTotalCount] = React.useState("");
  const [paidBefore, setPaidBefore] = React.useState("0");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setAmount(existing.amount ? formatAmountInput(String(existing.amount), f.lang) : "");
    setFrequency(existing.frequency);
    setStartDate(new Date(existing.startDate));
    setTotalCount(existing.totalCount ? String(existing.totalCount) : "");
    setPaidBefore(String(existing.paidCount ?? 0));
  }, [existing, f.lang]);

  const submit = () => {
    if (!title.trim()) {
      toast.error(f.t("common.required"));
      return;
    }
    const amt = parseAmountInput(toEnDigits(amount));
    if (amt <= 0) {
      toast.error(f.t("common.required"));
      return;
    }
    const tc = parseAmountInput(toEnDigits(totalCount));
    if (tc < 1) {
      toast.error(f.t("rec.totalCountRequired"));
      return;
    }
    const pb = Math.max(0, parseAmountInput(toEnDigits(paidBefore)));
    if (pb > tc) {
      toast.error(f.t("rec.paidExceedsTotal"));
      return;
    }
    saveRecurring.mutate(
      {
        id,
        title: title.trim(),
        amount: amt,
        frequency,
        startDate: startDate.toISOString(),
        totalCount: tc,
        paidCount: pb,
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
    deleteRecurring.mutate(id, {
      onSuccess: () => {
        toast.success(f.t("common.deleted"));
        back();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={id ? f.t("common.edit") : f.t("rec.add")} onBack={back} />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {/* title + amount */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <Field label={f.t("rec.titleField")} required>
            <PillInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={f.t("rec.titlePlaceholder")}
            />
          </Field>
          <Field label={f.t("common.amount")} required>
            <div className="relative">
              <PillInput
                inputMode="numeric"
                className="num-input pl-14"
                value={amount}
                onChange={(e) =>
                  setAmount(formatAmountInput(toEnDigits(e.target.value), f.lang))
                }
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                {f.t("common.toman")}
              </span>
            </div>
          </Field>
        </div>

        {/* schedule — تناوب stays as-is */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <Field label={f.t("rec.frequency")} required>
            <SegmentedTabs<Frequency>
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: "DAILY", label: f.t("rec.daily") },
                { value: "WEEKLY", label: f.t("rec.weekly") },
                { value: "MONTHLY", label: f.t("rec.monthly") },
                { value: "YEARLY", label: f.t("rec.yearly") },
              ]}
            />
          </Field>
          <Field label={f.t("rec.startDate")} required>
            <JalaliDatePicker value={startDate} onChange={setStartDate} />
          </Field>
          <Field label={f.t("rec.totalCount")} required>
            <PillInput
              inputMode="numeric"
              className="num-input"
              value={totalCount}
              onChange={(e) =>
                setTotalCount(formatAmountInput(toEnDigits(e.target.value), f.lang))
              }
              placeholder={f.t("rec.totalCountPlaceholder")}
            />
          </Field>
        </div>

        {/* payment status — replaces the old account picker */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <p className="text-[13px] font-bold text-foreground">{f.t("rec.payStatus")}</p>
          <Field label={f.t("rec.paidBefore")}>
            <PillInput
              inputMode="numeric"
              className="num-input"
              value={paidBefore}
              onChange={(e) =>
                setPaidBefore(formatAmountInput(toEnDigits(e.target.value), f.lang))
              }
            />
          </Field>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            {f.t("rec.noAccountingHint")}
          </p>
        </div>

        <GradientButton onClick={submit} disabled={saveRecurring.isPending} className="mt-1">
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
        title={f.t("rec.deleteConfirm")}
      />
    </div>
  );
}
