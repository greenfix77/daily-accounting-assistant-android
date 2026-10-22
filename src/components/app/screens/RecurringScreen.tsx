"use client";

import * as React from "react";
import { ChevronLeft, MoreVertical, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  EmptyState,
  IconBubble,
  ProgressBar,
  ScreenHeader,
  useAppFormat,
} from "../ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteRecurring, useRecurring } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import type { Frequency, RecurringDTO } from "@/lib/types";

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

// ── Installment row (click → full schedule) ──────────────────
function InstallmentRow({
  item,
  onEdit,
  onDelete,
}: {
  item: RecurringDTO;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const total = item.totalCount ?? 0;
  const percent = total > 0 ? Math.round((item.paidCount / total) * 100) : 0;
  const finished = total > 0 && item.paidCount >= total;

  return (
    <div className="bg-card rounded-2xl card-soft p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={() => push("recurring-details", { id: item.id })}
        aria-label={item.title}
        className="flex-1 min-w-0 flex items-center gap-3 text-start cursor-pointer"
      >
        <IconBubble icon="credit-card" color="#5E9EA0" />

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[14px] text-foreground truncate">
              {item.title}
            </span>
            {finished && (
              <span className="rounded-full bg-income-soft text-income px-2.5 py-0.5 text-[11px] font-bold shrink-0">
                {f.t("rec.finished")}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {frequencyLabel(item.frequency, f)} • {f.t("rec.remainingOf", { paid: f.fa(item.paidCount), total: f.fa(total) })}
            {item.nextDue ? ` • ${f.t("rec.nextDue")}: ${f.daysLabel(item.nextDue)}` : ""}
          </p>
          {total > 0 && <ProgressBar value={percent} className="h-1.5" />}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="num-input text-[14px] font-extrabold text-foreground" dir="ltr">
            {f.money(item.amount, false)}
          </span>
          <ChevronLeft className="w-4 h-4 text-muted-foreground rtl:rotate-0 ltr:rotate-180" />
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
export default function RecurringScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const push = useAppStore((s) => s.push);
  const { data: items = [], isLoading } = useRecurring();
  const deleteRecurring = useDeleteRecurring();

  const [deleteTarget, setDeleteTarget] = React.useState<RecurringDTO | null>(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteRecurring.mutate(deleteTarget.id, {
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
        title={f.t("rec.title")}
        onBack={back}
        right={
          <button
            onClick={() => push("recurring-form", {})}
            aria-label="add installment"
            className="w-9 h-9 rounded-full app-gradient text-white flex items-center justify-center shadow-md shadow-primary/25 shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-center text-[13px] text-muted-foreground py-10">
            {f.t("common.loading")}
          </p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="w-7 h-7" />}
            title={f.t("rec.empty")}
            desc={f.t("rec.emptyDesc")}
          />
        ) : (
          items.map((item) => (
            <InstallmentRow
              key={item.id}
              item={item}
              onEdit={() => push("recurring-form", { id: item.id })}
              onDelete={() => setDeleteTarget(item)}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={f.t("rec.deleteConfirm")}
      />
    </div>
  );
}
