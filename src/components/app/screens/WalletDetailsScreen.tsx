"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Coins,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  IconBubble,
  JalaliDatePicker,
  PillInput,
  ProgressBar,
  ScreenHeader,
  SegmentedTabs,
  useAppFormat,
} from "../ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteWallet,
  useDeleteWalletEntry,
  useSaveWalletEntry,
  useWalletEntries,
  useWalletsOverview,
} from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { startOfDay, toEnDigits } from "@/lib/jalali";
import type { WalletEntryType } from "@/lib/types";
import { cn } from "@/lib/utils";

const WALLET_COLOR = "#C08052";

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense" | "plain";
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      <span
        className={cn(
          "num-input text-[14px] font-extrabold",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense"
        )}
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}

export default function WalletDetailsScreen({ params }: { params?: Record<string, unknown> }) {
  const p = params ?? {};
  const id = typeof p.id === "string" ? p.id : undefined;

  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const push = useAppStore((s) => s.push);
  const { data: ov, isLoading } = useWalletsOverview();
  const { data: entries = [], isLoading: entriesLoading } = useWalletEntries(id);
  const saveEntry = useSaveWalletEntry();
  const deleteEntry = useDeleteWalletEntry();

  const wallet = React.useMemo(() => ov?.wallets.find((w) => w.id === id), [ov, id]);
  const deleteWallet = useDeleteWallet();

  const [entryOpen, setEntryOpen] = React.useState(false);
  const [entryType, setEntryType] = React.useState<WalletEntryType>("OUT");
  const [entryAmount, setEntryAmount] = React.useState("");
  const [entryNote, setEntryNote] = React.useState("");
  const [entryDate, setEntryDate] = React.useState<Date>(new Date());

  const [deleteEntryId, setDeleteEntryId] = React.useState<string | null>(null);
  const [confirmDeleteWallet, setConfirmDeleteWallet] = React.useState(false);

  const openEntry = (type: WalletEntryType) => {
    setEntryType(type);
    setEntryAmount("");
    setEntryNote("");
    setEntryDate(new Date());
    setEntryOpen(true);
  };

  const submitEntry = () => {
    if (!id) return;
    const amt = parseAmountInput(toEnDigits(entryAmount));
    if (amt <= 0) {
      toast.error(f.t("common.required"));
      return;
    }
    saveEntry.mutate(
      {
        walletId: id,
        type: entryType,
        amount: amt,
        note: entryNote.trim() || null,
        date: startOfDay(entryDate).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success(f.t("wal.entryAdded"));
          setEntryOpen(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <ScreenHeader title="" onBack={back} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <ScreenHeader title={f.t("wal.title")} onBack={back} />
        <EmptyState icon={<Coins className="w-7 h-7" />} title={f.t("wal.empty")} />
      </div>
    );
  }

  const ceilingPct =
    wallet.ceiling && wallet.ceiling > 0
      ? Math.min(100, Math.round((wallet.totalOut / wallet.ceiling) * 100))
      : null;
  const overCeiling = ceilingPct !== null && ceilingPct >= 100;
  const nearCeiling = ceilingPct !== null && ceilingPct >= 80 && ceilingPct < 100;
  const remainingCeiling =
    wallet.ceiling != null ? Math.max(0, wallet.ceiling - wallet.totalOut) : null;

  const linkedAccounts = (ov?.linkedAccounts ?? []).filter((a) => a.walletId === wallet.id);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader
        title={wallet.title}
        onBack={back}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="more"
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0"
              >
                <MoreVertical className="w-[18px] h-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl bg-card w-44">
              <DropdownMenuItem
                onClick={() => push("wallet-form", { id: wallet.id })}
                className="text-[13px] gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                {f.t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmDeleteWallet(true)}
                className="text-[13px] gap-2 text-expense focus:text-expense"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {f.t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {/* ── balance hero ── */}
        <div className="app-gradient rounded-3xl p-5 text-white shadow-md shadow-primary/20 flex flex-col gap-3">
          <span className="text-[12px] opacity-90">{f.t("wal.balance")}</span>
          <span
            className={cn(
              "num-input text-[26px] font-extrabold",
              wallet.balance < 0 && "text-expense-soft"
            )}
            dir="ltr"
          >
            {f.money(wallet.balance, false)}
          </span>
          <div className="flex gap-3 pt-1 border-t border-white/20">
            <StatBox label={f.t("wal.totalIn")} value={`+${f.money(wallet.totalIn, false)}`} tone="income" />
            <StatBox label={f.t("wal.totalOut")} value={`-${f.money(wallet.totalOut, false)}`} tone="expense" />
          </div>
        </div>

        {/* ── quick actions ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => openEntry("IN")}
            className="h-12 rounded-2xl bg-income-soft text-income text-[14px] font-bold inline-flex items-center justify-center gap-2 hover:brightness-95 transition-all active:scale-[0.98]"
          >
            <ArrowDownLeft className="w-[18px] h-[18px]" />
            {f.t("wal.charge")}
          </button>
          <button
            type="button"
            onClick={() => openEntry("OUT")}
            className="h-12 rounded-2xl bg-expense-soft text-expense text-[14px] font-bold inline-flex items-center justify-center gap-2 hover:brightness-95 transition-all active:scale-[0.98]"
          >
            <ArrowUpRight className="w-[18px] h-[18px]" />
            {f.t("wal.spend")}
          </button>
        </div>

        {/* ── ceiling status ── */}
        {wallet.ceiling != null && wallet.ceiling > 0 && (
          <div className="bg-card rounded-3xl card-soft p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-[14px] text-foreground">{f.t("wal.usage")}</p>
              {overCeiling ? (
                <span className="rounded-full bg-expense-soft text-expense px-2.5 py-0.5 text-[11px] font-bold">
                  {f.t("wal.ceilOver")}
                </span>
              ) : nearCeiling ? (
                <span className="rounded-full bg-[#F0A8681f] text-[#C77F35] px-2.5 py-0.5 text-[11px] font-bold">
                  {f.t("wal.ceilNear")}
                </span>
              ) : null}
            </div>
            <ProgressBar value={ceilingPct ?? 0} />
            <div className="flex gap-3 pt-1 border-t border-border/60">
              <StatBox
                label={f.t("wal.spent")}
                value={f.money(wallet.totalOut, false)}
                tone={overCeiling ? "expense" : "plain"}
              />
              <StatBox label={f.t("wal.remainingCeiling")} value={f.money(remainingCeiling ?? 0, false)} />
              <StatBox label={f.t("wal.ceiling")} value={f.money(wallet.ceiling, false)} />
            </div>
          </div>
        )}

        {/* ── linked accounts ── */}
        <section className="flex flex-col gap-2" aria-label={f.t("wal.linkedAccounts")}>
          <h2 className="text-[13px] font-bold text-foreground px-1 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-primary" />
            {f.t("wal.linkedAccounts")}
          </h2>
          {linkedAccounts.length === 0 ? (
            <p className="bg-card rounded-2xl card-soft p-4 text-[12px] text-muted-foreground text-center">
              {f.t("wal.noLinkedAccounts")}
            </p>
          ) : (
            linkedAccounts.map((a) => (
              <div key={a.id} className="bg-card rounded-2xl card-soft p-3.5 flex items-center gap-3">
                <IconBubble icon="landmark" color="#4E9B72" size="sm" />
                <span className="flex-1 min-w-0 text-[13px] font-bold text-foreground truncate">
                  {a.name}
                </span>
                <span className="num-input text-[13px] font-bold text-foreground shrink-0" dir="ltr">
                  {f.money(a.balance, false)}
                </span>
              </div>
            ))
          )}
        </section>

        {/* ── transactions ── */}
        <section className="flex flex-col gap-2" aria-label={f.t("wal.transactions")}>
          <h2 className="text-[13px] font-bold text-foreground px-1">
            {f.t("wal.transactions")}
          </h2>
          {entriesLoading ? (
            <p className="text-center text-[13px] text-muted-foreground py-6">
              {f.t("common.loading")}
            </p>
          ) : entries.length === 0 ? (
            <p className="bg-card rounded-2xl card-soft p-4 text-[12px] text-muted-foreground text-center">
              {f.t("wal.noTransactions")}
            </p>
          ) : (
            <div className="bg-card rounded-2xl card-soft px-4 flex flex-col divide-y divide-border/50 max-h-96 overflow-y-auto app-screen-scroll">
              {entries.map((e) => (
                <div key={e.id} className="py-3 flex items-center gap-3">
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
                    <span className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {f.dateShort(new Date(e.date))}
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
                  <button
                    type="button"
                    aria-label={f.t("common.delete")}
                    onClick={() => setDeleteEntryId(e.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-expense-soft hover:text-expense transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── add entry dialog ── */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent
          className="max-w-[340px] rounded-3xl bg-card card-soft max-h-[85vh] overflow-y-auto app-screen-scroll"
          dir="rtl"
        >
          <DialogHeader>
            <DialogTitle className="text-[16px] text-start">{f.t("wal.addEntry")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <Field label={f.t("wal.entryType")} required>
              <SegmentedTabs<WalletEntryType>
                value={entryType}
                onChange={setEntryType}
                options={[
                  { value: "IN", label: f.t("wal.charge") },
                  { value: "OUT", label: f.t("wal.spend") },
                ]}
                activeClass={entryType === "IN" ? "bg-income text-white" : "bg-expense text-white"}
              />
            </Field>
            <Field label={f.t("common.amount")} required>
              <div className="relative">
                <PillInput
                  inputMode="numeric"
                  className="num-input pl-14"
                  value={entryAmount}
                  onChange={(e) =>
                    setEntryAmount(formatAmountInput(toEnDigits(e.target.value), f.lang))
                  }
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                  {f.t("common.toman")}
                </span>
              </div>
            </Field>
            <Field label={f.t("wal.entryNote")}>
              <PillInput
                value={entryNote}
                onChange={(e) => setEntryNote(e.target.value)}
                placeholder={f.t("wal.entryNotePlaceholder")}
              />
            </Field>
            <Field label={f.t("wal.entryDate")}>
              <JalaliDatePicker value={entryDate} onChange={setEntryDate} />
            </Field>
            <button
              type="button"
              onClick={submitEntry}
              disabled={saveEntry.isPending}
              className="h-12 rounded-2xl app-gradient text-white text-[14px] font-bold shadow-md shadow-primary/25 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {f.t("wal.addEntry")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── confirm delete entry ── */}
      <ConfirmDialog
        open={!!deleteEntryId}
        onOpenChange={(v) => !v && setDeleteEntryId(null)}
        onConfirm={() => {
          if (!deleteEntryId) return;
          deleteEntry.mutate(deleteEntryId, {
            onSuccess: () => {
              toast.success(f.t("wal.entryDeleted"));
              setDeleteEntryId(null);
            },
            onError: (err) => toast.error(err.message),
          });
        }}
        title={f.t("wal.entryDeleteConfirm")}
      />

      {/* ── confirm delete wallet ── */}
      <ConfirmDialog
        open={confirmDeleteWallet}
        onOpenChange={setConfirmDeleteWallet}
        onConfirm={() => {
          if (!id) return;
          deleteWallet.mutate(id, {
            onSuccess: () => {
              toast.success(f.t("common.deleted"));
              setConfirmDeleteWallet(false);
              back();
            },
            onError: (err) => toast.error(err.message),
          });
        }}
        title={f.t("wal.deleteConfirm")}
      />
    </div>
  );
}
