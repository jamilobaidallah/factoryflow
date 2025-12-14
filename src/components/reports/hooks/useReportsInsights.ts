/**
 * useReportsInsights - Hook for auto-generating financial insights
 * Analyzes data patterns and generates actionable insights
 */

import { useMemo } from 'react';
import { formatNumber } from '@/lib/date-utils';
import type {
  Insight,
  ComparisonData,
  CategoryData,
  UseReportsInsightsReturn,
} from '../types/reports.types';

interface UseReportsInsightsProps {
  comparison: ComparisonData;
  expenseCategories: CategoryData[];
  hasComparisonData: boolean;
}

/**
 * Generate a unique ID for insights
 */
function generateInsightId(): string {
  return `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useReportsInsights({
  comparison,
  expenseCategories,
  hasComparisonData,
}: UseReportsInsightsProps): UseReportsInsightsReturn {
  const insights = useMemo(() => {
    const generatedInsights: Insight[] = [];

    // Only generate comparison insights if we have comparison data
    if (hasComparisonData) {
      // 1. Expense increase warning (>5% increase is concerning)
      const expenseChange = comparison.expenses.percentChange;
      if (expenseChange > 5) {
        generatedInsights.push({
          id: generateInsightId(),
          type: 'warning',
          icon: '⚠️',
          text: `المصروفات زادت ${Math.abs(expenseChange).toFixed(1)}% مقارنة بالفترة السابقة`,
          severity: 'high',
        });
      } else if (expenseChange < -10) {
        // Significant expense decrease is good
        generatedInsights.push({
          id: generateInsightId(),
          type: 'tip',
          icon: '✅',
          text: `المصروفات انخفضت ${Math.abs(expenseChange).toFixed(1)}% - استمر في ضبط النفقات`,
          severity: 'low',
        });
      }

      // 2. Revenue change insights
      const revenueChange = comparison.revenue.percentChange;
      if (revenueChange < -10) {
        generatedInsights.push({
          id: generateInsightId(),
          type: 'warning',
          icon: '📉',
          text: `الإيرادات انخفضت ${Math.abs(revenueChange).toFixed(1)}% - راجع استراتيجية المبيعات`,
          severity: 'high',
        });
      } else if (revenueChange > 15) {
        generatedInsights.push({
          id: generateInsightId(),
          type: 'info',
          icon: '📈',
          text: `نمو قوي في الإيرادات: +${revenueChange.toFixed(1)}%`,
          severity: 'medium',
        });
      }

      // 3. Profit margin change
      const marginChange = comparison.margin.percentChange;
      if (comparison.margin.current < comparison.margin.previous && marginChange < -5) {
        generatedInsights.push({
          id: generateInsightId(),
          type: 'warning',
          icon: '📊',
          text: `هامش الربح انخفض من ${comparison.margin.previous.toFixed(0)}% إلى ${comparison.margin.current.toFixed(0)}%`,
          severity: 'medium',
        });
      }
    }

    // 4. Loss warning (always check, regardless of comparison)
    if (comparison.profit.current < 0) {
      generatedInsights.push({
        id: generateInsightId(),
        type: 'warning',
        icon: '🔴',
        text: `الإيرادات أقل من المصروفات بـ ${formatNumber(Math.abs(comparison.profit.current))} دينار`,
        severity: 'high',
      });
    }

    // 5. Top expense category (always show)
    if (expenseCategories.length > 0) {
      const topCategory = expenseCategories[0]; // Already sorted by amount
      generatedInsights.push({
        id: generateInsightId(),
        type: 'info',
        icon: '📈',
        text: `أعلى فئة مصروفات: ${topCategory.name} (${topCategory.percent.toFixed(0)}%)`,
        severity: 'medium',
      });

      // 6. High concentration warning (one category > 50%)
      if (topCategory.percent > 50) {
        generatedInsights.push({
          id: generateInsightId(),
          type: 'tip',
          icon: '💡',
          text: `${topCategory.name} تشكل أكثر من نصف المصروفات - راجع إمكانية التخفيض`,
          severity: 'medium',
        });
      }
    }

    // 7. Low revenue warning
    if (comparison.revenue.current === 0 && comparison.expenses.current > 0) {
      generatedInsights.push({
        id: generateInsightId(),
        type: 'warning',
        icon: '⚠️',
        text: 'لا توجد إيرادات مسجلة في هذه الفترة',
        severity: 'high',
      });
    }

    // 8. Break-even tip
    if (comparison.profit.current > 0 && comparison.margin.current < 10) {
      generatedInsights.push({
        id: generateInsightId(),
        type: 'tip',
        icon: '💡',
        text: `هامش الربح منخفض (${comparison.margin.current.toFixed(1)}%) - حاول زيادة الأسعار أو تقليل التكاليف`,
        severity: 'low',
      });
    }

    // Sort by severity (high first)
    const severityOrder = { high: 0, medium: 1, low: 2 };
    generatedInsights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Limit to top 4 insights
    return generatedInsights.slice(0, 4);
  }, [comparison, expenseCategories, hasComparisonData]);

  return {
    insights,
    isLoading: false,
  };
}
