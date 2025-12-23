"use client";

import { memo, useMemo } from "react";
import { ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import { LedgerEntry } from "../utils/ledger-constants";
import { isExcludedFromPL, isEquityTransaction } from "../utils/ledger-helpers";
import { formatNumber } from "@/lib/date-utils";

interface LedgerStatsProps {
  entries: LedgerEntry[];
  onUnpaidClick?: () => void;
}

/** Format number with thousands separator */
const formatAmount = (amount: number): string => {
  return formatNumber(amount);
};

function LedgerStatsComponent({ entries, onUnpaidClick }: LedgerStatsProps) {
  // Calculate totals with memoization
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalDiscounts = 0;
    let totalBadDebt = 0;
    let unpaidCount = 0;
    let unpaidAmount = 0;

    entries.forEach((entry) => {
      // Count unpaid/partial ARAP entries (excludes equity, includes advances like سلفة مورد)
      // Advances represent receivables/payables that need collection
      const isEquity = isEquityTransaction(entry.type, entry.category);
      if (entry.isARAPEntry && entry.paymentStatus !== "paid" && !isEquity) {
        unpaidCount++;
        unpaidAmount += entry.remainingBalance || 0;
      }

      // Skip equity AND advance transactions from P&L calculations
      // Advances (سلفة مورد, سلفة عميل) are prepaid credits, not income/expense
      if (isExcludedFromPL(entry.type, entry.category)) {
        return;
      }

      if (entry.type === "دخل") {
        totalIncome += entry.amount || 0;
        // Track discounts (contra-revenue, reduces net income)
        if (entry.totalDiscount) {
          totalDiscounts += entry.totalDiscount;
        }
        // Track bad debt write-offs (reduces profit)
        if (entry.writeoffAmount) {
          totalBadDebt += entry.writeoffAmount;
        }
      } else if (entry.type === "مصروف") {
        totalExpenses += entry.amount || 0;
      }
    });

    // Net balance formula matches Dashboard: (income - discounts) - expenses - badDebt
    const netBalance = (totalIncome - totalDiscounts) - totalExpenses - totalBadDebt;

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      unpaidCount,
      unpaidAmount,
    };
  }, [entries]);

  const isProfit = stats.netBalance >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Income Card */}
      <article className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-sm">إجمالي الدخل</span>
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <ArrowUp className="w-5 h-5 text-emerald-600" aria-hidden="true" />
          </div>
        </div>
        <p className="text-2xl font-bold text-emerald-600">
          {formatAmount(stats.totalIncome)}
        </p>
        <p className="text-xs text-slate-400 mt-1">دينار</p>
      </article>

      {/* Total Expenses Card */}
      <article className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-sm">إجمالي المصروفات</span>
          <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
            <ArrowDown className="w-5 h-5 text-rose-600" aria-hidden="true" />
          </div>
        </div>
        <p className="text-2xl font-bold text-rose-600">
          {formatAmount(stats.totalExpenses)}
        </p>
        <p className="text-xs text-slate-400 mt-1">دينار</p>
      </article>

      {/* Net Balance Card */}
      <article
        className={`rounded-xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default ${
          isProfit
            ? "bg-emerald-50 border-emerald-200"
            : "bg-rose-50 border-rose-200"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-sm">الرصيد الصافي</span>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isProfit ? "bg-emerald-100" : "bg-rose-100"
            }`}
          >
            <span
              className={`text-lg font-bold ${
                isProfit ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isProfit ? "+" : "−"}
            </span>
          </div>
        </div>
        <p
          className={`text-2xl font-bold ${
            isProfit ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {formatAmount(Math.abs(stats.netBalance))}
        </p>
        <p
          className={`text-xs mt-1 ${
            isProfit ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {isProfit ? "ربح" : "خسارة"}
        </p>
      </article>

      {/* Unpaid Receivables Card - Clickable */}
      <article
        onClick={onUnpaidClick}
        className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onUnpaidClick?.();
          }
        }}
        aria-label={`عرض ${stats.unpaidCount} ذمم غير محصلة`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-sm">ذمم غير محصلة</span>
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center relative">
            <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
            {stats.unpaidCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {stats.unpaidCount}
              </span>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold text-amber-700">
          {formatAmount(stats.unpaidAmount)}
        </p>
        <p className="text-xs text-amber-600 mt-1">
          {stats.unpaidCount > 0 ? "اضغط للعرض ←" : "لا توجد ذمم"}
        </p>
      </article>
    </div>
  );
}

export const LedgerStats = memo(LedgerStatsComponent);
