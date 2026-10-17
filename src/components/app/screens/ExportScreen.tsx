"use client";

import * as React from "react";
import {
  DatabaseBackup,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, JalaliDatePicker, ScreenHeader, useAppFormat } from "@/components/app/ui";
import { useAppStore } from "@/lib/store";
import { useRestoreBackup } from "@/lib/hooks";
import { exportCsv, getBackup, getTransactions } from "@/lib/local/api";
import { saveTextFile } from "@/lib/save-file";
import { endOfDay, startOfDay } from "@/lib/jalali";
import type { TransactionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type BusyKey = "excel" | "csv" | "pdf" | "backup" | "restore";

interface ExportAction {
  key: BusyKey;
  titleKey: string;
  descKey?: string;
  icon: LucideIcon;
  color: string;
  softClass?: string;
}

const ACTIONS: ExportAction[] = [
  { key: "excel", titleKey: "exp.excel", icon: FileSpreadsheet, color: "#4E9B72", softClass: "bg-income-soft" },
  { key: "csv", titleKey: "exp.csv", icon: FileText, color: "#5E9EA0" },
  { key: "pdf", titleKey: "exp.pdf", descKey: "exp.pdfHint", icon: Printer, color: "#A78BCA" },
  { key: "backup", titleKey: "exp.backup", descKey: "exp.backupDesc", icon: DatabaseBackup, color: "#F0A868", softClass: "bg-warn-soft" },
  { key: "restore", titleKey: "exp.restore", descKey: "exp.restoreDesc", icon: Upload, color: "#E5757A", softClass: "bg-expense-soft" },
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ExportScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const restore = useRestoreBackup();

  const [from, setFrom] = React.useState<Date | null>(null);
  const [to, setTo] = React.useState<Date | null>(null);
  const [busy, setBusy] = React.useState<BusyKey | null>(null);
  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const [pendingRestore, setPendingRestore] = React.useState<Record<string, unknown> | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  /** local-layer date range (ISO strings) */
  const range = (): { from?: string; to?: string } => ({
    from: from ? startOfDay(from).toISOString() : undefined,
    to: to ? endOfDay(to).toISOString() : undefined,
  });

  const run = async (key: BusyKey, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch {
      toast.error(f.t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const downloadCsv = async (name: string) => {
    const csv = await exportCsv(range());
    // CSV text includes the \uFEFF BOM so Excel opens Persian text correctly
    const res = await saveTextFile(csv, name, "text/csv; charset=utf-8");
    toast.success(f.t(res === "shared" ? "exp.fileReady" : "exp.exported"));
  };

  const backup = async () => {
    const data = await getBackup();
    const res = await saveTextFile(
      JSON.stringify(data),
      `backup-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json"
    );
    toast.success(f.t(res === "shared" ? "exp.fileReady" : "exp.backupDone"));
  };

  const printPdf = async () => {
    const { from: fromISO, to: toISO } = range();
    const list = await getTransactions({ limit: 500, from: fromISO, to: toISO });

    // Pre-build all translated strings (f is not available inside the iframe HTML)
    const appTitle = f.t("app.name");
    const heading = f.t("exp.title");
    const rangeLabel =
      from && to
        ? `${f.t("exp.fromDate")} ${f.dateShort(from)} — ${f.t("exp.toDate")} ${f.dateShort(to)}`
        : from
          ? `${f.t("exp.fromDate")} ${f.dateShort(from)}`
          : to
            ? `${f.t("exp.toDate")} ${f.dateShort(to)}`
            : f.t("common.all");
    const colTitle = f.t("tx.mainTitle");
    const colType = f.t("common.type");
    const colCat = f.t("tx.category");
    const colAcc = f.t("tx.account");
    const colDate = f.t("common.date");
    const colAmount = f.t("common.amount");
    const lblIncome = f.t("tx.income");
    const lblExpense = f.t("tx.expense");
    const lblTransfer = f.t("tx.transfer");
    const lblNoCat = f.t("tx.noCategory");
    const lblNet = f.t("rep.net");
    const lblTo = f.t("tx.to");

    const typeLabel = (t: TransactionDTO["type"]) =>
      t === "INCOME" ? lblIncome : t === "EXPENSE" ? lblExpense : lblTransfer;

    let income = 0;
    let expense = 0;
    const rows = list
      .map((t) => {
        if (t.type === "INCOME") income += t.amount;
        if (t.type === "EXPENSE") expense += t.amount;
        const acc =
          t.type === "TRANSFER" && t.toAccountName
            ? `${t.accountName} ${lblTo} ${t.toAccountName}`
            : t.accountName;
        return `<tr><td>${escapeHtml(t.title ?? "—")}</td><td>${typeLabel(t.type)}</td><td>${escapeHtml(
          t.categoryName ?? lblNoCat
        )}</td><td>${escapeHtml(acc)}</td><td>${f.dateShort(t.date)}</td><td class="amount">${f.money(
          t.amount,
          false
        )}</td></tr>`;
      })
      .join("");

    const html = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8" /><title>${escapeHtml(
      appTitle
    )}</title><style>
      body { font-family: Vazirmatn, Tahoma, sans-serif; padding: 24px; color: #1a1a1a; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .range { color: #777; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
      th { background: #f2f7f4; }
      td.amount, th.amount { direction: ltr; text-align: left; white-space: nowrap; }
      tfoot td { font-weight: bold; background: #fafafa; }
    </style></head><body>
      <h1>${escapeHtml(appTitle)} — ${escapeHtml(heading)}</h1>
      <div class="range">${escapeHtml(rangeLabel)}</div>
      <table>
        <thead><tr><th>${colTitle}</th><th>${colType}</th><th>${colCat}</th><th>${colAcc}</th><th>${colDate}</th><th class="amount">${colAmount}</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="5">${lblIncome}</td><td class="amount">${f.money(income, false)}</td></tr>
          <tr><td colspan="5">${lblExpense}</td><td class="amount">${f.money(expense, false)}</td></tr>
          <tr><td colspan="5">${lblNet}</td><td class="amount">${f.money(income - expense, false)}</td></tr>
        </tfoot>
      </table>
    </body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 60_000);
    } else {
      iframe.remove();
    }
    toast.info(f.t("exp.pdfHint"));
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("invalid backup");
      }
      setPendingRestore(parsed as Record<string, unknown>);
      setRestoreOpen(true);
    } catch {
      toast.error(f.t("exp.restoreFailed"));
    }
  };

  const doRestore = async () => {
    if (!pendingRestore) return;
    try {
      await restore.mutateAsync(pendingRestore);
      toast.success(f.t("exp.restored"));
    } catch {
      toast.error(f.t("exp.restoreFailed"));
    } finally {
      setPendingRestore(null);
    }
  };

  const onAction = (a: ExportAction) => {
    if (a.key === "restore") {
      fileRef.current?.click();
      return;
    }
    void run(a.key, async () => {
      if (a.key === "excel") await downloadCsv("transactions-excel.csv");
      else if (a.key === "csv") await downloadCsv("transactions.csv");
      else if (a.key === "pdf") await printPdf();
      else if (a.key === "backup") await backup();
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={f.t("exp.title")} onBack={back} />
      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {/* Date range */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <p className="text-[13px] font-bold text-foreground">{f.t("exp.dateRange")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">{f.t("exp.fromDate")}</span>
              <JalaliDatePicker value={from} onChange={setFrom} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">{f.t("exp.toDate")}</span>
              <JalaliDatePicker value={to} onChange={setTo} />
            </div>
          </div>
        </div>

        {/* Actions */}
        {ACTIONS.map((a) => {
          const Icon = busy === a.key ? Loader2 : a.icon;
          return (
            <button
              key={a.key}
              type="button"
              disabled={busy !== null}
              onClick={() => onAction(a)}
              className="bg-card rounded-2xl card-soft p-3.5 flex items-center gap-3 text-right w-full hover:bg-muted/40 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                  a.softClass
                )}
                style={a.softClass ? { color: a.color } : { backgroundColor: `${a.color}1f`, color: a.color }}
              >
                <Icon className={cn("w-5 h-5", busy === a.key && "animate-spin")} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[14px] text-foreground">{f.t(a.titleKey)}</span>
                {a.descKey && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5">{f.t(a.descKey)}</span>
                )}
              </span>
            </button>
          );
        })}

        {/* hidden restore file picker */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void onPickFile(e)}
        />
      </div>

      {/* Restore confirm */}
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={(v) => {
          setRestoreOpen(v);
          if (!v) setPendingRestore(null);
        }}
        onConfirm={() => void run("restore", doRestore)}
        title={f.t("exp.restoreConfirmTitle")}
        description={f.t("exp.restoreConfirm")}
        confirmLabel={f.t("common.confirm")}
      />
    </div>
  );
}
