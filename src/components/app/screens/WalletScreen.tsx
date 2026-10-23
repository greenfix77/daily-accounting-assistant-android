"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  Coins,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
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
import {
  useDeleteWallet,
  useWalletsOverview,
} from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import type {
  WalletAlertDTO,
  WalletDTO,
  WalletLinkedAccountDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const WALLET_COLOR = "#C08052";

// ── Ceiling alert banner ─────────────────────────────────────
function AlertBanner({ alert }: { alert: WalletAlertDTO }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const over = alert.level === "OVER";
  return (
    <button
      type="button"
      onClick={() => push("wallet-details", { id: alert.walletId })}
      className={cn(
        "w-full rounded-2xl p-3.5 flex flex-col gap-2 text-start cursor-pointer transition-transform active:scale-[0.99]",
        over ? "bg-expense-soft" : "bg-[#F0A8681f]"
      )}
    >
      <div className="flex items-center gap-2">
        {over ? (
          <TriangleAlert className="w-4.5 h-4.5 w-[18px] h-[18px] text-expense shrink-0" />
        ) : (
          <AlertTriangle className="w-[18px] h-[18px] text-[#C77F35] shrink-0" />
        )}
        <span className={cn("text-[13px] font-bold", over ? "text-expense" : "text-[#C77F35]")}>
          {over ? f.t("wal.ceilOver") : f.t("wal.ceilNear")}
        </span>
        <span className="text-[12px] font-bold text-foreground truncate">
          • {alert.walletTitle}
        </span>
      </div>
      <ProgressBar value={alert.percent} />
      <p className="text-[11px] text-muted-foreground">
        {f.t("wal.spentOfCeiling", {
          spent: f.money(alert.spent, false),
          ceiling: f.money(alert.ceiling, false),
        })}{" "}
        ({f.fa(alert.percent)}%)
      </p>
    </button>
  );
}

// ── Wallet card (کیف پول + حساب‌های متصل + آمار — همه در یک کارت) ──
function WalletRow({
  item,
  linked,
  onEdit,
  onDelete,
}: {
  item: WalletDTO;
  linked: WalletLinkedAccountDTO[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);
  const percent =
    item.ceiling && item.ceiling > 0
      ? Math.min(100, Math.round((item.totalOut / item.ceiling) * 100))
      : null;

  return (
    <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
      {/* wallet header — tap → details */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => push("wallet-details", { id: item.id })}
          aria-label={item.title}
          className="flex-1 min-w-0 flex items-center gap-3 text-start cursor-pointer"
        >
          <IconBubble icon="wallet" color={WALLET_COLOR} />

          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="font-bold text-[14px] text-foreground truncate">
              {item.title}
            </span>
            <p className="text-[11px] text-muted-foreground truncate">
              {f.t("wal.transactions")}: {f.fa(item.entryCount)}
              {item.ceiling != null && item.ceiling > 0
                ? ` • ${f.t("wal.ceiling")}: ${f.money(item.ceiling, false)}`
                : ""}
            </p>
            {percent !== null && <ProgressBar value={percent} className="h-1.5" />}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={cn(
                "num-input text-[14px] font-extrabold",
                item.balance < 0 ? "text-expense" : "text-foreground"
              )}
              dir="ltr"
            >
              {f.money(item.balance, false)}
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

      {/* حساب‌های متصل به همین کیف — داخل همان کارت */}
      {linked.length > 0 && (
        <div className="pt-3 border-t border-border/60 flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            {f.t("wal.linkedAccounts")}
          </span>
          {linked.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5">
              <IconBubble icon="landmark" color="#4E9B72" size="sm" />
              <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-foreground truncate">
                {a.name}
              </span>
              <span
                className="num-input text-[12.5px] font-bold text-foreground shrink-0"
                dir="ltr"
              >
                {f.money(a.balance, false)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function WalletScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const push = useAppStore((s) => s.push);
  const { data: ov, isLoading } = useWalletsOverview();
  const deleteWallet = useDeleteWallet();

  const [deleteTarget, setDeleteTarget] = React.useState<WalletDTO | null>(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteWallet.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(f.t("common.deleted"));
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const wallets = ov?.wallets ?? [];
  const alerts = ov?.alerts ?? [];
  const linkedAccounts = ov?.linkedAccounts ?? [];
  const recentEntries = ov?.recentEntries ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader
        title={f.t("wal.title")}
        onBack={back}
        right={
          <button
            onClick={() => push("wallet-form", {})}
            aria-label="add wallet"
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
        ) : wallets.length === 0 ? (
          <EmptyState
            icon={<Coins className="w-7 h-7" />}
            title={f.t("wal.empty")}
            desc={f.t("wal.emptyDesc")}
          />
        ) : (
          <>
            {/* ── hero stats ── */}
            <div className="app-gradient rounded-3xl p-5 text-white shadow-md shadow-primary/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] opacity-90">{f.t("wal.totalBalance")}</span>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                  {f.t("wal.walletsCount")}: {f.fa(ov?.walletCount ?? 0)}
                </span>
              </div>
              <span className="num-input text-[26px] font-extrabold" dir="ltr">
                {f.money(ov?.totalBalance ?? 0, false)}
              </span>
              <div className="flex gap-3 pt-1 border-t border-white/20">
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[10.5px] opacity-85">{f.t("wal.totalIn")}</span>
                  <span className="num-input text-[13px] font-bold" dir="ltr">
                    +{f.money(ov?.totalIn ?? 0, false)}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[10.5px] opacity-85">{f.t("wal.totalOut")}</span>
                  <span className="num-input text-[13px] font-bold" dir="ltr">
                    -{f.money(ov?.totalOut ?? 0, false)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── alerts ── */}
            {alerts.length > 0 && (
              <section className="flex flex-col gap-2" aria-label={f.t("wal.alerts")}>
                <h2 className="text-[13px] font-bold text-foreground px-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-warn" />
                  {f.t("wal.alerts")}
                </h2>
                {alerts.map((a) => (
                  <AlertBanner key={a.walletId} alert={a} />
                ))}
              </section>
            )}

            {/* ── wallets list (هر کیف + حساب‌های متصلش در یک کارت) ── */}
            <section className="flex flex-col gap-2" aria-label={f.t("wal.title")}>
              <h2 className="text-[13px] font-bold text-foreground px-1">
                {f.t("wal.walletsCount")}
              </h2>
              {wallets.map((w) => (
                <WalletRow
                  key={w.id}
                  item={w}
                  linked={linkedAccounts.filter((a) => a.walletId === w.id)}
                  onEdit={() => push("wallet-form", { id: w.id })}
                  onDelete={() => setDeleteTarget(w)}
                />
              ))}
            </section>

            {/* ── recent wallet transactions ── */}
            <section className="flex flex-col gap-2" aria-label={f.t("wal.recentEntries")}>
              <h2 className="text-[13px] font-bold text-foreground px-1">
                {f.t("wal.recentEntries")}
              </h2>
              {recentEntries.length === 0 ? (
                <p className="bg-card rounded-2xl card-soft p-4 text-[12px] text-muted-foreground text-center">
                  {f.t("wal.noRecentEntries")}
                </p>
              ) : (
                <div className="bg-card rounded-2xl card-soft px-4 flex flex-col divide-y divide-border/50">
                  {recentEntries.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => push("wallet-details", { id: e.walletId })}
                      className="py-3 flex items-center gap-3 text-start cursor-pointer"
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-xl shrink-0",
                          e.type === "IN" ? "bg-income-soft text-income" : "bg-expense-soft text-expense"
                        )}
                      >
                        {e.type === "IN" ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[13px] font-bold text-foreground truncate">
                          {e.note || (e.type === "IN" ? f.t("wal.charge") : f.t("wal.spend"))}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground truncate">
                          {e.walletTitle} • {f.dateShort(new Date(e.date))}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "num-input text-[13px] font-bold shrink-0",
                          e.type === "IN" ? "text-income" : "text-expense"
                        )}
                        dir="ltr"
                      >
                        {e.type === "IN" ? "+" : "-"}
                        {f.money(e.amount, false)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={f.t("wal.deleteConfirm")}
      />
    </div>
  );
}
