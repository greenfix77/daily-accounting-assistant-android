"use client";

import * as React from "react";
import { Search, SlidersHorizontal, ReceiptText, ArrowLeftRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useTransactions, useAccounts, useCategories, type TxFilters } from "@/lib/hooks";
import type { TransactionDTO, TxType } from "@/lib/types";
import {
  AmountText,
  EmptyState,
  Field,
  GradientButton,
  IconBubble,
  JalaliDatePicker,
  PillInput,
  SegmentedTabs,
  useAppFormat,
} from "@/components/app/ui";
import { endOfDay, startOfDay } from "@/lib/jalali";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_COLOR: Record<TxType, string> = {
  INCOME: "#4E9B72",
  EXPENSE: "#E5757A",
  TRANSFER: "#A78BCA",
};

type ListTab = "ALL" | "INCOME" | "EXPENSE";
type SortKey = NonNullable<TxFilters["sort"]>;

function typeLabel(t: TxType, f: ReturnType<typeof useAppFormat>): string {
  return t === "INCOME" ? f.t("tx.income") : t === "EXPENSE" ? f.t("tx.expense") : f.t("tx.transfer");
}

function txIcon(tx: TransactionDTO): string {
  return tx.categoryIcon ?? (tx.type === "INCOME" ? "banknote" : "shopping-cart");
}

function ListSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-card rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-28 rounded-full bg-secondary animate-pulse" />
            <div className="h-3 w-40 rounded-full bg-secondary/60 animate-pulse" />
          </div>
          <div className="h-4 w-16 rounded-full bg-secondary animate-pulse shrink-0" />
        </div>
      ))}
    </>
  );
}

function TxRow({ tx, onPress }: { tx: TransactionDTO; onPress: () => void }) {
  const f = useAppFormat();
  const isTransfer = tx.type === "TRANSFER";
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full text-start bg-card rounded-2xl p-3.5 flex items-center gap-3 card-soft active:scale-[0.99] transition-transform"
    >
      {isTransfer ? (
        <span
          className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
          style={{ backgroundColor: `${TYPE_COLOR.TRANSFER}1f`, color: TYPE_COLOR.TRANSFER }}
        >
          <ArrowLeftRight className="w-5 h-5" />
        </span>
      ) : (
        <IconBubble icon={txIcon(tx)} color={tx.categoryColor ?? TYPE_COLOR[tx.type]} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-foreground truncate">
          {tx.title ?? tx.categoryName ?? typeLabel(tx.type, f)}
        </p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {tx.walletId ? `${tx.walletName ?? f.t("tx.wallet")} • ` : ""}
          {tx.accountName}
          {tx.toAccountName ? ` ← ${tx.toAccountName}` : ""} • {f.dateShort(tx.date)}
        </p>
      </div>
      <span className="flex flex-col items-end gap-0.5 shrink-0">
        {isTransfer ? (
          <span dir="ltr" className="num-input text-[14px] font-bold text-[#A78BCA]">
            {f.money(tx.amount, false)}
          </span>
        ) : (
          <AmountText value={tx.amount} type={tx.type} className="text-[14px]" />
        )}
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

export default function TransactionsScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const push = useAppStore((s) => s.push);

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [tab, setTab] = React.useState<ListTab>("ALL");
  const [q, setQ] = React.useState("");
  const [accountId, setAccountId] = React.useState("all");
  const [categoryId, setCategoryId] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("date_desc");
  const [limit, setLimit] = React.useState(20);
  const [fromDate, setFromDate] = React.useState<Date | null>(null);
  const [toDate, setToDate] = React.useState<Date | null>(null);

  const { data: accounts } = useAccounts();
  const { data: allCategories } = useCategories();

  const filters: TxFilters = React.useMemo(
    () => ({
      type: tab === "ALL" ? undefined : tab,
      q: q.trim() || undefined,
      accountId: accountId === "all" ? undefined : accountId,
      categoryId: categoryId === "all" ? undefined : categoryId,
      from: fromDate ? startOfDay(fromDate).toISOString() : undefined,
      to: toDate ? endOfDay(toDate).toISOString() : undefined,
      sort,
      limit,
    }),
    [tab, q, accountId, categoryId, fromDate, toDate, sort, limit]
  );

  const { data: list, isLoading } = useTransactions(filters);

  const filtersActive =
    accountId !== "all" ||
    categoryId !== "all" ||
    sort !== "date_desc" ||
    limit !== 20 ||
    fromDate !== null ||
    toDate !== null;

  const clearFilters = () => {
    setAccountId("all");
    setCategoryId("all");
    setSort("date_desc");
    setLimit(20);
    setFromDate(null);
    setToDate(null);
  };
  const toggleSearch = () => {
    setSearchOpen((v) => {
      if (v) setQ("");
      return !v;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Tab-root header (no back) */}
      <header className="bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3 flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-extrabold text-foreground leading-tight flex-1">
            {f.t("tx.title")}
          </h1>
          <button
            type="button"
            onClick={toggleSearch}
            aria-label={f.t("common.search")}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
              searchOpen ? "bg-secondary text-primary" : "hover:bg-accent text-foreground"
            }`}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={f.t("tx.filters")}
            className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
              filtersActive ? "bg-secondary text-primary" : "hover:bg-accent text-foreground"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            {filtersActive && (
              <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
        </div>
        {searchOpen && (
          <div className="relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <PillInput
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={f.t("common.searchPlaceholder")}
              className="ps-10 h-11 text-[13px]"
            />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-3">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "ALL", label: f.t("tx.tabAll") },
            { value: "INCOME", label: f.t("tx.tabIncome") },
            { value: "EXPENSE", label: f.t("tx.tabExpense") },
          ]}
        />

        {isLoading ? (
          <ListSkeleton />
        ) : !list || list.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="w-7 h-7" />}
            title={f.t("tx.noResults")}
            desc={f.t("tx.noResultsDesc")}
            action={
              <GradientButton
                className="h-10 w-auto px-6 text-[13px] rounded-xl"
                onClick={() => push("transaction-form", { mode: "add" })}
              >
                {f.t("tx.add")}
              </GradientButton>
            }
          />
        ) : (
          list.map((tx) => (
            <TxRow
              key={tx.id}
              tx={tx}
              onPress={() => push("transaction-details", { id: tx.id })}
            />
          ))
        )}
      </div>

      {/* Filters dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-[340px] rounded-3xl bg-card card-soft max-h-[85vh] overflow-y-auto app-screen-scroll" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-[16px] text-start">{f.t("tx.filters")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label={f.t("tx.account")}>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-11 rounded-2xl bg-card text-[13px] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-card max-h-64">
                  <SelectItem value="all" className="text-[13px]">
                    {f.t("tx.accountAll")}
                  </SelectItem>
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-[13px]">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={f.t("tx.category")}>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11 rounded-2xl bg-card text-[13px] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-card max-h-64">
                  <SelectItem value="all" className="text-[13px]">
                    {f.t("tx.categoryAll")}
                  </SelectItem>
                  {(allCategories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-[13px]">
                      {c.name} · {c.type === "INCOME" ? f.t("tx.income") : f.t("tx.expense")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-11 rounded-2xl bg-card text-[13px] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl bg-card">
                  <SelectItem value="date_desc" className="text-[13px]">{f.t("tx.sortNewest")}</SelectItem>
                  <SelectItem value="date_asc" className="text-[13px]">{f.t("tx.sortOldest")}</SelectItem>
                  <SelectItem value="amount_desc" className="text-[13px]">{f.t("tx.sortHighest")}</SelectItem>
                  <SelectItem value="amount_asc" className="text-[13px]">{f.t("tx.sortLowest")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label={f.t("tx.countLabel")}>
              <SegmentedTabs
                value={String(limit)}
                onChange={(v) => setLimit(parseInt(v, 10))}
                options={[
                  { value: "20", label: f.fa(20) },
                  { value: "50", label: f.fa(50) },
                  { value: "100", label: f.fa(100) },
                ]}
              />
            </Field>

            <Field label={f.t("tx.dateRange")}>
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
            </Field>

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="w-full h-10 rounded-2xl text-[13px] font-bold text-expense bg-expense-soft hover:brightness-95 transition-all"
              >
                {f.t("tx.clearFilters")}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
