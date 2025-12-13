"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowUp, ArrowDown, Check, AlertCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { toDate } from "@/lib/firestore-utils";
import { formatNumber } from "@/lib/date-utils";

// Types
interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: Date;
  associatedParty?: string;
  description?: string;
  paymentStatus?: "paid" | "unpaid" | "partial";
  remainingBalance?: number;
  isARAPEntry?: boolean;
}

interface Cheque {
  id: string;
  chequeNumber: string;
  clientName: string;
  amount: number;
  status: string;
  dueDate: Date;
}

interface MonthlyData {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  revenueFormatted: string;
  expensesFormatted: string;
}

interface ExpenseCategory {
  id: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
  offset: number;
}

// Color palette for expense categories
const EXPENSE_COLORS = [
  "#475569", // slate-600
  "#0d9488", // teal-600
  "#d97706", // amber-600
  "#7c7c8a", // zinc-500
  "#6366f1", // indigo-500
];

export default function DashboardPage() {
  const { user } = useUser();

  // Toggle states
  const [summaryView, setSummaryView] = useState<"month" | "total">("month");
  const [expenseView, setExpenseView] = useState<"month" | "total">("month");
  const [chartPeriod, setChartPeriod] = useState<"1" | "3" | "6">("3");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Animation states
  const [isLoaded, setIsLoaded] = useState(false);
  const [cashDisplay, setCashDisplay] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Data states
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [monthlyDataMap, setMonthlyDataMap] = useState<Map<string, { revenue: number; expenses: number }>>(new Map());
  const [expensesByCategoryMap, setExpensesByCategoryMap] = useState<Map<string, { total: number; monthly: Map<string, number> }>>(new Map());
  const [recentTransactions, setRecentTransactions] = useState<LedgerEntry[]>([]);

  // Alerts data
  const [chequesDueSoon, setChequesDueSoon] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const [unpaidReceivables, setUnpaidReceivables] = useState<{ count: number; total: number }>({ count: 0, total: 0 });

  // Generate available months for dropdown
  const availableMonths = useMemo(() => {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      months.push({ value, label });
    }
    return months;
  }, []);

  // Animate on load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Animate cash counter
  useEffect(() => {
    const cashBalance = totalCashIn - totalCashOut;
    const target = Math.abs(cashBalance);

    if (target === 0) {
      setCashDisplay(0);
      return;
    }

    let start = 0;
    const duration = 1500;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCashDisplay(target);
        clearInterval(timer);
      } else {
        setCashDisplay(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [totalCashIn, totalCashOut]);

  // Load ledger data
  useEffect(() => {
    if (!user) return;

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    const unsubscribe = onSnapshot(ledgerRef, (snapshot) => {
      let revenue = 0;
      let expenses = 0;
      const transactions: LedgerEntry[] = [];
      const monthlyMap = new Map<string, { revenue: number; expenses: number }>();
      const categoryMap = new Map<string, { total: number; monthly: Map<string, number> }>();
      let unpaidCount = 0;
      let unpaidTotal = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const entry: LedgerEntry = {
          id: doc.id,
          type: data.type || "",
          amount: data.amount || 0,
          category: data.category || "",
          date: toDate(data.date),
          associatedParty: data.associatedParty,
          description: data.description,
          paymentStatus: data.paymentStatus,
          remainingBalance: data.remainingBalance,
          isARAPEntry: data.isARAPEntry,
        };

        // Exclude owner equity from P&L
        const isOwnerEquity = entry.category === "رأس المال" || entry.category === "Owner Equity";

        if (!isOwnerEquity) {
          const monthKey = `${entry.date.getUTCFullYear()}-${String(entry.date.getUTCMonth() + 1).padStart(2, "0")}`;

          if (entry.type === "دخل" || entry.type === "إيراد") {
            revenue += entry.amount;

            // Monthly aggregation
            const existing = monthlyMap.get(monthKey) || { revenue: 0, expenses: 0 };
            existing.revenue += entry.amount;
            monthlyMap.set(monthKey, existing);
          } else if (entry.type === "مصروف") {
            expenses += entry.amount;

            // Monthly aggregation
            const existing = monthlyMap.get(monthKey) || { revenue: 0, expenses: 0 };
            existing.expenses += entry.amount;
            monthlyMap.set(monthKey, existing);

            // Category aggregation
            if (entry.category) {
              const catData = categoryMap.get(entry.category) || { total: 0, monthly: new Map() };
              catData.total += entry.amount;
              const monthlyAmount = catData.monthly.get(monthKey) || 0;
              catData.monthly.set(monthKey, monthlyAmount + entry.amount);
              categoryMap.set(entry.category, catData);
            }
          }

          // Track unpaid receivables (AR entries only - income type)
          if (entry.isARAPEntry && (entry.type === "دخل" || entry.type === "إيراد")) {
            if (entry.paymentStatus === "unpaid" || entry.paymentStatus === "partial") {
              unpaidCount++;
              unpaidTotal += entry.remainingBalance || entry.amount;
            }
          }
        }

        transactions.push(entry);
      });

      setTotalRevenue(revenue);
      setTotalExpenses(expenses);
      setMonthlyDataMap(monthlyMap);
      setExpensesByCategoryMap(categoryMap);
      setUnpaidReceivables({ count: unpaidCount, total: unpaidTotal });

      // Sort by date and get last 5 transactions
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentTransactions(transactions.slice(0, 5));
    });

    return () => unsubscribe();
  }, [user]);

  // Load payments for cash balance
  useEffect(() => {
    if (!user) return;

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    const unsubscribe = onSnapshot(paymentsRef, (snapshot) => {
      let totalIn = 0;
      let totalOut = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Skip endorsed cheques and no-cash-movement payments
        if (data.isEndorsement || data.noCashMovement) {
          return;
        }

        if (data.type === "قبض") {
          totalIn += data.amount || 0;
        } else if (data.type === "صرف") {
          totalOut += data.amount || 0;
        }
      });

      setTotalCashIn(totalIn);
      setTotalCashOut(totalOut);
    });

    return () => unsubscribe();
  }, [user]);

  // Load cheques due soon (within 7 days)
  useEffect(() => {
    if (!user) return;

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const unsubscribe = onSnapshot(chequesRef, (snapshot) => {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      let count = 0;
      let total = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const dueDate = toDate(data.dueDate);
        const status = data.status;

        // Only pending cheques due within 7 days
        if (status === "قيد الانتظار" && dueDate >= now && dueDate <= sevenDaysLater) {
          count++;
          total += data.amount || 0;
        }
      });

      setChequesDueSoon({ count, total });
    });

    return () => unsubscribe();
  }, [user]);

  // Calculate derived data
  const cashBalance = totalCashIn - totalCashOut;
  const isNegativeCash = cashBalance < 0;

  // Monthly/Total data for summary cards
  const summaryData = useMemo(() => {
    if (summaryView === "total") {
      return {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
      };
    } else {
      const monthData = monthlyDataMap.get(selectedMonth) || { revenue: 0, expenses: 0 };
      return {
        revenue: monthData.revenue,
        expenses: monthData.expenses,
        profit: monthData.revenue - monthData.expenses,
      };
    }
  }, [summaryView, selectedMonth, totalRevenue, totalExpenses, monthlyDataMap]);

  // Chart data
  const chartData = useMemo(() => {
    const monthCount = parseInt(chartPeriod);
    const result: MonthlyData[] = [];
    const now = new Date();

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const data = monthlyDataMap.get(monthKey) || { revenue: 0, expenses: 0 };

      result.push({
        month: d.toLocaleDateString("en-US", { month: "short" }),
        monthKey,
        revenue: data.revenue,
        expenses: data.expenses,
        revenueFormatted: formatNumber(data.revenue),
        expensesFormatted: formatNumber(data.expenses),
      });
    }

    return result;
  }, [chartPeriod, monthlyDataMap]);

  // Max value for chart scaling
  const chartMaxValue = useMemo(() => {
    let max = 0;
    chartData.forEach((d) => {
      max = Math.max(max, d.revenue, d.expenses);
    });
    return max || 1;
  }, [chartData]);

  // Expense categories for donut chart
  const expenseCategories = useMemo(() => {
    const categories: ExpenseCategory[] = [];
    let totalAmount = 0;

    if (expenseView === "total") {
      expensesByCategoryMap.forEach((data, name) => {
        totalAmount += data.total;
      });

      let offset = 0;
      let index = 0;
      expensesByCategoryMap.forEach((data, name) => {
        if (data.total > 0) {
          const percent = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0;
          categories.push({
            id: name,
            label: name,
            amount: data.total,
            percent,
            color: EXPENSE_COLORS[index % EXPENSE_COLORS.length],
            offset,
          });
          offset += percent;
          index++;
        }
      });
    } else {
      expensesByCategoryMap.forEach((data, name) => {
        const monthAmount = data.monthly.get(selectedMonth) || 0;
        totalAmount += monthAmount;
      });

      let offset = 0;
      let index = 0;
      expensesByCategoryMap.forEach((data, name) => {
        const monthAmount = data.monthly.get(selectedMonth) || 0;
        if (monthAmount > 0) {
          const percent = totalAmount > 0 ? (monthAmount / totalAmount) * 100 : 0;
          categories.push({
            id: name,
            label: name,
            amount: monthAmount,
            percent,
            color: EXPENSE_COLORS[index % EXPENSE_COLORS.length],
            offset,
          });
          offset += percent;
          index++;
        }
      });
    }

    // Sort by amount descending
    categories.sort((a, b) => b.amount - a.amount);

    // Recalculate offsets after sorting
    let offset = 0;
    categories.forEach((cat) => {
      cat.offset = offset;
      offset += cat.percent;
    });

    return categories;
  }, [expenseView, selectedMonth, expensesByCategoryMap]);

  const expenseTotalAmount = useMemo(() => {
    return expenseCategories.reduce((sum, cat) => sum + cat.amount, 0);
  }, [expenseCategories]);

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      {/* Hero Cash Balance */}
      <div className="bg-slate-800 rounded-2xl p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute w-96 h-96 rounded-full bg-white"
            style={{
              top: "-50%",
              right: "-10%",
              animation: "pulse 4s ease-in-out infinite",
            }}
          />
        </div>

        <p className="text-slate-400 text-sm font-medium mb-2 tracking-wide relative">الرصيد النقدي</p>
        <p className={`text-5xl font-semibold tracking-tight relative ${isNegativeCash ? "text-rose-400" : "text-white"}`}>
          {isNegativeCash ? "-" : ""}{formatNumber(cashDisplay)}
        </p>
        <p className="text-slate-400 text-lg mt-1 relative">دينار</p>
      </div>

      {/* Financial Summary Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">الملخص المالي</h2>
          <div className="flex items-center gap-3">
            {summaryView === "month" && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:border-slate-400 transition-colors"
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}

            <div className="flex bg-slate-200 rounded-lg p-1">
              <button
                onClick={() => setSummaryView("month")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  summaryView === "month"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                شهري
              </button>
              <button
                onClick={() => setSummaryView("total")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  summaryView === "total"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                الإجمالي
              </button>
            </div>
          </div>
        </div>

        {/* 3 Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenue */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm">الإيرادات</span>
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-800">{formatNumber(summaryData.revenue)}</p>
            <p className="text-xs text-slate-400 mt-1">دينار</p>
          </div>

          {/* Expenses */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm">المصروفات</span>
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                <ArrowDown className="w-5 h-5 text-slate-500" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-800">{formatNumber(summaryData.expenses)}</p>
            <p className="text-xs text-slate-400 mt-1">دينار</p>
          </div>

          {/* Net Profit */}
          <div
            className={`rounded-xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer ${
              summaryData.profit < 0
                ? "bg-rose-50 border-rose-200"
                : "bg-emerald-50 border-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm">صافي الربح</span>
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  summaryData.profit < 0 ? "bg-rose-100" : "bg-emerald-100"
                }`}
              >
                <span className={`text-sm font-bold ${summaryData.profit < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {summaryData.profit < 0 ? "−" : "+"}
                </span>
              </div>
            </div>
            <p className={`text-2xl font-semibold ${summaryData.profit < 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {formatNumber(Math.abs(summaryData.profit))}
            </p>
            <p className={`text-xs mt-1 ${summaryData.profit < 0 ? "text-rose-500" : "text-emerald-500"}`}>
              {summaryData.profit < 0 ? "خسارة" : "ربح"}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts + Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Needs Attention */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700">يحتاج انتباهك</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Cheques Due Soon */}
            {chequesDueSoon.count > 0 ? (
              <Link href="/cheques?dueSoon=7" className="block">
                <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100 transition-all duration-200 hover:shadow-md cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div>
                      <div className="absolute inset-0 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></div>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 text-sm">شيكات تستحق قريباً</p>
                      <p className="text-xs text-slate-500">{chequesDueSoon.count} شيكات خلال 7 أيام</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-rose-700 text-sm">{formatNumber(chequesDueSoon.total)} دينار</p>
                  </div>
                </div>
              </Link>
            ) : null}

            {/* Unpaid Receivables */}
            {unpaidReceivables.count > 0 ? (
              <Link href="/ledger?paymentStatus=outstanding" className="block">
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 transition-all duration-200 hover:shadow-md cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-slate-700 text-sm">ذمم غير محصلة</p>
                      <p className="text-xs text-slate-500">{unpaidReceivables.count} فاتورة متأخرة</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-amber-700 text-sm">{formatNumber(unpaidReceivables.total)} دينار</p>
                  </div>
                </div>
              </Link>
            ) : null}

            {/* All Good */}
            {chequesDueSoon.count === 0 && unpaidReceivables.count === 0 && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                <p className="text-slate-600 text-sm">لا توجد تنبيهات عاجلة</p>
                <Check className="w-4 h-4 text-emerald-600 mr-auto" />
              </div>
            )}

            {/* Placeholder if only one alert */}
            {(chequesDueSoon.count > 0 || unpaidReceivables.count > 0) &&
              !(chequesDueSoon.count > 0 && unpaidReceivables.count > 0) && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                  <p className="text-slate-600 text-sm">لا توجد مدفوعات متأخرة</p>
                  <Check className="w-4 h-4 text-emerald-600 mr-auto" />
                </div>
              )}
          </CardContent>
        </Card>

        {/* Revenue/Expense Bar Chart */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-700">الإيرادات والمصروفات</CardTitle>
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                {(["1", "3", "6"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setChartPeriod(period)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                      chartPeriod === period
                        ? "bg-white text-slate-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-600"
                    }`}
                  >
                    {period === "1" ? "شهر" : `${period} أشهر`}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bar Chart */}
            <div className="h-48 flex items-end justify-around gap-4 pt-6">
              {chartData.map((data, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full flex gap-2 items-end justify-center h-32 relative">
                    {/* Revenue Bar */}
                    <div className="relative group">
                      <div
                        className={`w-8 bg-emerald-500 rounded-t cursor-pointer transition-all duration-500 ease-out ${
                          hoveredBar === `${i}-revenue` ? "bg-emerald-600" : ""
                        }`}
                        style={{
                          height: isLoaded ? `${(data.revenue / chartMaxValue) * 100}px` : "0px",
                          transitionDelay: `${i * 150}ms`,
                          boxShadow: hoveredBar === `${i}-revenue` ? "0 4px 12px rgba(16, 185, 129, 0.4)" : "none",
                          minHeight: data.revenue > 0 ? "4px" : "0px",
                        }}
                        onMouseEnter={() => setHoveredBar(`${i}-revenue`)}
                        onMouseLeave={() => setHoveredBar(null)}
                      />
                      {/* Tooltip */}
                      <div
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap transition-all duration-200 z-10 ${
                          hoveredBar === `${i}-revenue` ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2"
                        }`}
                      >
                        <div className="font-semibold">{data.revenueFormatted} دينار</div>
                        <div className="text-emerald-300 text-[10px]">الإيرادات</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                      </div>
                    </div>

                    {/* Expense Bar */}
                    <div className="relative group">
                      <div
                        className={`w-8 bg-slate-400 rounded-t cursor-pointer transition-all duration-500 ease-out ${
                          hoveredBar === `${i}-expense` ? "bg-slate-500" : ""
                        }`}
                        style={{
                          height: isLoaded ? `${(data.expenses / chartMaxValue) * 100}px` : "0px",
                          transitionDelay: `${i * 150 + 75}ms`,
                          boxShadow: hoveredBar === `${i}-expense` ? "0 4px 12px rgba(100, 116, 139, 0.4)" : "none",
                          minHeight: data.expenses > 0 ? "4px" : "0px",
                        }}
                        onMouseEnter={() => setHoveredBar(`${i}-expense`)}
                        onMouseLeave={() => setHoveredBar(null)}
                      />
                      {/* Tooltip */}
                      <div
                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap transition-all duration-200 z-10 ${
                          hoveredBar === `${i}-expense` ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2"
                        }`}
                      >
                        <div className="font-semibold">{data.expensesFormatted} دينار</div>
                        <div className="text-slate-400 text-[10px]">المصروفات</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{data.month}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                <span className="text-xs text-slate-500">الإيرادات</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-400 rounded"></div>
                <span className="text-xs text-slate-500">المصروفات</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Donut Chart - Full Width */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">المصروفات حسب الفئة</CardTitle>
            <div className="flex items-center gap-3">
              {expenseView === "month" && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:border-slate-400 transition-colors"
                >
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex bg-slate-200 rounded-lg p-1">
                <button
                  onClick={() => setExpenseView("month")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    expenseView === "month"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  شهري
                </button>
                <button
                  onClick={() => setExpenseView("total")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                    expenseView === "total"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  الإجمالي
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {expenseCategories.length === 0 ? (
            <p className="text-slate-500 text-center py-8">لا توجد مصروفات {expenseView === "month" ? "لهذا الشهر" : ""}</p>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
              {/* 3D Donut Chart */}
              <div className="relative" style={{ perspective: "1000px" }}>
                <svg
                  width="220"
                  height="220"
                  viewBox="0 0 220 220"
                  style={{
                    transform: "rotateX(15deg)",
                    filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.15))",
                  }}
                >
                  {/* Shadow/Depth Layer */}
                  <ellipse cx="110" cy="130" rx="75" ry="20" fill="rgba(0,0,0,0.1)" />

                  {/* Donut segments */}
                  {expenseCategories.map((segment, index) => {
                    const circumference = 2 * Math.PI * 70;
                    const segmentLength = (segment.percent / 100) * circumference;
                    const segmentOffset = (segment.offset / 100) * circumference;
                    const isHovered = hoveredSegment === segment.id;

                    return (
                      <circle
                        key={segment.id}
                        cx="110"
                        cy="100"
                        r="70"
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={isHovered ? 32 : 28}
                        strokeDasharray={`${isLoaded ? segmentLength : 0} ${circumference}`}
                        strokeDashoffset={-segmentOffset}
                        transform="rotate(-90 110 100)"
                        style={{
                          transition: "all 0.5s ease-out",
                          transitionDelay: `${index * 200}ms`,
                          filter: isHovered ? "brightness(1.1)" : "none",
                          cursor: "pointer",
                        }}
                        onMouseEnter={() => setHoveredSegment(segment.id)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      />
                    );
                  })}

                  {/* Inner circle */}
                  <circle cx="110" cy="100" r="50" fill="white" />
                </svg>

                {/* Center Text */}
                <div
                  className="absolute flex flex-col items-center justify-center transition-all duration-300"
                  style={{
                    top: "38%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {hoveredSegment ? (
                    <>
                      <p className="text-lg font-semibold text-slate-800">
                        {formatNumber(expenseCategories.find((s) => s.id === hoveredSegment)?.amount || 0)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {expenseCategories.find((s) => s.id === hoveredSegment)?.percent.toFixed(0)}%
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-semibold text-slate-800">{formatNumber(expenseTotalAmount)}</p>
                      <p className="text-sm text-slate-400">دينار</p>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-3">
                {expenseCategories.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                      hoveredSegment === item.id ? "bg-slate-50 scale-105" : ""
                    }`}
                    onMouseEnter={() => setHoveredSegment(item.id)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div
                      className="w-4 h-4 rounded transition-transform duration-200"
                      style={{
                        backgroundColor: item.color,
                        transform: hoveredSegment === item.id ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{item.label}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-600 w-24 text-left">{formatNumber(item.amount)}</span>
                    <span
                      className={`text-sm w-10 text-left transition-colors duration-200 ${
                        hoveredSegment === item.id ? "text-slate-800 font-semibold" : "text-slate-400"
                      }`}
                    >
                      {item.percent.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last 5 Transactions */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">آخر 5 حركات مالية</CardTitle>
            <Link href="/ledger" className="text-slate-500 text-sm hover:text-slate-700 transition-colors">
              عرض الكل ←
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-slate-500 text-center py-8">لا توجد حركات مالية بعد</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((tx, i) => {
                const isIncome = tx.type === "دخل" || tx.type === "إيراد";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 transition-all duration-300 hover:bg-slate-50 hover:px-2 rounded-lg cursor-pointer"
                    style={{
                      opacity: isLoaded ? 1 : 0,
                      transform: isLoaded ? "translateX(0)" : "translateX(-20px)",
                      transition: `all 0.4s ease-out ${i * 100 + 500}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 hover:scale-110 ${
                          isIncome ? "bg-emerald-50" : "bg-slate-100"
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{tx.description || tx.category}</p>
                        <p className="text-xs text-slate-400">{tx.category}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${isIncome ? "text-emerald-600" : "text-slate-600"}`}>
                        {isIncome ? "+" : "-"}{formatNumber(tx.amount)} دينار
                      </p>
                      <p className="text-xs text-slate-400">
                        {tx.date.toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSS Keyframes */}
      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.05;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.08;
          }
        }
      `}</style>
    </div>
  );
}
