"use client";

import { memo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
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
}: DashboardSummaryCardsProps) {
  const { revenue, expenses, profit, isLoss } = summaryData;

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

      {/* Summary cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RevenueCard amount={revenue} />
        <ExpensesCard amount={expenses} />
        <ProfitCard amount={profit} isLoss={isLoss} />
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

/** Revenue card component */
function RevenueCard({ amount }: { amount: number }) {
  return (
    <article className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{DASHBOARD_LABELS.revenue}</span>
        <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
          <ArrowUp className="w-5 h-5 text-emerald-600" aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-800">{formatNumber(amount)}</p>
      <p className="text-xs text-slate-400 mt-1">{DASHBOARD_LABELS.currency}</p>
    </article>
  );
}

/** Expenses card component */
function ExpensesCard({ amount }: { amount: number }) {
  return (
    <article className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{DASHBOARD_LABELS.expenses}</span>
        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
          <ArrowDown className="w-5 h-5 text-slate-500" aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-800">{formatNumber(amount)}</p>
      <p className="text-xs text-slate-400 mt-1">{DASHBOARD_LABELS.currency}</p>
    </article>
  );
}

/** Profit/Loss card component */
function ProfitCard({ amount, isLoss }: { amount: number; isLoss: boolean }) {
  return (
    <article
      className={`rounded-xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer ${
        isLoss ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{DASHBOARD_LABELS.netProfit}</span>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isLoss ? "bg-rose-100" : "bg-emerald-100"
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
      <p className={`text-xs mt-1 ${isLoss ? "text-rose-500" : "text-emerald-500"}`}>
        {isLoss ? DASHBOARD_LABELS.loss : DASHBOARD_LABELS.profit}
      </p>
    </article>
  );
}

export const DashboardSummaryCards = memo(DashboardSummaryCardsComponent);
