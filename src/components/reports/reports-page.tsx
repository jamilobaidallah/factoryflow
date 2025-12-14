"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/firebase/provider";
import { formatNumber } from "@/lib/date-utils";
import {
  exportToExcel,
  exportIncomeStatementToPDF,
} from "@/lib/export-utils";

// Hooks
import { useReportsData } from "./hooks/useReportsData";
import { useReportsCalculations } from "./hooks/useReportsCalculations";
import { useReportsComparison } from "./hooks/useReportsComparison";
import { useReportsInsights } from "./hooks/useReportsInsights";

// Components
import {
  ReportsHeader,
  ReportsPeriodSelector,
  ReportsSummaryCards,
  ReportsBarChart,
  ReportsDonutChart,
  ReportsQuickAccess,
  ReportsInsights,
  ReportsDetailedTables,
} from "./components";

// Types & Constants
import type {
  PeriodType,
  ComparisonType,
  ChartPeriodType,
  ReportsChartDataPoint,
  CategoryData,
} from "./types/reports.types";
import { CATEGORY_COLORS, ANIMATION_CONFIG } from "./constants/reports.constants";

export default function ReportsPage() {
  const { user } = useUser();

  // Period & comparison state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month");
  const [comparisonType, setComparisonType] = useState<ComparisonType>("lastMonth");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriodType>("6");
  const [activeReport, setActiveReport] = useState<string | null>(null);

  // Animation state
  const [isLoaded, setIsLoaded] = useState(false);

  // Calculate date range based on selected period (for data fetching)
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const end = now.toISOString().split("T")[0];
    const start = new Date(now);

    switch (selectedPeriod) {
      case "today":
        break;
      case "week":
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start.setMonth(start.getMonth() - 1);
        break;
      case "quarter":
        start.setMonth(start.getMonth() - 3);
        break;
      case "year":
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start.setMonth(start.getMonth() - 1);
    }

    // For comparison, we need to fetch more data (up to 2 years back)
    const comparisonStart = new Date(now);
    comparisonStart.setFullYear(comparisonStart.getFullYear() - 2);

    return {
      startDate: comparisonStart.toISOString().split("T")[0],
      endDate: end,
    };
  }, [selectedPeriod]);

  // Fetch data
  const { loading, ledgerEntries, payments } = useReportsData({
    userId: user?.uid || null,
    startDate,
    endDate,
  });

  // Calculate reports data
  const { incomeStatement } = useReportsCalculations({
    ledgerEntries,
    payments,
    inventory: [],
    fixedAssets: [],
  });

  // Calculate comparison data
  const { comparison } = useReportsComparison({
    selectedPeriod,
    comparisonType,
    ledgerEntries,
  });

  // Build expense categories for donut chart
  const expenseCategories = useMemo<CategoryData[]>(() => {
    const categories: CategoryData[] = [];
    const totalExpenses = incomeStatement.totalExpenses;

    if (totalExpenses === 0) return [];

    Object.entries(incomeStatement.expensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([name, amount], index) => {
        const percent = (amount / totalExpenses) * 100;
        categories.push({
          id: name,
          name,
          amount,
          percent,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        });
      });

    return categories;
  }, [incomeStatement.expensesByCategory, incomeStatement.totalExpenses]);

  // Generate insights
  const { insights } = useReportsInsights({
    comparison,
    expenseCategories,
    hasComparisonData: comparisonType !== "none",
  });

  // Build chart data for bar chart
  const chartData = useMemo<ReportsChartDataPoint[]>(() => {
    const monthCount = parseInt(chartPeriod);
    const result: ReportsChartDataPoint[] = [];
    const now = new Date();

    // Group ledger entries by month
    const monthlyData = new Map<string, { revenue: number; expenses: number }>();

    ledgerEntries.forEach((entry) => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { revenue: 0, expenses: 0 });
      }

      const data = monthlyData.get(monthKey)!;

      // Exclude owner equity
      if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
        return;
      }

      if (entry.type === "دخل") {
        data.revenue += entry.amount;
      } else if (entry.type === "مصروف") {
        data.expenses += entry.amount;
      }
    });

    // Build chart data for last N months
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const data = monthlyData.get(monthKey) || { revenue: 0, expenses: 0 };

      // Arabic month names
      const arabicMonths = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
      ];

      result.push({
        month: arabicMonths[d.getMonth()],
        monthKey,
        revenue: data.revenue,
        expenses: data.expenses,
        revenueFormatted: formatNumber(data.revenue),
        expensesFormatted: formatNumber(data.expenses),
      });
    }

    return result;
  }, [chartPeriod, ledgerEntries]);

  // Animate on load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), ANIMATION_CONFIG.LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Export handlers
  const handleExportPDF = () => {
    exportIncomeStatementToPDF(
      {
        revenues: Object.entries(incomeStatement.revenueByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === "number" ? amount : 0,
        })),
        expenses: Object.entries(incomeStatement.expensesByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === "number" ? amount : 0,
        })),
        totalRevenue: incomeStatement.totalRevenue,
        totalExpenses: incomeStatement.totalExpenses,
        netIncome: incomeStatement.netProfit,
      },
      startDate,
      endDate,
      `قائمة_الدخل_${startDate}_${endDate}`
    );
  };

  const handleExportExcel = () => {
    const revenueData = Object.entries(incomeStatement.revenueByCategory).map(
      ([category, amount]) => ({
        الفئة: category,
        النوع: "إيراد",
        المبلغ: amount,
      })
    );

    const expenseData = Object.entries(incomeStatement.expensesByCategory).map(
      ([category, amount]) => ({
        الفئة: category,
        النوع: "مصروف",
        المبلغ: amount,
      })
    );

    const allData = [
      ...revenueData,
      { الفئة: "إجمالي الإيرادات", النوع: "", المبلغ: incomeStatement.totalRevenue },
      ...expenseData,
      { الفئة: "إجمالي المصروفات", النوع: "", المبلغ: incomeStatement.totalExpenses },
      { الفئة: "صافي الدخل", النوع: "", المبلغ: incomeStatement.netProfit },
    ];

    exportToExcel(allData, `تقرير_مالي_${startDate}_${endDate}`, "التقرير المالي");
  };

  const handleExportCSV = () => {
    const data = [
      ...Object.entries(incomeStatement.revenueByCategory).map(([cat, amt]) => ({
        النوع: "إيراد",
        الفئة: cat,
        المبلغ: amt,
      })),
      ...Object.entries(incomeStatement.expensesByCategory).map(([cat, amt]) => ({
        النوع: "مصروف",
        الفئة: cat,
        المبلغ: amt,
      })),
    ];

    const csv = convertToCSV(data);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_مالي_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const convertToCSV = (data: Record<string, unknown>[]): string => {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(","));
    return [headers, ...rows].join("\n");
  };

  const handleReportClick = (reportId: string) => {
    setActiveReport(reportId);
    // TODO: Navigate to specific report or open modal
  };

  const handleCustomDateClick = () => {
    // TODO: Open date picker modal
    setSelectedPeriod("custom");
  };

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      {/* Header */}
      <ReportsHeader
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
      />

      {/* Period & Comparison Selector */}
      <ReportsPeriodSelector
        selectedPeriod={selectedPeriod}
        comparisonType={comparisonType}
        onPeriodChange={setSelectedPeriod}
        onComparisonChange={setComparisonType}
        onCustomDateClick={handleCustomDateClick}
      />

      {/* Summary Cards with Comparison */}
      <ReportsSummaryCards comparison={comparison} isLoading={loading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportsBarChart
          chartData={chartData}
          chartPeriod={chartPeriod}
          isLoaded={isLoaded}
          onPeriodChange={setChartPeriod}
        />
        <ReportsDonutChart
          categories={expenseCategories}
          totalAmount={incomeStatement.totalExpenses}
          isLoaded={isLoaded}
        />
      </div>

      {/* Quick Reports */}
      <ReportsQuickAccess
        onReportClick={handleReportClick}
        activeReport={activeReport}
        isLoaded={isLoaded}
      />

      {/* Auto-generated Insights */}
      <ReportsInsights insights={insights} isLoaded={isLoaded} />

      {/* Detailed Tables */}
      <ReportsDetailedTables
        revenueByCategory={incomeStatement.revenueByCategory}
        expensesByCategory={incomeStatement.expensesByCategory}
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />
    </div>
  );
}
