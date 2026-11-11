"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeftRight, History, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  useAccounts,
  useSaveAccount,
  useDeleteAccount,
  useTransactions,
  type TxFilters,
} from "@/lib/hooks";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import {
  addJalaliMonths,
  endOfDay,
  jalaliMonthRange,
  startOfDay,
  toEnDigits,
  toGregorian,
  toJalali,
} from "@/lib/jalali";
import type { AccountType, TransactionDTO, TxType } from "@/lib/types";
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
  AmountText,
  IconBubble,
  JalaliDatePicker,
} from "@/components/app/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

        {/* account statement (گردش حساب) — edit mode only */}
        {isEdit && account && <AccountStatement accountId={account.id} />}
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

// ═════════════════════════════════════════════════════════════
// Account statement (گردش حساب) — last N movements of this
// account with count + date-range filters. Incoming transfers
// (rows credited to this account) are included via accountSide
// "both" and shown with a positive amount + destination balance.
// ═════════════════════════════════════════════════════════════

type RangeKey = "all" | "thisMonth" | "m3" | "m6" | "thisYear" | "custom";

const RANGE_OPTIONS: { value: RangeKey; labelKey: string }[] = [
  { value: "all", labelKey: "acc.stmt.all" },
  { value: "thisMonth", labelKey: "acc.stmt.thisMonth" },
  { value: "m3", labelKey: "acc.stmt.m3" },
  { value: "m6", labelKey: "acc.stmt.m6" },
  { value: "thisYear", labelKey: "acc.stmt.thisYear" },
  { value: "custom", labelKey: "acc.stmt.custom" },
];

/** convert the selected preset into from/to ISO strings (jalali-aware) */
function rangeToFromTo(
  range: RangeKey,
  customFrom: Date | null,
  customTo: Date | null
): { from?: string; to?: string } {
  const now = new Date();
  switch (range) {
    case "thisMonth": {
      const r = jalaliMonthRange(now);
      return {
        from: startOfDay(r.start).toISOString(),
        to: endOfDay(new Date(r.end.getTime() - 1)).toISOString(),
      };
    }
    case "m3":
      return {
        from: startOfDay(addJalaliMonths(now, -3)).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case "m6":
      return {
        from: startOfDay(addJalaliMonths(now, -6)).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case "thisYear": {
      const j = toJalali(now);
      return {
        from: startOfDay(toGregorian(j.jy, 1, 1)).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    }
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom).toISOString() : undefined,
        to: customTo ? endOfDay(customTo).toISOString() : undefined,
      };
    default:
      return {};
  }
}

/** statement row — direction-aware: a transfer credited to this account
 *  reads «انتقال از …» with a + amount, a transfer out reads «انتقال به …» with − */
function StatementRow({
  tx,
  accountId,
  onPress,
}: {
  tx: TransactionDTO;
  accountId: string;
  onPress: () => void;
}) {
  const f = useAppFormat();
  const isTransfer = tx.type === "TRANSFER";
  const isIncoming = isTransfer && tx.toAccountId === accountId;
  const amountType: TxType | "IN" | "OUT" = !isTransfer
    ? tx.type
    : isIncoming
      ? "IN"
      : "OUT";
  const title = isTransfer
    ? isIncoming
      ? f.t("tx.transferIn", { name: tx.accountName })
      : f.t("tx.transferOut", { name: tx.toAccountName ?? "" })
    : tx.title ?? tx.categoryName ?? (tx.type === "INCOME" ? f.t("tx.income") : f.t("tx.expense"));

  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full text-start bg-secondary/40 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform hover:bg-secondary/70"
    >
      {isTransfer ? (
        <span
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
          style={{ backgroundColor: "#A78BCA1f", color: "#A78BCA" }}
        >
          <ArrowLeftRight className="w-4 h-4" />
        </span>
      ) : (
        <IconBubble
          icon={tx.categoryIcon ?? (tx.type === "INCOME" ? "banknote" : "shopping-cart")}
          color={tx.categoryColor ?? (tx.type === "INCOME" ? "#4E9B72" : "#E5757A")}
          size="sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{title}</p>
        <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">
          {tx.categoryName ? `${tx.categoryName} • ` : ""}
          {f.dateShort(tx.date)}
        </p>
      </div>
      <span className="flex flex-col items-end gap-0.5 shrink-0">
        <AmountText value={tx.amount} type={amountType} className="text-[13px]" />
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

function StatementSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-secondary/40 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-secondary animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3 w-24 rounded-full bg-secondary animate-pulse" />
            <div className="h-2.5 w-32 rounded-full bg-secondary/60 animate-pulse" />
          </div>
          <div className="h-3.5 w-14 rounded-full bg-secondary animate-pulse shrink-0" />
        </div>
      ))}
    </>
  );
}

export function AccountStatement({ accountId }: { accountId: string }) {
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);

  const [limit, setLimit] = React.useState(10);
  const [range, setRange] = React.useState<RangeKey>("all");
  const [fromDate, setFromDate] = React.useState<Date | null>(null);
  const [toDate, setToDate] = React.useState<Date | null>(null);

  const { from, to } = React.useMemo(
    () => rangeToFromTo(range, fromDate, toDate),
    [range, fromDate, toDate]
  );

  const filters: TxFilters = React.useMemo(
    () => ({ accountId, accountSide: "both", from, to, sort: "date_desc", limit }),
    [accountId, from, to, limit]
  );
  const { data: list, isLoading } = useTransactions(filters);

  return (
    <section
      aria-label={f.t("acc.statement")}
      className="bg-card rounded-2xl card-soft p-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <History className="w-4 h-4" />
        </span>
        <div className="flex flex-col">
          <h2 className="text-[14px] font-bold text-foreground leading-tight">
            {f.t("acc.statement")}
          </h2>
          <p className="text-[10.5px] text-muted-foreground">{f.t("acc.statementDesc")}</p>
        </div>
      </div>

      {/* filters: count + date range */}
      <Field label={f.t("tx.countLabel")}>
        <SegmentedTabs
          value={String(limit)}
          onChange={(v) => setLimit(parseInt(v, 10))}
          options={[
            { value: "10", label: f.fa(10) },
            { value: "20", label: f.fa(20) },
            { value: "50", label: f.fa(50) },
          ]}
        />
      </Field>

      <Field label={f.t("tx.dateRange")}>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="h-11 rounded-2xl bg-card text-[13px] font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl bg-card">
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-[13px]">
                {f.t(o.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {range === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">{f.t("tx.dateFrom")}</span>
            <JalaliDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">{f.t("tx.dateTo")}</span>
            <JalaliDatePicker value={toDate} onChange={setToDate} />
          </div>
        </div>
      )}

      {/* rows */}
      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto app-screen-scroll -mx-1 px-1 pt-0.5">
        {isLoading ? (
          <StatementSkeleton />
        ) : !list || list.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-4">
            {f.t("acc.stmt.empty")}
          </p>
        ) : (
          list.map((tx) => (
            <StatementRow
              key={tx.id}
              tx={tx}
              accountId={accountId}
              onPress={() => push("transaction-details", { id: tx.id })}
            />
          ))
        )}
      </div>
    </section>
  );
}
