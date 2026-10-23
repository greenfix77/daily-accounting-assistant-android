"use client";

import * as React from "react";
import { ArrowLeftRight, Pencil, Trash2, ReceiptText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useTransaction, useDeleteTransaction } from "@/lib/hooks";
import type { TransactionDTO, TxType } from "@/lib/types";
import { AmountText, EmptyState, IconBubble, ScreenHeader, ConfirmDialog, useAppFormat } from "@/components/app/ui";

const TYPE_COLOR: Record<TxType, string> = {
  INCOME: "#4E9B72",
  EXPENSE: "#E5757A",
  TRANSFER: "#A78BCA",
};

function txIcon(tx: TransactionDTO): string {
  return tx.categoryIcon ?? (tx.type === "INCOME" ? "banknote" : "shopping-cart");
}

function typeLabel(t: TxType, f: ReturnType<typeof useAppFormat>): string {
  return t === "INCOME" ? f.t("tx.income") : t === "EXPENSE" ? f.t("tx.expense") : f.t("tx.transfer");
}

function InfoRow({ label, value, dot }: { label: string; value: string; dot?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 text-[13px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-semibold text-foreground text-start flex items-center gap-1.5 min-w-0">
        {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="bg-card rounded-2xl card-soft p-6 flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-secondary animate-pulse" />
        <div className="h-4 w-32 rounded-full bg-secondary animate-pulse" />
        <div className="h-7 w-44 rounded-full bg-secondary animate-pulse" />
        <div className="h-3 w-24 rounded-full bg-secondary/60 animate-pulse" />
      </div>
      <div className="bg-card rounded-2xl card-soft px-4 py-2 flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-full rounded-full bg-secondary/70 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function TransactionDetailsScreen({ params }: { params?: Record<string, unknown> }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const back = useAppStore((s) => s.back);
  const id = params?.id as string | undefined;

  const { data: tx, isLoading } = useTransaction(id);
  const del = useDeleteTransaction();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const onDelete = async () => {
    if (!tx) return;
    try {
      await del.mutateAsync(tx.id);
      toast.success(f.t("toast.txDeleted"));
      back();
    } catch {
      toast.error(f.t("common.error"));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={f.t("tx.details")} onBack={back} />
      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {isLoading ? (
          <DetailsSkeleton />
        ) : !tx ? (
          <EmptyState icon={<ReceiptText className="w-7 h-7" />} title={f.t("tx.noResults")} />
        ) : (
          <>
            {/* Hero */}
            <div className="bg-card rounded-2xl card-soft p-6 flex flex-col items-center gap-2 text-center">
              {tx.type === "TRANSFER" ? (
                <span
                  className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
                  style={{ backgroundColor: `${TYPE_COLOR.TRANSFER}1f`, color: TYPE_COLOR.TRANSFER }}
                >
                  <ArrowLeftRight className="w-6 h-6" />
                </span>
              ) : (
                <IconBubble
                  size="lg"
                  icon={txIcon(tx)}
                  color={tx.categoryColor ?? TYPE_COLOR[tx.type]}
                />
              )}
              <p className="text-[16px] font-bold text-foreground">
                {tx.title ?? tx.categoryName ?? typeLabel(tx.type, f)}
              </p>
              {tx.type === "TRANSFER" && (
                <p className="text-[12px] text-muted-foreground">
                  {tx.accountName} {f.t("tx.to")} {tx.toAccountName ?? "—"}
                </p>
              )}
              <AmountText
                value={tx.amount}
                type={tx.type}
                withUnit
                className="text-[24px]"
              />
              <p className="text-[12px] text-muted-foreground">{f.dateLong(tx.date)}</p>
            </div>

            {/* Info rows */}
            <div className="bg-card rounded-2xl card-soft px-4 divide-y divide-border/60">
              <InfoRow
                label={f.t("tx.accountDetail")}
                value={
                  tx.type === "TRANSFER"
                    ? `${tx.accountName} ${f.t("tx.to")} ${tx.toAccountName ?? "—"}`
                    : tx.accountName
                }
              />
              {tx.walletId && (
                <InfoRow
                  label={f.t("tx.walletDetail")}
                  value={tx.walletName ?? f.t("tx.wallet")}
                />
              )}
              <InfoRow
                label={f.t("tx.categoryDetail")}
                value={tx.categoryName ?? f.t("tx.noCategory")}
                dot={tx.categoryColor}
              />
              <InfoRow label={f.t("common.description")} value={tx.description ?? "—"} />
              <InfoRow label={f.t("tx.noteDetail")} value={tx.notes ?? "—"} />
            </div>

            {/* Receipt */}
            {tx.receiptUrl && (
              <img
                src={tx.receiptUrl}
                alt={f.t("tx.receipt")}
                className="w-full rounded-2xl border border-border bg-card"
              />
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                onClick={() => push("transaction-form", { mode: "edit", id: tx.id })}
                className="h-12 rounded-2xl border-2 border-primary text-primary text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                {f.t("common.edit")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={del.isPending}
                className="h-12 rounded-2xl bg-expense-soft text-expense text-[14px] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {del.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {f.t("common.delete")}
              </button>
            </div>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              onConfirm={onDelete}
              title={f.t("tx.deleteConfirm")}
              confirmLabel={f.t("common.delete")}
              cancelLabel={f.t("common.cancel")}
            />
          </>
        )}
      </div>
    </div>
  );
}
