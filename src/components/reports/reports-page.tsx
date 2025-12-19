"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useUser } from "@/firebase/provider";
import { formatNumber } from "@/lib/date-utils";
import { exportIncomeStatementToHTML } from "@/lib/export-utils";
import { exportReportsToExcelProfessional } from "@/lib/export-reports-excel";

// Hooks
import { useReportsData } from "./hooks/useReportsData";
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
  ReportsDatePickerModal,
  ReportsInlineReport,
} from "./components";

// Types & Constants
import type {
  PeriodType,
  ComparisonType,
  ChartPeriodType,
  ReportsChartDataPoint,
  CategoryData,
  CustomDateRange,
} from "./types/reports.types";
import { CATEGORY_COLORS, ANIMATION_CONFIG, OWNER_EQUITY_CATEGORIES, ARABIC_MONTH_NAMES } from "./constants/reports.constants";

export default function ReportsPage() {
  const { user } = useUser();

  // Period & comparison state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("total");
  const [comparisonType, setComparisonType] = useState<ComparisonType>("lastMonth");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriodType>("6");
  const [activeReport, setActiveReport] = useState<string | null>(null);

  // Custom date range state
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | null>(null);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);

  // Animation state
  const [isLoaded, setIsLoaded] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

  // Refs for scroll navigation
  const summaryCardsRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const detailedTablesRef = useRef<HTMLDivElement>(null);

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
  const { loading, ledgerEntries } = useReportsData({
    userId: user?.uid || null,
    startDate,
    endDate,
  });

  // Note: useReportsCalculations is available for detailed reports if needed
  // For the main page, we use filteredData which respects the selected period

  // Calculate comparison data
  const { comparison, dateRange } = useReportsComparison({
    selectedPeriod,
    comparisonType,
    ledgerEntries,
    customStartDate: customDateRange ? new Date(customDateRange.startDate) : undefined,
    customEndDate: customDateRange ? new Date(customDateRange.endDate) : undefined,
  });

  // Filter ledger entries by selected period for tables/donut (Bug Fix #4 & #6)
  const filteredData = useMemo(() => {
    const { start, end } = dateRange;

    // Filter entries by period
    const filtered = ledgerEntries.filter((entry) => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      return entryDate >= start && entryDate <= end;
    });

    // Calculate revenue by category
    const revenueByCategory: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};
    let totalRevenue = 0;
    let totalExpenses = 0;

    filtered.forEach((entry) => {
      // Exclude owner equity
      if (OWNER_EQUITY_CATEGORIES.includes(entry.category as typeof OWNER_EQUITY_CATEGORIES[number])) {
        return;
      }

      if (entry.type === "دخل") {
        totalRevenue += entry.amount;
        revenueByCategory[entry.category] = (revenueByCategory[entry.category] || 0) + entry.amount;
      } else if (entry.type === "مصروف") {
        totalExpenses += entry.amount;
        expensesByCategory[entry.category] = (expensesByCategory[entry.category] || 0) + entry.amount;
      }
    });

    return {
      revenueByCategory,
      expensesByCategory,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
    };
  }, [ledgerEntries, dateRange]);

  // Build expense categories for donut chart (using filtered data)
  const expenseCategories = useMemo<CategoryData[]>(() => {
    const categories: CategoryData[] = [];
    const totalExpenses = filteredData.totalExpenses;

    if (totalExpenses === 0) {
      return [];
    }

    Object.entries(filteredData.expensesByCategory)
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
  }, [filteredData.expensesByCategory, filteredData.totalExpenses]);

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
      if (OWNER_EQUITY_CATEGORIES.includes(entry.category as typeof OWNER_EQUITY_CATEGORIES[number])) {
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

      result.push({
        month: ARABIC_MONTH_NAMES[d.getMonth()],
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

  // Helper function for CSV conversion
  const convertToCSV = useCallback((data: Record<string, unknown>[]): string => {
    if (data.length === 0) {
      return "";
    }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(","));
    return [headers, ...rows].join("\n");
  }, []);

  // Export handlers (using filteredData for period-filtered exports)
  const handleExportPDF = useCallback(() => {
    // Use HTML export for proper Arabic font support
    // Opens in new tab with print dialog for saving as PDF
    exportIncomeStatementToHTML(
      {
        revenues: Object.entries(filteredData.revenueByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === "number" ? amount : 0,
        })),
        expenses: Object.entries(filteredData.expensesByCategory).map(([category, amount]) => ({
          category,
          amount: typeof amount === "number" ? amount : 0,
        })),
        totalRevenue: filteredData.totalRevenue,
        totalExpenses: filteredData.totalExpenses,
        netIncome: filteredData.netProfit,
      },
      dateRange.start.toISOString().split("T")[0],
      dateRange.end.toISOString().split("T")[0]
    );
  }, [filteredData, dateRange]);

  const handleExportExcel = useCallback(() => {
    exportReportsToExcelProfessional(
      {
        revenueByCategory: filteredData.revenueByCategory,
        expensesByCategory: filteredData.expensesByCategory,
        totalRevenue: filteredData.totalRevenue,
        totalExpenses: filteredData.totalExpenses,
        netProfit: filteredData.netProfit,
      },
      dateRange
    );
  }, [filteredData, dateRange]);

  const handleExportCSV = useCallback(() => {
    const data = [
      ...Object.entries(filteredData.revenueByCategory).map(([cat, amt]) => ({
        النوع: "إيراد",
        الفئة: cat,
        المبلغ: amt,
      })),
      ...Object.entries(filteredData.expensesByCategory).map(([cat, amt]) => ({
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
  }, [filteredData, convertToCSV]);

  const handleReportClick = useCallback((reportId: string) => {
    // Toggle: click same card to close, different card to switch
    setActiveReport((prev) => (prev === reportId ? null : reportId));
  }, []);

  const handleCustomDateClick = useCallback(() => {
    setShowDatePickerModal(true);
  }, []);

  const handleCustomDateConfirm = useCallback((range: CustomDateRange) => {
    setCustomDateRange(range);
    setSelectedPeriod("custom");
    setShowDatePickerModal(false);
  }, []);

  const handleDonutDetailsClick = useCallback(() => {
    detailedTablesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
        customDateRange={customDateRange}
        onPeriodChange={setSelectedPeriod}
        onComparisonChange={setComparisonType}
        onCustomDateClick={handleCustomDateClick}
      />

      {/* Date Picker Modal */}
      <ReportsDatePickerModal
        isOpen={showDatePickerModal}
        onClose={() => setShowDatePickerModal(false)}
        onConfirm={handleCustomDateConfirm}
        initialRange={customDateRange}
      />

      {/* Summary Cards with Comparison */}
      <div
        ref={summaryCardsRef}
        className={`transition-all duration-500 rounded-xl ${
          highlightedSection === "summary" ? "ring-2 ring-blue-500 ring-offset-2" : ""
        }`}
      >
        <ReportsSummaryCards comparison={comparison} isLoading={loading} />
      </div>

      {/* Charts Row */}
      <div
        ref={chartsRef}
        className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-all duration-500 rounded-xl ${
          highlightedSection === "charts" ? "ring-2 ring-blue-500 ring-offset-2 p-1" : ""
        }`}
      >
        <ReportsBarChart
          chartData={chartData}
          chartPeriod={chartPeriod}
          isLoaded={isLoaded}
          onPeriodChange={setChartPeriod}
        />
        <ReportsDonutChart
          categories={expenseCategories}
          totalAmount={filteredData.totalExpenses}
          isLoaded={isLoaded}
          onDetailsClick={handleDonutDetailsClick}
        />
      </div>

      {/* Quick Reports */}
      <ReportsQuickAccess
        onReportClick={handleReportClick}
        activeReport={activeReport}
        isLoaded={isLoaded}
      />

      {/* Inline Report Content (expands below cards when clicked) */}
      {activeReport && (
        <ReportsInlineReport
          reportId={activeReport}
          onClose={() => setActiveReport(null)}
          ledgerEntries={ledgerEntries}
          filteredData={filteredData}
          dateRange={dateRange}
        />
      )}

      {/* Auto-generated Insights */}
      <ReportsInsights insights={insights} isLoaded={isLoaded} />

      {/* Detailed Tables (using period-filtered data) */}
      <div
        ref={detailedTablesRef}
        className={`transition-all duration-500 rounded-xl ${
          highlightedSection === "tables" ? "ring-2 ring-blue-500 ring-offset-2" : ""
        }`}
      >
        <ReportsDetailedTables
          revenueByCategory={filteredData.revenueByCategory}
          expensesByCategory={filteredData.expensesByCategory}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      </div>
    </div>
  );
}
