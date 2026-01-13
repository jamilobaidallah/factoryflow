"use client";

import { useState, useMemo, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_PERIODS, DASHBOARD_LABELS } from "../constants/dashboard.constants";
import type { DashboardBarChartProps, ChartDataPoint, ChartPeriod } from "../types/dashboard.types";

/**
 * Revenue and Expenses bar chart with period selector
 * Features animated bars and hover tooltips
 */
function DashboardBarChartComponent({
  chartData,
  chartPeriod,
  isLoaded,
  onPeriodChange,
}: DashboardBarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    let max = 0;
    chartData.forEach((d) => {
      max = Math.max(max, d.revenue, d.expenses);
    });
    return max || 1;
  }, [chartData]);

  const handleBarHover = useCallback((barId: string | null) => {
    setHoveredBar(barId);
  }, []);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">
            {DASHBOARD_LABELS.revenueAndExpenses}
          </CardTitle>
          <PeriodSelector currentPeriod={chartPeriod} onPeriodChange={onPeriodChange} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart area */}
        <div className="h-48 flex items-end justify-around gap-4 pt-6" role="img" aria-label={DASHBOARD_LABELS.revenueAndExpenses}>
          {chartData.map((data, index) => (
            <ChartBar
              key={data.monthKey}
              data={data}
              index={index}
              maxValue={maxValue}
              isLoaded={isLoaded}
              hoveredBar={hoveredBar}
              onHover={handleBarHover}
            />
          ))}
        </div>

        {/* Legend */}
        <ChartLegend />
      </CardContent>
    </Card>
  );
}

/** Period selector buttons */
function PeriodSelector({
  currentPeriod,
  onPeriodChange,
}: {
  currentPeriod: ChartPeriod;
  onPeriodChange: (period: ChartPeriod) => void;
}) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5" role="tablist">
      {CHART_PERIODS.map(({ value, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={currentPeriod === value}
          onClick={() => onPeriodChange(value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
            currentPeriod === value
              ? "bg-white text-slate-700 shadow-sm"
              : "text-slate-500 hover:text-slate-600"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Single bar group (revenue + expense) */
function ChartBar({
  data,
  index,
  maxValue,
  isLoaded,
  hoveredBar,
  onHover,
}: {
  data: ChartDataPoint;
  index: number;
  maxValue: number;
  isLoaded: boolean;
  hoveredBar: string | null;
  onHover: (barId: string | null) => void;
}) {
  const revenueId = `${index}-revenue`;
  const expenseId = `${index}-expense`;

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="w-full flex gap-2 items-end justify-center h-32 relative">
        {/* Revenue bar */}
        <BarWithTooltip
          id={revenueId}
          value={data.revenue}
          formattedValue={data.revenueFormatted}
          maxValue={maxValue}
          isLoaded={isLoaded}
          index={index}
          type="revenue"
          isHovered={hoveredBar === revenueId}
          onHover={onHover}
        />

        {/* Expense bar */}
        <BarWithTooltip
          id={expenseId}
          value={data.expenses}
          formattedValue={data.expensesFormatted}
          maxValue={maxValue}
          isLoaded={isLoaded}
          index={index}
          type="expense"
          isHovered={hoveredBar === expenseId}
          onHover={onHover}
        />
      </div>
      <span className="text-xs text-slate-500">{data.month}</span>
    </div>
  );
}

/** Individual bar with tooltip - Clickable to drill down */
function BarWithTooltip({
  id,
  value,
  formattedValue,
  maxValue,
  isLoaded,
  index,
  type,
  isHovered,
  onHover,
}: {
  id: string;
  value: number;
  formattedValue: string;
  maxValue: number;
  isLoaded: boolean;
  index: number;
  type: "revenue" | "expense";
  isHovered: boolean;
  onHover: (barId: string | null) => void;
}) {
  const router = useRouter();
  const isRevenue = type === "revenue";
  const baseColor = isRevenue ? "bg-emerald-500" : "bg-slate-400";
  const hoverColor = isRevenue ? "bg-emerald-600" : "bg-slate-500";
  const shadowColor = isRevenue ? "rgba(16, 185, 129, 0.4)" : "rgba(100, 116, 139, 0.4)";
  const tooltipLabel = isRevenue ? DASHBOARD_LABELS.revenue : DASHBOARD_LABELS.expenses;
  const tooltipLabelColor = isRevenue ? "text-emerald-300" : "text-slate-400";
  const delay = index * 150 + (isRevenue ? 0 : 75);

  const handleClick = () => {
    // Navigate to ledger filtered by type
    const filterType = isRevenue ? "income" : "expense";
    router.push(`/ledger?type=${filterType}`);
  };

  return (
    <div className="relative group">
      <div
        className={`w-8 ${isHovered ? hoverColor : baseColor} rounded-t cursor-pointer transition-all duration-500 ease-out btn-press`}
        style={{
          height: isLoaded ? `${(value / maxValue) * 100}px` : "0px",
          transitionDelay: `${delay}ms`,
          boxShadow: isHovered ? `0 4px 12px ${shadowColor}` : "none",
          minHeight: value > 0 ? "4px" : "0px",
        }}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        aria-label={`${tooltipLabel}: ${formattedValue} دينار - انقر للتفاصيل`}
      />
      {/* Tooltip */}
      <div
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap transition-all duration-200 z-10 ${
          isHovered ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2"
        }`}
        role="tooltip"
      >
        <div className="font-semibold">{formattedValue} {DASHBOARD_LABELS.currency}</div>
        <div className={`${tooltipLabelColor} text-[10px]`}>{tooltipLabel}</div>
        <div className="text-[9px] text-slate-400 mt-1">انقر للتفاصيل ←</div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

/** Chart legend */
function ChartLegend() {
  return (
    <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-emerald-500 rounded" aria-hidden="true" />
        <span className="text-xs text-slate-500">{DASHBOARD_LABELS.revenue}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-slate-400 rounded" aria-hidden="true" />
        <span className="text-xs text-slate-500">{DASHBOARD_LABELS.expenses}</span>
      </div>
    </div>
  );
}

export const DashboardBarChart = memo(DashboardBarChartComponent);
