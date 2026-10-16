"use client";

import * as React from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccounts, useSaveAccount, useDeleteAccount } from "@/lib/hooks";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { toEnDigits } from "@/lib/jalali";
import type { AccountType } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  useAppFormat,
  ScreenHeader,
  Field,
  PillInput,
  SegmentedTabs,
  GradientButton,
  ConfirmDialog,
  ColorDots,
} from "@/components/app/ui";
import { ACCOUNT_ICONS, ACCOUNT_COLORS, getIcon } from "@/components/app/icons";

const TYPE_OPTIONS: { value: AccountType; labelKey: string }[] = [
  { value: "BANK", labelKey: "acc.bank" },
  { value: "CASH", labelKey: "acc.cash" },
  { value: "SAVINGS", labelKey: "acc.savings" },
  { value: "CUSTOM", labelKey: "acc.custom" },
];

export default function AccountFormScreen({ params }: { params?: Record<string, unknown> }) {
  const f = useAppFormat();
  const back = useAppStore((s) => s.back);
  const id = typeof params?.id === "string" ? params.id : undefined;
  const isEdit = !!id;

  const { data: accounts, isLoading } = useAccounts();
  const account = React.useMemo(() => accounts?.find((a) => a.id === id), [accounts, id]);

  const save = useSaveAccount();
  const del = useDeleteAccount();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<AccountType>("BANK");
  const [color, setColor] = React.useState(ACCOUNT_COLORS[0]);
  const [icon, setIcon] = React.useState(ACCOUNT_ICONS[0]);
  const [balance, setBalance] = React.useState("");
  const [hydratedId, setHydratedId] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // hydrate once the loaded account arrives
  React.useEffect(() => {
    if (account && hydratedId !== account.id) {
      setName(account.name);
      setType(account.type);
      setColor(account.color || ACCOUNT_COLORS[0]);
      setIcon(account.icon || ACCOUNT_ICONS[0]);
      setBalance(
        account.initialBalance ? formatAmountInput(String(Math.round(account.initialBalance)), f.lang) : ""
      );
      setHydratedId(account.id);
    }
  }, [account, hydratedId, f.lang]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(f.t("common.required"));
      return;
    }
    try {
      await save.mutateAsync({
        id,
        name: name.trim(),
        type,
        color,
        icon,
        initialBalance: parseAmountInput(balance),
      });
      toast.success(f.t("common.saved"));
      back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : f.t("common.error"));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setConfirmDelete(false);
    try {
      await del.mutateAsync(id);
      toast.success(f.t("common.deleted"));
      back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : f.t("common.error"));
    }
  };

  if (isEdit && !account && isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <ScreenHeader title={f.t("acc.editTitle")} onBack={back} />
        <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
          <div className="h-12 rounded-2xl bg-secondary/50 animate-pulse" />
          <div className="h-14 rounded-2xl bg-secondary/50 animate-pulse" />
          <div className="h-24 rounded-2xl bg-secondary/50 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={isEdit ? f.t("acc.editTitle") : f.t("acc.addTitle")} onBack={back} />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-4">
        <div className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-4">
          {/* name */}
          <Field label={f.t("acc.name")} required>
            <PillInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={f.t("acc.namePlaceholder")}
            />
          </Field>

          {/* type */}
          <Field label={f.t("acc.accType")}>
            <SegmentedTabs
              options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: f.t(o.labelKey) }))}
              value={type}
              onChange={(v) => setType(v)}
              activeClass="bg-primary text-white"
            />
          </Field>

          {/* icon */}
          <Field label={f.t("acc.icon")}>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_ICONS.map((ic) => {
                const Icon = getIcon(ic);
                const active = icon === ic;
                return (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    aria-label={ic}
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center transition-all",
                      active
                        ? "ring-2 ring-primary"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                    style={active ? { backgroundColor: `${color}1f`, color } : undefined}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </Field>

          {/* color */}
          <Field label={f.t("acc.color")}>
            <ColorDots colors={ACCOUNT_COLORS} value={color} onChange={setColor} />
          </Field>
        </div>

        {/* initial balance */}
        <div className="bg-card rounded-2xl card-soft p-4">
          <Field label={f.t("acc.initialBalance")}>
            <div className="relative">
              <PillInput
                dir="ltr"
                inputMode="numeric"
                value={balance}
                onChange={(e) => setBalance(formatAmountInput(toEnDigits(e.target.value), f.lang))}
                placeholder="0"
                className="pl-20 text-right"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                {f.t("common.toman")}
              </span>
            </div>
          </Field>
        </div>

        {/* save */}
        <GradientButton onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "..." : f.t("common.save")}
        </GradientButton>

        {/* delete (edit only) */}
        {isEdit && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={del.isPending}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-expense-soft text-expense text-[14px] font-bold hover:bg-expense/10 active:scale-[0.99] transition-all"
          >
            <Trash2 className="w-4 h-4" />
            {f.t("common.delete")}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={handleDelete}
        title={f.t("acc.deleteConfirm")}
      />
    </div>
  );
}
