"use client";

import { memo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatNumber } from '@/lib/date-utils';
import { REPORTS_LABELS } from '../constants/reports.constants';
import type { ReportsSummaryCardsProps, ComparisonResult } from '../types/reports.types';

/**
 * Summary cards section showing revenue, expenses, profit, and margin with comparison
 */
function ReportsSummaryCardsComponent({ comparison, isLoading }: ReportsSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-20 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-32 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <RevenueCard
        data={comparison.revenue}
        grossRevenue={comparison.grossRevenue}
        discounts={comparison.discounts}
      />
      <ExpensesCard data={comparison.expenses} />
      <ProfitCard data={comparison.profit} />
      <MarginCard data={comparison.margin} />
    </div>
  );
}

/** Revenue card with breakdown - shows gross, discounts, and net when applicable */
function RevenueCard({
  data,
  grossRevenue,
  discounts,
}: {
  data: ComparisonResult;
  grossRevenue?: number;
  discounts?: number;
}) {
  const hasDiscounts = discounts && discounts > 0;

  return (
    <article className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{REPORTS_LABELS.revenue}</span>
        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
          <ArrowUp className="w-5 h-5 text-emerald-600" />
        </div>
      </div>
      <p className="text-2xl font-bold text-emerald-600">{formatNumber(data.current)}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-400">{REPORTS_LABELS.currency}</p>
        <ChangeIndicator change={data.percentChange} isPositive={data.isPositive} />
      </div>

      {/* Revenue breakdown when discounts exist */}
      {hasDiscounts && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">{REPORTS_LABELS.grossRevenue}</span>
            <span className="text-slate-600">{formatNumber(grossRevenue || 0)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-amber-500">{REPORTS_LABELS.discounts}</span>
            <span className="text-amber-600">-{formatNumber(discounts)}</span>
          </div>
        </div>
      )}

      {data.previous > 0 && (
        <p className="text-[10px] text-slate-400 mt-1">
          {REPORTS_LABELS.previous} {formatNumber(data.previous)}
        </p>
      )}
    </article>
  );
}

/** Expenses card - increase is BAD (red) */
function ExpensesCard({ data }: { data: ComparisonResult }) {
  return (
    <article className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{REPORTS_LABELS.expenses}</span>
        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
          <ArrowDown className="w-5 h-5 text-rose-600" />
        </div>
      </div>
      <p className="text-2xl font-bold text-rose-600">{formatNumber(data.current)}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-400">{REPORTS_LABELS.currency}</p>
        {/* For expenses: increase is bad, so we invert the color logic */}
        <ChangeIndicator change={data.percentChange} isPositive={data.isPositive} invertColors />
      </div>
      {data.previous > 0 && (
        <p className="text-[10px] text-slate-400 mt-1">
          {REPORTS_LABELS.previous} {formatNumber(data.previous)}
        </p>
      )}
    </article>
  );
}

/** Profit/Loss card - dynamic color based on profit/loss */
function ProfitCard({ data }: { data: ComparisonResult }) {
  const isLoss = data.current < 0;

  return (
    <article
      className={`rounded-xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer ${
        isLoss ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{REPORTS_LABELS.netProfit}</span>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isLoss ? 'bg-rose-100' : 'bg-emerald-100'
          }`}
        >
          <span className={`text-lg font-bold ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isLoss ? '−' : '+'}
          </span>
        </div>
      </div>
      <p className={`text-2xl font-bold ${isLoss ? 'text-rose-700' : 'text-emerald-700'}`}>
        {formatNumber(Math.abs(data.current))}
      </p>
      <div className="flex items-center justify-between mt-2">
        <p className={`text-xs ${isLoss ? 'text-rose-500' : 'text-emerald-500'}`}>
          {isLoss ? REPORTS_LABELS.loss : REPORTS_LABELS.profit}
        </p>
        <ChangeIndicator change={data.percentChange} isPositive={data.isPositive} />
      </div>
    </article>
  );
}

/** Margin card - shows percentage */
function MarginCard({ data }: { data: ComparisonResult }) {
  const isNegative = data.current < 0;

  return (
    <article className="bg-white rounded-xl p-5 border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{REPORTS_LABELS.profitMargin}</span>
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <span className="text-slate-600 font-bold">%</span>
        </div>
      </div>
      <p className={`text-2xl font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
        {data.current.toFixed(1)}%
      </p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-400">{REPORTS_LABELS.fromRevenue}</p>
        <ChangeIndicator change={data.percentChange} isPositive={data.isPositive} />
      </div>
    </article>
  );
}

/** Change indicator showing percentage change with arrow */
function ChangeIndicator({
  change,
  isPositive,
  invertColors = false,
}: {
  change: number;
  isPositive: boolean;
  invertColors?: boolean;
}) {
  if (change === 0) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  const isUp = change > 0;
  // Determine color: normally green for positive change, red for negative
  // If invertColors (for expenses), flip it
  const showGreen = invertColors ? !isUp : isUp;

  return (
    <div
      className={`flex items-center gap-1 text-xs font-medium ${
        showGreen ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      <span>{isUp ? '↑' : '↓'}</span>
      <span>{Math.abs(change).toFixed(1)}%</span>
    </div>
  );
}

export const ReportsSummaryCards = memo(ReportsSummaryCardsComponent);
