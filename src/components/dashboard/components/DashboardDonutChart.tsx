"use client";

import { useState, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/date-utils";
import { DASHBOARD_LABELS } from "../constants/dashboard.constants";
import type { DashboardDonutChartProps, ExpenseCategory, ViewMode } from "../types/dashboard.types";

/** SVG chart constants */
const CHART_CONFIG = {
  WIDTH: 220,
  HEIGHT: 220,
  CENTER_X: 110,
  CENTER_Y: 100,
  RADIUS: 70,
  INNER_RADIUS: 50,
  STROKE_WIDTH: 28,
  STROKE_WIDTH_HOVER: 32,
  SHADOW_CY: 130,
  SHADOW_RX: 75,
  SHADOW_RY: 20,
} as const;

/**
 * Expense breakdown donut chart with 3D effect
 * Features interactive segments and legend
 */
function DashboardDonutChartComponent({
  categories,
  totalAmount,
  viewMode,
  selectedMonth,
  availableMonths,
  isLoaded,
  onViewModeChange,
  onMonthChange,
}: DashboardDonutChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const handleSegmentHover = useCallback((segmentId: string | null) => {
    setHoveredSegment(segmentId);
  }, []);

  const hasData = categories.length > 0;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">
            {DASHBOARD_LABELS.expensesByCategory}
          </CardTitle>
          <HeaderControls
            viewMode={viewMode}
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
            onViewModeChange={onViewModeChange}
            onMonthChange={onMonthChange}
          />
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState viewMode={viewMode} />
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <DonutChart
              categories={categories}
              totalAmount={totalAmount}
              isLoaded={isLoaded}
              hoveredSegment={hoveredSegment}
              onSegmentHover={handleSegmentHover}
            />
            <ChartLegend
              categories={categories}
              hoveredSegment={hoveredSegment}
              onSegmentHover={handleSegmentHover}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Header controls (month selector + view toggle) */
function HeaderControls({
  viewMode,
  selectedMonth,
  availableMonths,
  onViewModeChange,
  onMonthChange,
}: {
  viewMode: ViewMode;
  selectedMonth: string;
  availableMonths: { value: string; label: string }[];
  onViewModeChange: (mode: ViewMode) => void;
  onMonthChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {viewMode === "month" && (
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:border-slate-400 transition-colors"
          aria-label="Select month"
        >
          {availableMonths.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      )}

      <div className="flex bg-slate-200 rounded-lg p-1" role="tablist">
        <button
          role="tab"
          aria-selected={viewMode === "month"}
          onClick={() => onViewModeChange("month")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            viewMode === "month"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {DASHBOARD_LABELS.monthly}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === "total"}
          onClick={() => onViewModeChange("total")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            viewMode === "total"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {DASHBOARD_LABELS.total}
        </button>
      </div>
    </div>
  );
}

/** Empty state when no data */
function EmptyState({ viewMode }: { viewMode: ViewMode }) {
  const message =
    viewMode === "month" ? DASHBOARD_LABELS.noExpensesThisMonth : DASHBOARD_LABELS.noExpenses;

  return <p className="text-slate-500 text-center py-8">{message}</p>;
}

/** SVG Donut chart with 3D effect */
function DonutChart({
  categories,
  totalAmount,
  isLoaded,
  hoveredSegment,
  onSegmentHover,
}: {
  categories: ExpenseCategory[];
  totalAmount: number;
  isLoaded: boolean;
  hoveredSegment: string | null;
  onSegmentHover: (id: string | null) => void;
}) {
  const hoveredCategory = categories.find((c) => c.id === hoveredSegment);

  return (
    <div className="relative" style={{ perspective: "1000px" }}>
      <svg
        width={CHART_CONFIG.WIDTH}
        height={CHART_CONFIG.HEIGHT}
        viewBox={`0 0 ${CHART_CONFIG.WIDTH} ${CHART_CONFIG.HEIGHT}`}
        style={{
          transform: "rotateX(15deg)",
          filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.15))",
        }}
        role="img"
        aria-label={DASHBOARD_LABELS.expensesByCategory}
      >
        {/* Shadow/Depth Layer */}
        <ellipse
          cx={CHART_CONFIG.CENTER_X}
          cy={CHART_CONFIG.SHADOW_CY}
          rx={CHART_CONFIG.SHADOW_RX}
          ry={CHART_CONFIG.SHADOW_RY}
          fill="rgba(0,0,0,0.1)"
        />

        {/* Donut segments */}
        {categories.map((segment, index) => (
          <DonutSegment
            key={segment.id}
            segment={segment}
            index={index}
            isLoaded={isLoaded}
            isHovered={hoveredSegment === segment.id}
            onHover={onSegmentHover}
          />
        ))}

        {/* Inner circle (white center) */}
        <circle
          cx={CHART_CONFIG.CENTER_X}
          cy={CHART_CONFIG.CENTER_Y}
          r={CHART_CONFIG.INNER_RADIUS}
          fill="white"
        />
      </svg>

      {/* Center text */}
      <CenterDisplay hoveredCategory={hoveredCategory} totalAmount={totalAmount} />
    </div>
  );
}

/** Individual donut segment - Clickable to drill down to category */
function DonutSegment({
  segment,
  index,
  isLoaded,
  isHovered,
  onHover,
}: {
  segment: ExpenseCategory;
  index: number;
  isLoaded: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const router = useRouter();
  const circumference = 2 * Math.PI * CHART_CONFIG.RADIUS;
  const segmentLength = (segment.percent / 100) * circumference;
  const segmentOffset = (segment.offset / 100) * circumference;

  const handleClick = () => {
    // Navigate to ledger filtered by this expense category
    router.push(`/ledger?type=expense&category=${encodeURIComponent(segment.id)}`);
  };

  return (
    <circle
      cx={CHART_CONFIG.CENTER_X}
      cy={CHART_CONFIG.CENTER_Y}
      r={CHART_CONFIG.RADIUS}
      fill="none"
      stroke={segment.color}
      strokeWidth={isHovered ? CHART_CONFIG.STROKE_WIDTH_HOVER : CHART_CONFIG.STROKE_WIDTH}
      strokeDasharray={`${isLoaded ? segmentLength : 0} ${circumference}`}
      strokeDashoffset={-segmentOffset}
      transform={`rotate(-90 ${CHART_CONFIG.CENTER_X} ${CHART_CONFIG.CENTER_Y})`}
      style={{
        transition: "all 0.5s ease-out",
        transitionDelay: `${index * 200}ms`,
        filter: isHovered ? "brightness(1.1)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={() => onHover(segment.id)}
      onMouseLeave={() => onHover(null)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${segment.label}: ${formatNumber(segment.amount)} دينار - انقر للتفاصيل`}
    />
  );
}

/** Center display showing total or hovered segment */
function CenterDisplay({
  hoveredCategory,
  totalAmount,
}: {
  hoveredCategory: ExpenseCategory | undefined;
  totalAmount: number;
}) {
  return (
    <div
      className="absolute flex flex-col items-center justify-center transition-all duration-300"
      style={{
        top: "38%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      {hoveredCategory ? (
        <>
          <p className="text-lg font-semibold text-slate-800">
            {formatNumber(hoveredCategory.amount)}
          </p>
          <p className="text-xs text-slate-500">{hoveredCategory.percent.toFixed(0)}%</p>
        </>
      ) : (
        <>
          <p className="text-2xl font-semibold text-slate-800">{formatNumber(totalAmount)}</p>
          <p className="text-sm text-slate-400">{DASHBOARD_LABELS.currency}</p>
        </>
      )}
    </div>
  );
}

/** Interactive legend */
function ChartLegend({
  categories,
  hoveredSegment,
  onSegmentHover,
}: {
  categories: ExpenseCategory[];
  hoveredSegment: string | null;
  onSegmentHover: (id: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      {categories.map((item) => (
        <LegendItem
          key={item.id}
          item={item}
          isHovered={hoveredSegment === item.id}
          onHover={onSegmentHover}
        />
      ))}
    </div>
  );
}

/** Single legend item - Clickable to drill down */
function LegendItem({
  item,
  isHovered,
  onHover,
}: {
  item: ExpenseCategory;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/ledger?type=expense&category=${encodeURIComponent(item.id)}`);
  };

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 cursor-pointer btn-press ${
        isHovered ? "bg-slate-50 scale-105" : ""
      }`}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`${item.label}: ${formatNumber(item.amount)} دينار - انقر للتفاصيل`}
    >
      <div
        className="w-4 h-4 rounded transition-transform duration-200"
        style={{
          backgroundColor: item.color,
          transform: isHovered ? "scale(1.2)" : "scale(1)",
        }}
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className="text-sm text-slate-700">{item.label}</p>
      </div>
      <span className="text-sm font-medium text-slate-600 w-24 text-left">
        {formatNumber(item.amount)}
      </span>
      <span
        className={`text-sm w-10 text-left transition-colors duration-200 ${
          isHovered ? "text-slate-800 font-semibold" : "text-slate-400"
        }`}
      >
        {item.percent.toFixed(0)}%
      </span>
    </div>
  );
}

export const DashboardDonutChart = memo(DashboardDonutChartComponent);
