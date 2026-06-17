"use client";

import { useState, useEffect, useMemo } from "react";
import { useActiveProfile } from "@/hooks/local/useActiveProfile";
import { useDashboardDataLocal } from "@/hooks/local/useDashboardDataLocal";
import { DASHBOARD_CONFIG, EXPENSE_CATEGORY_COLORS } from "@/components/dashboard/constants/dashboard.constants";
import {
  DashboardHero,
  DashboardSummaryCards,
  DashboardAlerts,
  DashboardBarChart,
  DashboardDonutChart,
  DashboardTransactions,
} from "@/components/dashboard/components";
import type {
  ViewMode,
  ChartPeriod,
  DashboardSummaryData,
  ChartDataPoint,
  ExpenseCategory,
  MonthOption,
  AlertData,
} from "@/components/dashboard/types/dashboard.types";
import { formatNumber } from "@/lib/date-utils";

export default function LocalDashboardPage() {
  const profile = useActiveProfile();

  // ── View states (same as Firebase dashboard) ────────────────────────────
  const [summaryView, setSummaryView] = useState<ViewMode>("total");
  const [expenseView, setExpenseView] = useState<ViewMode>("total");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("3");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────
  const {
    cashBalance,
    totalRevenue,
    totalExpenses,
    totalDiscounts,
    totalBadDebt,
    totalExpenseDiscounts,
    totalExpenseWriteoffs,
    monthlyDataMap,
    expensesByCategoryMap,
    recentTransactions,
    unpaidReceivables,
    unpaidPayables,
  } = useDashboardDataLocal(summaryView === "month" ? selectedMonth : undefined);

  // No cheques module wired yet — empty alert data
  const chequesDueSoon: AlertData = { count: 0, total: 0 };

  // ── Months for dropdown ─────────────────────────────────────────────────
  const availableMonths = useMemo<MonthOption[]>(() => {
    const months: MonthOption[] = [];
    const now = new Date();
    for (let i = 0; i < DASHBOARD_CONFIG.MONTHS_TO_SHOW; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      months.push({ value, label });
    }
    return months;
  }, []);

  // ── Animations ──────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), DASHBOARD_CONFIG.LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), DASHBOARD_CONFIG.ANIMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [cashBalance]);

  // ── Summary card data ───────────────────────────────────────────────────
  const summaryData = useMemo<DashboardSummaryData>(() => {
    if (summaryView === "total") {
      const netRevenue = totalRevenue - totalDiscounts;
      const netExpenses = totalExpenses - totalExpenseDiscounts - totalExpenseWriteoffs;
      const profit = netRevenue - netExpenses - totalBadDebt;
      return {
        revenue: netRevenue,
        expenses: netExpenses + totalBadDebt,
        profit,
        isLoss: profit < 0,
      };
    } else {
      const monthData = monthlyDataMap.get(selectedMonth) || { revenue: 0, expenses: 0, discounts: 0, badDebt: 0 };
      const netRevenue = monthData.revenue - (monthData.discounts || 0);
      const profit = netRevenue - monthData.expenses - (monthData.badDebt || 0);
      return {
        revenue: netRevenue,
        expenses: monthData.expenses + (monthData.badDebt || 0),
        profit,
        isLoss: profit < 0,
      };
    }
  }, [summaryView, selectedMonth, totalRevenue, totalExpenses, totalDiscounts, totalBadDebt, totalExpenseDiscounts, totalExpenseWriteoffs, monthlyDataMap]);

  // ── Bar chart data ──────────────────────────────────────────────────────
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const monthCount = parseInt(chartPeriod);
    const result: ChartDataPoint[] = [];
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

  // ── Donut chart data ────────────────────────────────────────────────────
  const { expenseCategories, expenseTotalAmount } = useMemo(() => {
    const categories: ExpenseCategory[] = [];
    let totalAmount = 0;

    if (expenseView === "total") {
      expensesByCategoryMap.forEach(data => { totalAmount += data.total; });
      let index = 0;
      expensesByCategoryMap.forEach((data, name) => {
        if (data.total > 0) {
          const percent = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0;
          categories.push({
            id: name, label: name, amount: data.total, percent,
            color: EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length],
            offset: 0,
          });
          index++;
        }
      });
    } else {
      expensesByCategoryMap.forEach(data => {
        totalAmount += data.monthly.get(selectedMonth) || 0;
      });
      let index = 0;
      expensesByCategoryMap.forEach((data, name) => {
        const monthAmount = data.monthly.get(selectedMonth) || 0;
        if (monthAmount > 0) {
          const percent = totalAmount > 0 ? (monthAmount / totalAmount) * 100 : 0;
          categories.push({
            id: name, label: name, amount: monthAmount, percent,
            color: EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length],
            offset: 0,
          });
          index++;
        }
      });
    }

    categories.sort((a, b) => b.amount - a.amount);
    let offset = 0;
    categories.forEach(cat => { cat.offset = offset; offset += cat.percent; });
    return { expenseCategories: categories, expenseTotalAmount: totalAmount };
  }, [expenseView, selectedMonth, expensesByCategoryMap]);

  // ── Render guards ───────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <div className="space-y-6 pb-8 px-6 pt-6">
        <DashboardHero cashBalance={cashBalance} isAnimating={isAnimating} />

        <DashboardSummaryCards
          summaryData={summaryData}
          viewMode={summaryView}
          selectedMonth={selectedMonth}
          availableMonths={availableMonths}
          onViewModeChange={setSummaryView}
          onMonthChange={setSelectedMonth}
          unpaidReceivables={unpaidReceivables}
          unpaidPayables={unpaidPayables}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashboardAlerts
            chequesDueSoon={chequesDueSoon}
            unpaidReceivables={unpaidReceivables}
            unpaidPayables={unpaidPayables}
          />
          <DashboardBarChart
            chartData={chartData}
            chartPeriod={chartPeriod}
            isLoaded={isLoaded}
            onPeriodChange={setChartPeriod}
          />
        </div>

        <DashboardDonutChart
          categories={expenseCategories}
          totalAmount={expenseTotalAmount}
          viewMode={expenseView}
          selectedMonth={selectedMonth}
          availableMonths={availableMonths}
          isLoaded={isLoaded}
          onViewModeChange={setExpenseView}
          onMonthChange={setSelectedMonth}
        />

        <DashboardTransactions
          transactions={recentTransactions}
          isLoaded={isLoaded}
        />
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.05; }
          50% { transform: scale(1.1); opacity: 0.08; }
        }
      `}</style>
    </div>
  );
}
