"use client";

import { useState, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/date-utils';
import { REPORTS_LABELS } from '../constants/reports.constants';
import type { ReportsDonutChartProps, CategoryData } from '../types/reports.types';

/** SVG chart constants */
const CHART_CONFIG = {
  WIDTH: 180,
  HEIGHT: 180,
  CENTER_X: 90,
  CENTER_Y: 90,
  RADIUS: 60,
  INNER_RADIUS: 42,
  STROKE_WIDTH: 24,
  STROKE_WIDTH_HOVER: 28,
} as const;

/**
 * Expense breakdown donut chart with 3D effect and interactive segments
 */
function ReportsDonutChartComponent({
  categories,
  totalAmount,
  isLoaded,
  onDetailsClick,
}: ReportsDonutChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const handleSegmentHover = useCallback((segmentId: string | null) => {
    setHoveredSegment(segmentId);
  }, []);

  const hasData = categories.length > 0;

  // Calculate cumulative offsets for segments
  const categoriesWithOffset = categories.map((cat, index) => {
    const offset = categories.slice(0, index).reduce((acc, c) => acc + c.percent, 0);
    return { ...cat, offset };
  });

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">
            {REPORTS_LABELS.expensesByCategory}
          </CardTitle>
          {onDetailsClick && (
            <button
              onClick={onDetailsClick}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {REPORTS_LABELS.details}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState />
        ) : (
          <div className="flex items-center justify-center gap-8">
            <DonutChart
              categories={categoriesWithOffset}
              totalAmount={totalAmount}
              isLoaded={isLoaded}
              hoveredSegment={hoveredSegment}
              onSegmentHover={handleSegmentHover}
            />
            <ChartLegend
              categories={categoriesWithOffset}
              hoveredSegment={hoveredSegment}
              onSegmentHover={handleSegmentHover}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Empty state when no data */
function EmptyState() {
  return <p className="text-slate-500 text-center py-8">لا توجد مصروفات</p>;
}

/** SVG Donut chart with 3D effect */
function DonutChart({
  categories,
  totalAmount,
  isLoaded,
  hoveredSegment,
  onSegmentHover,
}: {
  categories: (CategoryData & { offset: number })[];
  totalAmount: number;
  isLoaded: boolean;
  hoveredSegment: string | null;
  onSegmentHover: (id: string | null) => void;
}) {
  const hoveredCategory = categories.find((c) => c.id === hoveredSegment);

  return (
    <div className="relative" style={{ perspective: '1000px' }}>
      <svg
        width={CHART_CONFIG.WIDTH}
        height={CHART_CONFIG.HEIGHT}
        viewBox={`0 0 ${CHART_CONFIG.WIDTH} ${CHART_CONFIG.HEIGHT}`}
        style={{
          transform: 'rotateX(10deg)',
          filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))',
        }}
        role="img"
        aria-label={REPORTS_LABELS.expensesByCategory}
      >
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
        <circle cx={CHART_CONFIG.CENTER_X} cy={CHART_CONFIG.CENTER_Y} r={CHART_CONFIG.INNER_RADIUS} fill="white" />
      </svg>

      {/* Center text */}
      <CenterDisplay hoveredCategory={hoveredCategory} totalAmount={totalAmount} />
    </div>
  );
}

/** Individual donut segment */
function DonutSegment({
  segment,
  index,
  isLoaded,
  isHovered,
  onHover,
}: {
  segment: CategoryData & { offset: number };
  index: number;
  isLoaded: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const circumference = 2 * Math.PI * CHART_CONFIG.RADIUS;
  const segmentLength = (segment.percent / 100) * circumference;
  const segmentOffset = (segment.offset / 100) * circumference;

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
        transition: 'all 0.5s ease-out',
        transitionDelay: `${index * 150}ms`,
        filter: isHovered ? 'brightness(1.1)' : 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={() => onHover(segment.id)}
      onMouseLeave={() => onHover(null)}
    />
  );
}

/** Center display showing total or hovered segment */
function CenterDisplay({
  hoveredCategory,
  totalAmount,
}: {
  hoveredCategory: (CategoryData & { offset: number }) | undefined;
  totalAmount: number;
}) {
  return (
    <div
      className="absolute flex flex-col items-center justify-center transition-all duration-300"
      style={{
        top: '45%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      {hoveredCategory ? (
        <>
          <p className="text-lg font-bold text-slate-800">{formatNumber(hoveredCategory.amount)}</p>
          <p className="text-xs text-slate-500">{hoveredCategory.percent.toFixed(0)}%</p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-slate-800">{formatNumber(totalAmount)}</p>
          <p className="text-xs text-slate-400">{REPORTS_LABELS.total}</p>
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
  categories: (CategoryData & { offset: number })[];
  hoveredSegment: string | null;
  onSegmentHover: (id: string | null) => void;
}) {
  return (
    <div className="space-y-2">
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

/** Single legend item */
function LegendItem({
  item,
  isHovered,
  onHover,
}: {
  item: CategoryData;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 cursor-pointer ${
        isHovered ? 'bg-slate-50 scale-105' : ''
      }`}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className="w-3 h-3 rounded transition-transform duration-200"
        style={{
          backgroundColor: item.color,
          transform: isHovered ? 'scale(1.2)' : 'scale(1)',
        }}
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className="text-sm text-slate-700">{item.name}</p>
      </div>
      <span className="text-sm font-medium text-slate-600">{item.percent.toFixed(0)}%</span>
    </div>
  );
}

export const ReportsDonutChart = memo(ReportsDonutChartComponent);
