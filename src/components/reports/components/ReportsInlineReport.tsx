"use client";

import { memo, useMemo } from "react";
import { X, TrendingUp, TrendingDown, Clock, DollarSign, PieChart, BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  subCategory?: string;
  date: Date;
  paymentStatus?: string;
  remainingBalance?: number;
}

interface ReportsInlineReportProps {
  reportId: string | null;
  onClose: () => void;
  ledgerEntries: LedgerEntry[];
  filteredData: {
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
  };
  dateRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Inline report content displayed below Quick Reports cards
 */
function ReportsInlineReportComponent({
  reportId,
  onClose,
  ledgerEntries,
  filteredData,
  dateRange,
}: ReportsInlineReportProps) {
  if (!reportId) {
    return null;
  }

  const reportConfig: Record<string, { title: string; icon: React.ReactNode; color: string }> = {
    income: {
      title: "قائمة الدخل",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "emerald",
    },
    aging: {
      title: "أعمار الذمم",
      icon: <Clock className="w-5 h-5" />,
      color: "blue",
    },
    expenses: {
      title: "تحليل المصروفات",
      icon: <PieChart className="w-5 h-5" />,
      color: "amber",
    },
    cashflow: {
      title: "التدفقات النقدية",
      icon: <BarChart3 className="w-5 h-5" />,
      color: "purple",
    },
  };

  const config = reportConfig[reportId];
  if (!config) {
    return null;
  }

  const colorClasses: Record<string, string> = {
    emerald: "border-emerald-500 bg-emerald-50",
    blue: "border-blue-500 bg-blue-50",
    amber: "border-amber-500 bg-amber-50",
    purple: "border-purple-500 bg-purple-50",
  };

  return (
    <div
      className={`bg-white rounded-xl border-2 ${colorClasses[config.color]} overflow-hidden animate-in slide-in-from-top-2 duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${config.color}-100 text-${config.color}-600`}>
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{config.title}</h3>
            <p className="text-sm text-slate-500">
              {dateRange.start.toLocaleDateString("ar-JO")} - {dateRange.end.toLocaleDateString("ar-JO")}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 bg-white">
        {reportId === "income" && (
          <IncomeStatementReport filteredData={filteredData} />
        )}
        {reportId === "aging" && (
          <AgingReport ledgerEntries={ledgerEntries} dateRange={dateRange} />
        )}
        {reportId === "expenses" && (
          <ExpenseAnalysisReport ledgerEntries={ledgerEntries} filteredData={filteredData} dateRange={dateRange} />
        )}
        {reportId === "cashflow" && (
          <CashFlowReport ledgerEntries={ledgerEntries} dateRange={dateRange} />
        )}
      </div>
    </div>
  );
}

/**
 * Income Statement Report
 */
function IncomeStatementReport({
  filteredData,
}: {
  filteredData: ReportsInlineReportProps["filteredData"];
}) {
  const isProfit = filteredData.netProfit >= 0;

  return (
    <div className="space-y-6">
      {/* Revenue Section */}
      <div>
        <h4 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          الإيرادات
        </h4>
        <div className="space-y-2">
          {Object.entries(filteredData.revenueByCategory).length > 0 ? (
            Object.entries(filteredData.revenueByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <span className="text-sm text-slate-700">{category}</span>
                  <span className="text-sm font-semibold text-emerald-700">{formatNumber(amount)} د.أ</span>
                </div>
              ))
          ) : (
            <p className="text-sm text-slate-400 p-3">لا توجد إيرادات في هذه الفترة</p>
          )}
          <div className="flex items-center justify-between p-3 bg-emerald-200 rounded-lg mt-2">
            <span className="text-sm font-bold text-emerald-800">إجمالي الإيرادات</span>
            <span className="text-sm font-bold text-emerald-800">{formatNumber(filteredData.totalRevenue)} د.أ</span>
          </div>
        </div>
      </div>

      {/* Expenses Section */}
      <div>
        <h4 className="text-sm font-semibold text-rose-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-rose-500 rounded-full" />
          المصروفات
        </h4>
        <div className="space-y-2">
          {Object.entries(filteredData.expensesByCategory).length > 0 ? (
            Object.entries(filteredData.expensesByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
                  <span className="text-sm text-slate-700">{category}</span>
                  <span className="text-sm font-semibold text-rose-700">{formatNumber(amount)} د.أ</span>
                </div>
              ))
          ) : (
            <p className="text-sm text-slate-400 p-3">لا توجد مصروفات في هذه الفترة</p>
          )}
          <div className="flex items-center justify-between p-3 bg-rose-200 rounded-lg mt-2">
            <span className="text-sm font-bold text-rose-800">إجمالي المصروفات</span>
            <span className="text-sm font-bold text-rose-800">{formatNumber(filteredData.totalExpenses)} د.أ</span>
          </div>
        </div>
      </div>

      {/* Net Income */}
      <div className={`p-4 rounded-xl ${isProfit ? "bg-emerald-100 border-2 border-emerald-300" : "bg-rose-100 border-2 border-rose-300"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isProfit ? (
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-600" />
            )}
            <span className={`font-bold ${isProfit ? "text-emerald-800" : "text-rose-800"}`}>
              {isProfit ? "صافي الربح" : "صافي الخسارة"}
            </span>
          </div>
          <span className={`text-xl font-bold ${isProfit ? "text-emerald-700" : "text-rose-700"}`}>
            {formatNumber(Math.abs(filteredData.netProfit))} د.أ
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Aging Report - Receivables and Payables by age
 */
function AgingReport({
  ledgerEntries,
  dateRange,
}: {
  ledgerEntries: LedgerEntry[];
  dateRange: { start: Date; end: Date };
}) {
  const agingData = useMemo(() => {
    const now = new Date();
    const buckets = {
      receivables: { "0-30": { count: 0, amount: 0 }, "31-60": { count: 0, amount: 0 }, "61-90": { count: 0, amount: 0 }, "90+": { count: 0, amount: 0 } },
      payables: { "0-30": { count: 0, amount: 0 }, "31-60": { count: 0, amount: 0 }, "61-90": { count: 0, amount: 0 }, "90+": { count: 0, amount: 0 } },
    };

    // Filter entries by date range and unpaid status
    ledgerEntries.forEach((entry) => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      if (entryDate < dateRange.start || entryDate > dateRange.end) {
        return;
      }

      // Skip if fully paid
      if (entry.paymentStatus === "مدفوع" || entry.paymentStatus === "مكتمل") {
        return;
      }

      const balance = entry.remainingBalance ?? entry.amount;
      if (balance <= 0) {
        return;
      }

      const daysDiff = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

      let bucket: "0-30" | "31-60" | "61-90" | "90+";
      if (daysDiff <= 30) {
        bucket = "0-30";
      } else if (daysDiff <= 60) {
        bucket = "31-60";
      } else if (daysDiff <= 90) {
        bucket = "61-90";
      } else {
        bucket = "90+";
      }

      // Receivables = Income entries (money owed TO us)
      // Payables = Expense entries (money we OWE)
      if (entry.type === "دخل") {
        buckets.receivables[bucket].count++;
        buckets.receivables[bucket].amount += balance;
      } else if (entry.type === "مصروف") {
        buckets.payables[bucket].count++;
        buckets.payables[bucket].amount += balance;
      }
    });

    return buckets;
  }, [ledgerEntries, dateRange]);

  const totalReceivables = Object.values(agingData.receivables).reduce((sum, b) => sum + b.amount, 0);
  const totalPayables = Object.values(agingData.payables).reduce((sum, b) => sum + b.amount, 0);

  const bucketLabels = {
    "0-30": "0-30 يوم",
    "31-60": "31-60 يوم",
    "61-90": "61-90 يوم",
    "90+": "90+ يوم",
  };

  const bucketColors = {
    "0-30": "bg-emerald-100 text-emerald-700",
    "31-60": "bg-amber-100 text-amber-700",
    "61-90": "bg-orange-100 text-orange-700",
    "90+": "bg-rose-100 text-rose-700",
  };

  return (
    <div className="space-y-6">
      {/* Receivables */}
      <div>
        <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          ذمم مدينة - لنا (مبالغ مستحقة من العملاء)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(agingData.receivables) as [keyof typeof bucketLabels, { count: number; amount: number }][]).map(
            ([bucket, data]) => (
              <div key={bucket} className={`p-3 rounded-lg ${bucketColors[bucket]}`}>
                <p className="text-xs font-medium mb-1">{bucketLabels[bucket]}</p>
                <p className="text-lg font-bold">{formatNumber(data.amount)} د.أ</p>
                <p className="text-xs opacity-75">{data.count} معاملة</p>
              </div>
            )
          )}
        </div>
        <div className="flex items-center justify-between p-3 bg-blue-200 rounded-lg mt-3">
          <span className="text-sm font-bold text-blue-800">إجمالي الذمم المدينة</span>
          <span className="text-sm font-bold text-blue-800">{formatNumber(totalReceivables)} د.أ</span>
        </div>
      </div>

      {/* Payables */}
      <div>
        <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full" />
          ذمم دائنة - علينا (مبالغ مستحقة للموردين)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(agingData.payables) as [keyof typeof bucketLabels, { count: number; amount: number }][]).map(
            ([bucket, data]) => (
              <div key={bucket} className={`p-3 rounded-lg ${bucketColors[bucket]}`}>
                <p className="text-xs font-medium mb-1">{bucketLabels[bucket]}</p>
                <p className="text-lg font-bold">{formatNumber(data.amount)} د.أ</p>
                <p className="text-xs opacity-75">{data.count} معاملة</p>
              </div>
            )
          )}
        </div>
        <div className="flex items-center justify-between p-3 bg-purple-200 rounded-lg mt-3">
          <span className="text-sm font-bold text-purple-800">إجمالي الذمم الدائنة</span>
          <span className="text-sm font-bold text-purple-800">{formatNumber(totalPayables)} د.أ</span>
        </div>
      </div>

      {/* Net Position */}
      <div className={`p-4 rounded-xl ${totalReceivables >= totalPayables ? "bg-blue-100 border-2 border-blue-300" : "bg-purple-100 border-2 border-purple-300"}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800">صافي المركز</span>
          <span className={`text-xl font-bold ${totalReceivables >= totalPayables ? "text-blue-700" : "text-purple-700"}`}>
            {totalReceivables >= totalPayables ? "+" : "-"}{formatNumber(Math.abs(totalReceivables - totalPayables))} د.أ
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          {totalReceivables >= totalPayables
            ? "لديك مستحقات أكثر من الالتزامات"
            : "لديك التزامات أكثر من المستحقات"}
        </p>
      </div>
    </div>
  );
}

/**
 * Expense Analysis with subcategory drill-down
 */
function ExpenseAnalysisReport({
  ledgerEntries,
  filteredData,
  dateRange,
}: {
  ledgerEntries: LedgerEntry[];
  filteredData: ReportsInlineReportProps["filteredData"];
  dateRange: { start: Date; end: Date };
}) {
  const expensesBySubcategory = useMemo(() => {
    const result: Record<string, { total: number; subcategories: Record<string, number> }> = {};

    ledgerEntries.forEach((entry) => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      if (entryDate < dateRange.start || entryDate > dateRange.end) {
        return;
      }
      if (entry.type !== "مصروف") {
        return;
      }
      if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
        return;
      }

      if (!result[entry.category]) {
        result[entry.category] = { total: 0, subcategories: {} };
      }

      result[entry.category].total += entry.amount;

      const subcat = entry.subCategory || "أخرى";
      result[entry.category].subcategories[subcat] =
        (result[entry.category].subcategories[subcat] || 0) + entry.amount;
    });

    return result;
  }, [ledgerEntries, dateRange]);

  const sortedCategories = Object.entries(expensesBySubcategory)
    .sort(([, a], [, b]) => b.total - a.total);

  const categoryColors = [
    "bg-rose-500", "bg-amber-500", "bg-purple-500", "bg-blue-500",
    "bg-teal-500", "bg-indigo-500", "bg-pink-500", "bg-cyan-500"
  ];

  return (
    <div className="space-y-4">
      {/* Total Expenses */}
      <div className="p-4 bg-rose-100 rounded-xl border-2 border-rose-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-rose-600" />
            <span className="font-bold text-rose-800">إجمالي المصروفات</span>
          </div>
          <span className="text-xl font-bold text-rose-700">{formatNumber(filteredData.totalExpenses)} د.أ</span>
        </div>
      </div>

      {/* Categories with subcategories */}
      {sortedCategories.length > 0 ? (
        <div className="space-y-3">
          {sortedCategories.map(([category, data], index) => {
            const percent = filteredData.totalExpenses > 0
              ? (data.total / filteredData.totalExpenses) * 100
              : 0;
            const colorClass = categoryColors[index % categoryColors.length];

            return (
              <div key={category} className="bg-slate-50 rounded-lg overflow-hidden">
                {/* Category Header */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${colorClass}`} />
                      <span className="font-semibold text-slate-800">{category}</span>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-slate-800">{formatNumber(data.total)} د.أ</span>
                      <span className="text-xs text-slate-500 mr-2">({percent.toFixed(1)}%)</span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colorClass} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Subcategories */}
                {Object.keys(data.subcategories).length > 1 && (
                  <div className="px-3 pb-3">
                    <div className="border-t border-slate-200 pt-2 mt-1">
                      <p className="text-xs text-slate-500 mb-2">التفاصيل:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(data.subcategories)
                          .sort(([, a], [, b]) => b - a)
                          .map(([subcat, amount]) => (
                            <div key={subcat} className="flex items-center justify-between text-xs p-2 bg-white rounded">
                              <span className="text-slate-600">↳ {subcat}</span>
                              <span className="font-medium text-slate-800">{formatNumber(amount)} د.أ</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-400 text-center py-4">لا توجد مصروفات في هذه الفترة</p>
      )}
    </div>
  );
}

/**
 * Cash Flow Report
 */
function CashFlowReport({
  ledgerEntries,
  dateRange,
}: {
  ledgerEntries: LedgerEntry[];
  dateRange: { start: Date; end: Date };
}) {
  const cashFlowData = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    const inByCategory: Record<string, number> = {};
    const outByCategory: Record<string, number> = {};

    ledgerEntries.forEach((entry) => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      if (entryDate < dateRange.start || entryDate > dateRange.end) {
        return;
      }

      // Skip owner equity
      if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
        return;
      }

      // For cash flow, we consider paid transactions as actual cash movement
      // If unpaid, it's not cash flow yet
      if (entry.paymentStatus === "معلق" || entry.paymentStatus === "Pending") {
        return;
      }

      if (entry.type === "دخل") {
        cashIn += entry.amount;
        inByCategory[entry.category] = (inByCategory[entry.category] || 0) + entry.amount;
      } else if (entry.type === "مصروف") {
        cashOut += entry.amount;
        outByCategory[entry.category] = (outByCategory[entry.category] || 0) + entry.amount;
      }
    });

    return { cashIn, cashOut, netCashFlow: cashIn - cashOut, inByCategory, outByCategory };
  }, [ledgerEntries, dateRange]);

  const isPositive = cashFlowData.netCashFlow >= 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-emerald-100 rounded-xl">
          <p className="text-xs text-emerald-600 mb-1">النقد الوارد</p>
          <p className="text-xl font-bold text-emerald-700">{formatNumber(cashFlowData.cashIn)} د.أ</p>
        </div>
        <div className="p-4 bg-rose-100 rounded-xl">
          <p className="text-xs text-rose-600 mb-1">النقد الصادر</p>
          <p className="text-xl font-bold text-rose-700">{formatNumber(cashFlowData.cashOut)} د.أ</p>
        </div>
        <div className={`p-4 rounded-xl ${isPositive ? "bg-blue-100" : "bg-amber-100"}`}>
          <p className={`text-xs ${isPositive ? "text-blue-600" : "text-amber-600"} mb-1`}>صافي التدفق</p>
          <p className={`text-xl font-bold ${isPositive ? "text-blue-700" : "text-amber-700"}`}>
            {isPositive ? "+" : ""}{formatNumber(cashFlowData.netCashFlow)} د.أ
          </p>
        </div>
      </div>

      {/* Cash In Details */}
      <div>
        <h4 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          تفاصيل النقد الوارد
        </h4>
        <div className="space-y-2">
          {Object.entries(cashFlowData.inByCategory).length > 0 ? (
            Object.entries(cashFlowData.inByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                  <span className="text-sm text-slate-700">{category}</span>
                  <span className="text-sm font-medium text-emerald-700">{formatNumber(amount)} د.أ</span>
                </div>
              ))
          ) : (
            <p className="text-sm text-slate-400 p-2">لا يوجد نقد وارد في هذه الفترة</p>
          )}
        </div>
      </div>

      {/* Cash Out Details */}
      <div>
        <h4 className="text-sm font-semibold text-rose-700 mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4" />
          تفاصيل النقد الصادر
        </h4>
        <div className="space-y-2">
          {Object.entries(cashFlowData.outByCategory).length > 0 ? (
            Object.entries(cashFlowData.outByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between p-2 bg-rose-50 rounded">
                  <span className="text-sm text-slate-700">{category}</span>
                  <span className="text-sm font-medium text-rose-700">{formatNumber(amount)} د.أ</span>
                </div>
              ))
          ) : (
            <p className="text-sm text-slate-400 p-2">لا يوجد نقد صادر في هذه الفترة</p>
          )}
        </div>
      </div>

      {/* Cash Flow Status */}
      <div className={`p-4 rounded-xl border-2 ${isPositive ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300"}`}>
        <p className={`text-sm ${isPositive ? "text-emerald-700" : "text-amber-700"}`}>
          {isPositive
            ? "تدفق نقدي إيجابي - النقد الوارد يتجاوز النقد الصادر"
            : "تدفق نقدي سلبي - النقد الصادر يتجاوز النقد الوارد"}
        </p>
      </div>
    </div>
  );
}

export const ReportsInlineReport = memo(ReportsInlineReportComponent);
