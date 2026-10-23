"use client";

import * as React from "react";
import { Coins, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  Field,
  GradientButton,
  PillInput,
  ScreenHeader,
  useAppFormat,
} from "../ui";
import {
  useAccounts,
  useDeleteWallet,
  useSaveWallet,
  useWalletsOverview,
} from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { toEnDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";

export default function WalletFormScreen({ params }: { params?: Record<string, unknown> }) {
  const p = params ?? {};
  const id = typeof p.id === "string" ? p.id : undefined;

  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const { data: ov } = useWalletsOverview();
  const { data: accounts = [] } = useAccounts();
  const saveWallet = useSaveWallet();
  const deleteWallet = useDeleteWallet();

  const existing = React.useMemo(
    () => (id ? ov?.wallets.find((w) => w.id === id) : undefined),
    [ov, id]
  );

  const [title, setTitle] = React.useState("");
  const [ceiling, setCeiling] = React.useState("");
  const [initialBalance, setInitialBalance] = React.useState("");
  const [linkedIds, setLinkedIds] = React.useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setCeiling(existing.ceiling != null ? formatAmountInput(String(existing.ceiling), f.lang) : "");
    setLinkedIds(existing.linkedAccountIds);
  }, [existing, f.lang]);

  const toggleAccount = (accId: string) => {
    setLinkedIds((prev) =>
      prev.includes(accId) ? prev.filter((x) => x !== accId) : [...prev, accId]
    );
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error(f.t("common.required"));
      return;
    }
    const ceilRaw = ceiling.trim() ? parseAmountInput(toEnDigits(ceiling)) : null;
    if (ceilRaw !== null && ceilRaw < 0) {
      toast.error(f.t("common.required"));
      return;
    }
    const initRaw = initialBalance.trim() ? parseAmountInput(toEnDigits(initialBalance)) : 0;
    saveWallet.mutate(
      {
        id,
        title: title.trim(),
        ceiling: ceilRaw,
        linkedAccountIds: linkedIds,
        initialBalance: id ? undefined : initRaw,
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
    deleteWallet.mutate(id, {
      onSuccess: () => {
        toast.success(f.t("common.deleted"));
        back();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader
        title={id ? f.t("wal.edit") : f.t("wal.add")}
        onBack={back}
      />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        {/* title */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <Field label={f.t("wal.titleField")} required>
            <PillInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={f.t("wal.titlePlaceholder")}
            />
          </Field>
        </div>

        {/* ceiling */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <Field label={f.t("wal.ceiling")}>
            <div className="relative">
              <PillInput
                inputMode="numeric"
                className="num-input pl-14"
                value={ceiling}
                onChange={(e) =>
                  setCeiling(formatAmountInput(toEnDigits(e.target.value), f.lang))
                }
                placeholder={f.t("wal.ceilingOptional")}
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                {f.t("common.toman")}
              </span>
            </div>
          </Field>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Coins className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            {f.t("wal.ceilingHint")}
          </p>
        </div>

        {/* initial balance (create only) */}
        {!id && (
          <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
            <Field label={f.t("wal.initialBalance")}>
              <div className="relative">
                <PillInput
                  inputMode="numeric"
                  className="num-input pl-14"
                  value={initialBalance}
                  onChange={(e) =>
                    setInitialBalance(formatAmountInput(toEnDigits(e.target.value), f.lang))
                  }
                  placeholder="0"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                  {f.t("common.toman")}
                </span>
              </div>
            </Field>
            <p className="text-[11px] text-muted-foreground">{f.t("wal.initialBalanceHint")}</p>
          </div>
        )}

        {/* linked accounts */}
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3">
          <p className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-primary" />
            {f.t("wal.linkedAccounts")}
          </p>
          {accounts.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">{f.t("wal.noLinkedAccounts")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => {
                const active = linkedIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAccount(a.id)}
                    aria-pressed={active}
                    className={cn(
                      "h-9 px-3.5 rounded-full text-[12.5px] font-semibold border transition-all active:scale-95",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary text-muted-foreground border-transparent hover:text-foreground"
                    )}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{f.t("wal.linkedAccountsHint")}</p>
        </div>

        <GradientButton onClick={submit} disabled={saveWallet.isPending} className="mt-1">
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
        title={f.t("wal.deleteConfirm")}
      />
    </div>
  );
}
