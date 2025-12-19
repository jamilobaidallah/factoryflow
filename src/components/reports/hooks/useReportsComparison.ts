/**
 * useReportsComparison - Hook for period comparison calculations
 * Calculates current vs previous period data with % change
 */

import { useMemo } from 'react';
import { safeSubtract, safeDivide, safeMultiply } from '@/lib/currency';
import type {
  PeriodType,
  ComparisonType,
  ComparisonData,
  ComparisonResult,
  UseReportsComparisonReturn,
} from '../types/reports.types';

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: Date;
}

interface UseReportsComparisonProps {
  selectedPeriod: PeriodType;
  comparisonType: ComparisonType;
  ledgerEntries: LedgerEntry[];
  customStartDate?: Date;
  customEndDate?: Date;
}

/**
 * Calculate date range for a given period type
 */
function getDateRange(periodType: PeriodType, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (periodType) {
    case 'total':
      // All time - set start to a very early date
      start.setFullYear(2000, 0, 1);
      break;
    case 'today':
      // Start is already set to today
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'custom':
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd };
      }
      // Default to last month if no custom dates
      start.setMonth(start.getMonth() - 1);
      break;
  }

  return { start, end };
}

/**
 * Calculate comparison date range based on comparison type
 */
function getComparisonDateRange(
  comparisonType: ComparisonType,
  currentStart: Date,
  currentEnd: Date
): { start: Date; end: Date } | null {
  if (comparisonType === 'none') {
    return null;
  }

  const periodLength = currentEnd.getTime() - currentStart.getTime();
  let comparisonEnd: Date;
  let comparisonStart: Date;

  switch (comparisonType) {
    case 'lastMonth':
      comparisonEnd = new Date(currentStart);
      comparisonEnd.setDate(comparisonEnd.getDate() - 1);
      comparisonStart = new Date(comparisonEnd.getTime() - periodLength);
      break;
    case 'lastQuarter':
      comparisonEnd = new Date(currentStart);
      comparisonEnd.setMonth(comparisonEnd.getMonth() - 3);
      comparisonStart = new Date(comparisonEnd.getTime() - periodLength);
      break;
    case 'lastYear':
      comparisonStart = new Date(currentStart);
      comparisonStart.setFullYear(comparisonStart.getFullYear() - 1);
      comparisonEnd = new Date(currentEnd);
      comparisonEnd.setFullYear(comparisonEnd.getFullYear() - 1);
      break;
    default:
      return null;
  }

  return { start: comparisonStart, end: comparisonEnd };
}

/**
 * Filter entries by date range
 */
function filterEntriesByDateRange(
  entries: LedgerEntry[],
  start: Date,
  end: Date
): LedgerEntry[] {
  return entries.filter((entry) => {
    const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
    return entryDate >= start && entryDate <= end;
  });
}

/**
 * Calculate period data (revenue, expenses, profit, margin)
 */
function calculatePeriodData(entries: LedgerEntry[]): {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
} {
  let revenue = 0;
  let expenses = 0;

  entries.forEach((entry) => {
    // Exclude owner equity transactions
    if (entry.category === 'رأس المال' || entry.category === 'Owner Equity') {
      return;
    }

    if (entry.type === 'دخل') {
      revenue += entry.amount;
    } else if (entry.type === 'مصروف') {
      expenses += entry.amount;
    }
  });

  const profit = safeSubtract(revenue, expenses);
  const margin = revenue > 0 ? safeMultiply(safeDivide(profit, revenue), 100) : 0;

  return { revenue, expenses, profit, margin };
}

/**
 * Calculate comparison result for a single metric
 */
function calculateComparisonResult(
  current: number,
  previous: number,
  isExpense: boolean = false
): ComparisonResult {
  const percentChange = previous !== 0
    ? safeMultiply(safeDivide(safeSubtract(current, previous), Math.abs(previous)), 100)
    : current > 0 ? 100 : 0;

  // For expenses, decrease is positive (good)
  // For revenue/profit, increase is positive (good)
  const isPositive = isExpense
    ? percentChange < 0
    : percentChange > 0;

  return {
    current,
    previous,
    percentChange,
    isPositive,
  };
}

export function useReportsComparison({
  selectedPeriod,
  comparisonType,
  ledgerEntries,
  customStartDate,
  customEndDate,
}: UseReportsComparisonProps): UseReportsComparisonReturn {
  const result = useMemo(() => {
    // Calculate date ranges
    const dateRange = getDateRange(selectedPeriod, customStartDate, customEndDate);
    const comparisonDateRange = getComparisonDateRange(
      comparisonType,
      dateRange.start,
      dateRange.end
    );

    // Filter entries for current period
    const currentEntries = filterEntriesByDateRange(
      ledgerEntries,
      dateRange.start,
      dateRange.end
    );
    const currentData = calculatePeriodData(currentEntries);

    // Filter entries for comparison period (if applicable)
    let previousData = { revenue: 0, expenses: 0, profit: 0, margin: 0 };
    if (comparisonDateRange) {
      const previousEntries = filterEntriesByDateRange(
        ledgerEntries,
        comparisonDateRange.start,
        comparisonDateRange.end
      );
      previousData = calculatePeriodData(previousEntries);
    }

    // Build comparison data
    const comparison: ComparisonData = {
      revenue: calculateComparisonResult(currentData.revenue, previousData.revenue, false),
      expenses: calculateComparisonResult(currentData.expenses, previousData.expenses, true),
      profit: calculateComparisonResult(currentData.profit, previousData.profit, false),
      margin: calculateComparisonResult(currentData.margin, previousData.margin, false),
    };

    return {
      comparison,
      isLoading: false,
      dateRange,
      comparisonDateRange,
    };
  }, [selectedPeriod, comparisonType, ledgerEntries, customStartDate, customEndDate]);

  return result;
}
