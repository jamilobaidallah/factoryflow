"use client";

import { memo, useMemo } from "react";
import { X, TrendingUp, TrendingDown, Clock, DollarSign, PieChart, BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";
import {
  isEquityTransaction,
  isLoanTransaction,
  isCapitalContribution,
  isOwnerDrawing,
  getLoanCashDirection,
} from "@/components/ledger/utils/ledger-helpers";

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  subCategory?: string;
  date: Date;
  paymentStatus?: string;
  remainingBalance?: number;
  totalPaid?: number;
  isARAPEntry?: boolean;
  totalDiscount?: number;
  writeoffAmount?: number;
}

interface Payment {
  id: string;
  amount: number;
  type: string;
  date: Date;
  linkedTransactionId?: string;
  isEndorsement?: boolean;
  noCashMovement?: boolean;
}

interface ReportsInlineReportProps {
  reportId: string | null;
  onClose: () => void;
  ledgerEntries: LedgerEntry[];
  payments: Payment[];
  filteredData: {
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
    totalRevenue: number;
    totalExpenses: number;
    totalDiscounts: number;
    totalBadDebt: number;
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
  payments,
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
          <CashFlowReport ledgerEntries={ledgerEntries} payments={payments} dateRange={dateRange} />
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
  const hasDiscounts = filteredData.totalDiscounts > 0;
  const hasBadDebt = filteredData.totalBadDebt > 0;
  const netRevenue = filteredData.totalRevenue - filteredData.totalDiscounts;

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

          {/* Discounts Section - shows how we get from gross to net */}
          {hasDiscounts && (
            <>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <span className="text-sm text-amber-700">خصومات التسوية</span>
                <span className="text-sm font-semibold text-amber-700">-{formatNumber(filteredData.totalDiscounts)} د.أ</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-100 rounded-lg border border-emerald-300">
                <span className="text-sm font-bold text-emerald-800">صافي الإيرادات</span>
                <span className="text-sm font-bold text-emerald-800">{formatNumber(netRevenue)} د.أ</span>
              </div>
            </>
          )}
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

      {/* Bad Debt Section - Treated as expense */}
      {hasBadDebt && (
        <div>
          <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full" />
            ديون معدومة
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm text-slate-700">شطب ديون غير قابلة للتحصيل</span>
              <span className="text-sm font-semibold text-orange-700">-{formatNumber(filteredData.totalBadDebt)} د.أ</span>
            </div>
          </div>
        </div>
      )}

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
 * Cash Flow Report - Includes Operating and Financing Activities
 * Operating cash is calculated from PAYMENTS (excludes endorsements with noCashMovement)
 * Financing activities are calculated from LEDGER (equity + loan transactions)
 */
function CashFlowReport({
  ledgerEntries,
  payments,
  dateRange,
}: {
  ledgerEntries: LedgerEntry[];
  payments: Payment[];
  dateRange: { start: Date; end: Date };
}) {
  const cashFlowData = useMemo(() => {
    // Operating Activities - from PAYMENTS collection
    // IMPORTANT: Skip payments with noCashMovement (endorsements don't move actual cash)
    let operatingIn = 0;
    let operatingOut = 0;

    payments.forEach((payment) => {
      const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
      if (paymentDate < dateRange.start || paymentDate > dateRange.end) {
        return;
      }

      // Skip endorsement payments - they don't involve actual cash movement
      if (payment.isEndorsement || payment.noCashMovement) {
        return;
      }

      if (payment.type === "قبض") {
        operatingIn += payment.amount;
      } else if (payment.type === "صرف") {
        operatingOut += payment.amount;
      }
    });

    // Financing Activities (equity + loans) - from LEDGER
    let capitalIn = 0;    // رأس مال مالك
    let capitalOut = 0;   // سحوبات المالك
    let loanCashIn = 0;   // Loans received + loan collections
    let loanCashOut = 0;  // Loans given + loan repayments

    ledgerEntries.forEach((entry) => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      if (entryDate < dateRange.start || entryDate > dateRange.end) {
        return;
      }

      // Check for equity transactions using helper function
      if (isEquityTransaction(entry.type, entry.category)) {
        // Financing activities - direction by subcategory
        if (isCapitalContribution(entry.subCategory)) {
          capitalIn += entry.amount;
        } else if (isOwnerDrawing(entry.subCategory)) {
          capitalOut += entry.amount;
        }
      }

      // Check for loan transactions using helper function
      if (isLoanTransaction(entry.type, entry.category)) {
        const cashDirection = getLoanCashDirection(entry.subCategory);
        if (cashDirection === "in") {
          loanCashIn += entry.amount;
        } else if (cashDirection === "out") {
          loanCashOut += entry.amount;
        }
      }
    });

    const netOperating = operatingIn - operatingOut;
    const netFinancing = (capitalIn + loanCashIn) - (capitalOut + loanCashOut);
    const totalCashFlow = netOperating + netFinancing;

    return {
      operatingIn,
      operatingOut,
      netOperating,
      capitalIn,
      capitalOut,
      loanCashIn,
      loanCashOut,
      netFinancing,
      totalCashFlow,
    };
  }, [ledgerEntries, payments, dateRange]);

  const isTotalPositive = cashFlowData.totalCashFlow >= 0;

  return (
    <div className="space-y-6">
      {/* Operating Activities Section */}
      <div className="bg-slate-50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">الأنشطة التشغيلية</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <p className="text-xs text-emerald-600 mb-1">النقد الوارد</p>
            <p className="text-lg font-bold text-emerald-700">{formatNumber(cashFlowData.operatingIn)} د.أ</p>
          </div>
          <div className="p-3 bg-rose-100 rounded-lg">
            <p className="text-xs text-rose-600 mb-1">النقد الصادر</p>
            <p className="text-lg font-bold text-rose-700">{formatNumber(cashFlowData.operatingOut)} د.أ</p>
          </div>
          <div className={`p-3 rounded-lg ${cashFlowData.netOperating >= 0 ? "bg-blue-100" : "bg-amber-100"}`}>
            <p className={`text-xs ${cashFlowData.netOperating >= 0 ? "text-blue-600" : "text-amber-600"} mb-1`}>صافي التشغيلي</p>
            <p className={`text-lg font-bold ${cashFlowData.netOperating >= 0 ? "text-blue-700" : "text-amber-700"}`}>
              {formatNumber(cashFlowData.netOperating)} د.أ
            </p>
          </div>
        </div>
      </div>

      {/* Financing Activities Section */}
      <div className="bg-purple-50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-purple-700 mb-3">الأنشطة التمويلية</h4>

        {/* Owner's Capital */}
        <p className="text-xs font-medium text-slate-500 mb-2">رأس المال</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <p className="text-xs text-emerald-600 mb-1">رأس مال مالك (وارد)</p>
            <p className="text-lg font-bold text-emerald-700">{formatNumber(cashFlowData.capitalIn)} د.أ</p>
          </div>
          <div className="p-3 bg-rose-100 rounded-lg">
            <p className="text-xs text-rose-600 mb-1">سحوبات المالك (صادر)</p>
            <p className="text-lg font-bold text-rose-700">{formatNumber(cashFlowData.capitalOut)} د.أ</p>
          </div>
        </div>

        {/* Loans */}
        <p className="text-xs font-medium text-slate-500 mb-2">القروض</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <p className="text-xs text-emerald-600 mb-1">قروض مستلمة + تحصيلات (وارد)</p>
            <p className="text-lg font-bold text-emerald-700">{formatNumber(cashFlowData.loanCashIn)} د.أ</p>
          </div>
          <div className="p-3 bg-rose-100 rounded-lg">
            <p className="text-xs text-rose-600 mb-1">قروض ممنوحة + سداد (صادر)</p>
            <p className="text-lg font-bold text-rose-700">{formatNumber(cashFlowData.loanCashOut)} د.أ</p>
          </div>
        </div>

        {/* Net Financing */}
        <div className={`p-3 rounded-lg ${cashFlowData.netFinancing >= 0 ? "bg-purple-100" : "bg-amber-100"}`}>
          <p className={`text-xs ${cashFlowData.netFinancing >= 0 ? "text-purple-600" : "text-amber-600"} mb-1`}>صافي التمويلي</p>
          <p className={`text-lg font-bold ${cashFlowData.netFinancing >= 0 ? "text-purple-700" : "text-amber-700"}`}>
            {formatNumber(cashFlowData.netFinancing)} د.أ
          </p>
        </div>
      </div>

      {/* Total Cash Balance */}
      <div className={`p-4 rounded-xl border-2 ${isTotalPositive ? "bg-slate-100 border-slate-300" : "bg-rose-50 border-rose-300"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">إجمالي الرصيد النقدي</p>
            <p className="text-xs text-slate-400">(تشغيلي + تمويلي)</p>
          </div>
          <p className={`text-2xl font-bold ${isTotalPositive ? "text-slate-800" : "text-rose-700"}`}>
            {formatNumber(cashFlowData.totalCashFlow)} د.أ
          </p>
        </div>
      </div>

      {/* Cash Flow Status */}
      <div className={`p-4 rounded-xl border-2 ${isTotalPositive ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300"}`}>
        <p className={`text-sm ${isTotalPositive ? "text-emerald-700" : "text-amber-700"}`}>
          {isTotalPositive
            ? "تدفق نقدي إيجابي - إجمالي الوارد يتجاوز إجمالي الصادر"
            : "تدفق نقدي سلبي - إجمالي الصادر يتجاوز إجمالي الوارد"}
        </p>
      </div>
    </div>
  );
}

export const ReportsInlineReport = memo(ReportsInlineReportComponent);
