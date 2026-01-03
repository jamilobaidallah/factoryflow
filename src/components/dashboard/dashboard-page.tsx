"use client";

import { useState, useEffect, useMemo } from "react";

import { DASHBOARD_CONFIG, EXPENSE_CATEGORY_COLORS } from "./constants/dashboard.constants";
import { useDashboardData } from "./hooks/useDashboardData";
import { useChequesAlerts } from "./hooks/useChequesAlerts";
import { useReceivablesAlerts } from "./hooks/useReceivablesAlerts";
import {
  DashboardHero,
  DashboardSummaryCards,
  DashboardAlerts,
  DashboardBarChart,
  DashboardDonutChart,
  DashboardTransactions,
} from "./components";
import type {
  ViewMode,
  ChartPeriod,
  DashboardSummaryData,
  ChartDataPoint,
  ExpenseCategory,
  MonthOption,
} from "./types/dashboard.types";
import { formatNumber } from "@/lib/date-utils";

export default function DashboardPage() {
  // View states
  const [summaryView, setSummaryView] = useState<ViewMode>("total");
  const [expenseView, setExpenseView] = useState<ViewMode>("total");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("3");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Animation states
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Data hooks
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
  } = useDashboardData();

  const { chequesDueSoon } = useChequesAlerts();
  const { unpaidReceivables, unpaidPayables } = useReceivablesAlerts();

  // Generate available months for dropdown
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

  // Animate on load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), DASHBOARD_CONFIG.LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Trigger cash animation when balance changes
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), DASHBOARD_CONFIG.ANIMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [cashBalance]);

  // Monthly/Total data for summary cards
  // Dashboard shows NET revenue (after discounts) for cleaner view
  // Profit = Net Revenue - Net Expenses - Bad Debt
  // Net Expenses = Gross Expenses - Expense Discounts - Expense Writeoffs
  // Bad debt is treated as an expense (ديون معدومة)
  const summaryData = useMemo<DashboardSummaryData>(() => {
    if (summaryView === "total") {
      const netRevenue = totalRevenue - totalDiscounts;
      const netExpenses = totalExpenses - totalExpenseDiscounts - totalExpenseWriteoffs;
      const profit = netRevenue - netExpenses - totalBadDebt;
      return {
        revenue: netRevenue,  // Show net revenue on dashboard
        expenses: netExpenses,  // Show net expenses (after expense discounts)
        profit,
        isLoss: profit < 0,
      };
    } else {
      const monthData = monthlyDataMap.get(selectedMonth) || { revenue: 0, expenses: 0, discounts: 0, badDebt: 0 };
      const netRevenue = monthData.revenue - (monthData.discounts || 0);
      // Note: Monthly expense discounts not yet tracked in monthlyDataMap (future enhancement)
      const profit = netRevenue - monthData.expenses - (monthData.badDebt || 0);
      return {
        revenue: netRevenue,  // Show net revenue on dashboard
        expenses: monthData.expenses,
        profit,
        isLoss: profit < 0,
      };
    }
  }, [summaryView, selectedMonth, totalRevenue, totalExpenses, totalDiscounts, totalBadDebt, totalExpenseDiscounts, totalExpenseWriteoffs, monthlyDataMap]);

  // Chart data for bar chart
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

  // Expense categories for donut chart
  const { expenseCategories, expenseTotalAmount } = useMemo(() => {
    const categories: ExpenseCategory[] = [];
    let totalAmount = 0;

    if (expenseView === "total") {
      // Calculate total first
      expensesByCategoryMap.forEach((data) => {
        totalAmount += data.total;
      });

      // Build categories
      let index = 0;
      expensesByCategoryMap.forEach((data, name) => {
        if (data.total > 0) {
          const percent = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0;
          categories.push({
            id: name,
            label: name,
            amount: data.total,
            percent,
            color: EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length],
            offset: 0,
          });
          index++;
        }
      });
    } else {
      // Calculate monthly total first
      expensesByCategoryMap.forEach((data) => {
        const monthAmount = data.monthly.get(selectedMonth) || 0;
        totalAmount += monthAmount;
      });

      // Build categories
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
            color: EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length],
            offset: 0,
          });
          index++;
        }
      });
    }

    // Sort by amount descending and calculate offsets
    categories.sort((a, b) => b.amount - a.amount);
    let offset = 0;
    categories.forEach((cat) => {
      cat.offset = offset;
      offset += cat.percent;
    });

    return { expenseCategories: categories, expenseTotalAmount: totalAmount };
  }, [expenseView, selectedMonth, expensesByCategoryMap]);

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      {/* Hero Cash Balance */}
      <DashboardHero cashBalance={cashBalance} isAnimating={isAnimating} />

      {/* Financial Summary Section */}
      <DashboardSummaryCards
        summaryData={summaryData}
        viewMode={summaryView}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        onViewModeChange={setSummaryView}
        onMonthChange={setSelectedMonth}
      />

      {/* Alerts + Chart Row */}
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

      {/* Expense Donut Chart */}
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

      {/* Last 5 Transactions */}
      <DashboardTransactions
        transactions={recentTransactions}
        isLoaded={isLoaded}
      />

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
