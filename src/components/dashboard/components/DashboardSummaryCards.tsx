"use client";

import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";
import { DASHBOARD_LABELS } from "../constants/dashboard.constants";
import type { DashboardSummaryCardsProps, ViewMode } from "../types/dashboard.types";

/**
 * Financial summary section with revenue, expenses, and profit cards
 * Includes month/total toggle and month selector
 */
function DashboardSummaryCardsComponent({
  summaryData,
  viewMode,
  selectedMonth,
  availableMonths,
  onViewModeChange,
  onMonthChange,
  unpaidReceivables,
  unpaidPayables,
}: DashboardSummaryCardsProps) {
  const { revenue, expenses, profit, isLoss } = summaryData;
  const hasUnpaidData = unpaidReceivables && unpaidPayables;

  return (
    <section aria-label={DASHBOARD_LABELS.financialSummary}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-700">{DASHBOARD_LABELS.financialSummary}</h2>
        <div className="flex items-center gap-3">
          {/* Month selector (only visible in monthly mode) */}
          {viewMode === "month" && (
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:border-slate-400 transition-colors"
              aria-label="Select month"
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          )}

          {/* View mode toggle */}
          <ViewModeToggle currentMode={viewMode} onModeChange={onViewModeChange} />
        </div>
      </div>

      {/* Summary cards grid - 4 columns when unpaid data is available */}
      <div className={`grid grid-cols-1 gap-4 ${hasUnpaidData ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
        <RevenueCard amount={revenue} />
        <ExpensesCard amount={expenses} />
        <ProfitCard amount={profit} isLoss={isLoss} />
        {hasUnpaidData && (
          <UnpaidCard
            unpaidReceivables={unpaidReceivables}
            unpaidPayables={unpaidPayables}
          />
        )}
      </div>
    </section>
  );
}

/** Toggle between monthly and total view */
function ViewModeToggle({
  currentMode,
  onModeChange,
}: {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex bg-slate-200 rounded-lg p-1" role="tablist">
      <button
        role="tab"
        aria-selected={currentMode === "month"}
        onClick={() => onModeChange("month")}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          currentMode === "month"
            ? "bg-white text-slate-800 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {DASHBOARD_LABELS.monthly}
      </button>
      <button
        role="tab"
        aria-selected={currentMode === "total"}
        onClick={() => onModeChange("total")}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          currentMode === "total"
            ? "bg-white text-slate-800 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {DASHBOARD_LABELS.total}
      </button>
    </div>
  );
}

/** Revenue card component - Clickable to drill down to income ledger entries */
function RevenueCard({ amount }: { amount: number }) {
  const router = useRouter();

  const handleClick = () => {
    router.push("/ledger?type=income");
  };

  return (
    <article
      className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer btn-press group"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`عرض الإيرادات - ${formatNumber(amount)} دينار`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{DASHBOARD_LABELS.revenue}</span>
        <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
          <ArrowUp className="w-5 h-5 text-emerald-600" aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-800">{formatNumber(amount)}</p>
      <p className="text-xs text-slate-400 mt-1 group-hover:text-emerald-500 transition-colors">
        {DASHBOARD_LABELS.currency} ← انقر للتفاصيل
      </p>
    </article>
  );
}

/** Expenses card component - Clickable to drill down to expense ledger entries */
function ExpensesCard({ amount }: { amount: number }) {
  const router = useRouter();

  const handleClick = () => {
    router.push("/ledger?type=expense");
  };

  return (
    <article
      className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer btn-press group"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`عرض المصروفات - ${formatNumber(amount)} دينار`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{DASHBOARD_LABELS.expenses}</span>
        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
          <ArrowDown className="w-5 h-5 text-slate-500" aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-800">{formatNumber(amount)}</p>
      <p className="text-xs text-slate-400 mt-1 group-hover:text-slate-600 transition-colors">
        {DASHBOARD_LABELS.currency} ← انقر للتفاصيل
      </p>
    </article>
  );
}

/** Profit/Loss card component - Clickable to view all ledger entries */
function ProfitCard({ amount, isLoss }: { amount: number; isLoss: boolean }) {
  const router = useRouter();

  const handleClick = () => {
    router.push("/ledger");
  };

  return (
    <article
      className={`rounded-xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer btn-press group ${
        isLoss ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`عرض ${isLoss ? "الخسارة" : "الربح"} - ${formatNumber(Math.abs(amount))} دينار`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{DASHBOARD_LABELS.netProfit}</span>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            isLoss ? "bg-rose-100 group-hover:bg-rose-200" : "bg-emerald-100 group-hover:bg-emerald-200"
          }`}
        >
          <span className={`text-sm font-bold ${isLoss ? "text-rose-600" : "text-emerald-600"}`}>
            {isLoss ? "−" : "+"}
          </span>
        </div>
      </div>
      <p className={`text-2xl font-semibold ${isLoss ? "text-rose-700" : "text-emerald-700"}`}>
        {formatNumber(Math.abs(amount))}
      </p>
      <p className={`text-xs mt-1 transition-colors ${isLoss ? "text-rose-500 group-hover:text-rose-600" : "text-emerald-500 group-hover:text-emerald-600"}`}>
        {isLoss ? DASHBOARD_LABELS.loss : DASHBOARD_LABELS.profit} ← انقر للتفاصيل
      </p>
    </article>
  );
}

/** Unpaid receivables card component */
function UnpaidCard({
  unpaidReceivables,
  unpaidPayables,
}: {
  unpaidReceivables: { count: number; total: number };
  unpaidPayables: { count: number; total: number };
}) {
  const totalUnpaidCount = unpaidReceivables.count + unpaidPayables.count;
  const totalUnpaidAmount = unpaidReceivables.total + unpaidPayables.total;

  return (
    <Link href="/ledger?paymentStatus=outstanding" className="block">
      <article
        className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer h-full"
        role="button"
        tabIndex={0}
        aria-label={`عرض ${totalUnpaidCount} ذمم غير محصلة`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-sm">ذمم غير محصلة</span>
          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center relative">
            <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
            {totalUnpaidCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalUnpaidCount}
              </span>
            )}
          </div>
        </div>
        <p className="text-2xl font-semibold text-amber-700">
          {formatNumber(totalUnpaidAmount)}
        </p>
        <p className="text-xs text-amber-600 mt-1">
          {totalUnpaidCount > 0 ? "اضغط للعرض ←" : "لا توجد ذمم"}
        </p>
      </article>
    </Link>
  );
}

export const DashboardSummaryCards = memo(DashboardSummaryCardsComponent);
