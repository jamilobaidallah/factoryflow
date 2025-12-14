"use client";

import { useState, useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { REPORTS_LABELS, CHART_PERIOD_OPTIONS } from '../constants/reports.constants';
import type { ReportsBarChartProps, ReportsChartDataPoint, ChartPeriodType } from '../types/reports.types';

/**
 * Revenue and Expenses bar chart with period selector
 */
function ReportsBarChartComponent({
  chartData,
  chartPeriod,
  isLoaded,
  onPeriodChange,
}: ReportsBarChartProps) {
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
            {REPORTS_LABELS.revenueAndExpenses}
          </CardTitle>
          <PeriodSelector currentPeriod={chartPeriod} onPeriodChange={onPeriodChange} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart area */}
        <div
          className="h-52 flex items-end justify-around gap-2 pt-6"
          role="img"
          aria-label={REPORTS_LABELS.revenueAndExpenses}
        >
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
  currentPeriod: ChartPeriodType;
  onPeriodChange: (period: ChartPeriodType) => void;
}) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5" role="tablist">
      {CHART_PERIOD_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={currentPeriod === value}
          onClick={() => onPeriodChange(value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
            currentPeriod === value
              ? 'bg-white text-slate-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-600'
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
  data: ReportsChartDataPoint;
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
      <div className="w-full flex gap-1 items-end justify-center h-40 relative">
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
      <span className="text-[10px] text-slate-500">{data.month}</span>
    </div>
  );
}

/** Individual bar with tooltip */
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
  type: 'revenue' | 'expense';
  isHovered: boolean;
  onHover: (barId: string | null) => void;
}) {
  const isRevenue = type === 'revenue';
  const baseColor = isRevenue ? 'bg-emerald-500' : 'bg-slate-400';
  const hoverColor = isRevenue ? 'bg-emerald-600' : 'bg-slate-500';
  const shadowColor = isRevenue ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.4)';
  const tooltipLabel = isRevenue ? REPORTS_LABELS.revenue : REPORTS_LABELS.expenses;
  const tooltipLabelColor = isRevenue ? 'text-emerald-300' : 'text-slate-400';
  const delay = index * 100 + (isRevenue ? 0 : 50);

  // Calculate bar height as percentage of max, scaled to 160px max height
  const barHeight = maxValue > 0 ? (value / maxValue) * 160 : 0;

  return (
    <div className="relative group">
      <div
        className={`w-6 ${isHovered ? hoverColor : baseColor} rounded-t cursor-pointer transition-all duration-500 ease-out`}
        style={{
          height: isLoaded ? `${barHeight}px` : '0px',
          transitionDelay: `${delay}ms`,
          boxShadow: isHovered ? `0 4px 12px ${shadowColor}` : 'none',
          minHeight: value > 0 ? '4px' : '0px',
        }}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        role="presentation"
      />
      {/* Tooltip */}
      <div
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap transition-all duration-200 z-10 ${
          isHovered ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'
        }`}
        role="tooltip"
      >
        <div className="font-semibold">
          {formattedValue} {REPORTS_LABELS.currency}
        </div>
        <div className={`${tooltipLabelColor} text-[10px]`}>{tooltipLabel}</div>
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
        <span className="text-xs text-slate-500">{REPORTS_LABELS.revenue}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-slate-400 rounded" aria-hidden="true" />
        <span className="text-xs text-slate-500">{REPORTS_LABELS.expenses}</span>
      </div>
    </div>
  );
}

export const ReportsBarChart = memo(ReportsBarChartComponent);
