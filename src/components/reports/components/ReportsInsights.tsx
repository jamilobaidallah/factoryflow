"use client";

import { memo } from 'react';
import { REPORTS_LABELS } from '../constants/reports.constants';
import type { ReportsInsightsProps, Insight } from '../types/reports.types';

/**
 * Auto-generated financial insights section
 */
function ReportsInsightsComponent({ insights, isLoaded }: ReportsInsightsProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">💡</span>
        <h3 className="text-base font-semibold text-slate-700">
          {REPORTS_LABELS.financialInsights}
        </h3>
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          {REPORTS_LABELS.automatic}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight, index) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            index={index}
            isLoaded={isLoaded}
          />
        ))}
      </div>
    </div>
  );
}

/** Individual insight card */
function InsightCard({
  insight,
  index,
  isLoaded,
}: {
  insight: Insight;
  index: number;
  isLoaded: boolean;
}) {
  // Border color based on severity
  const borderClass = insight.severity === 'high' ? 'border-rose-200' : 'border-slate-200';

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg bg-white/70 backdrop-blur-sm border transition-all duration-300 hover:shadow-md ${borderClass}`}
      style={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateX(0)' : 'translateX(-20px)',
        transition: `all 0.4s ease-out ${index * 100 + 400}ms`,
      }}
    >
      <span className="text-lg flex-shrink-0">{insight.icon}</span>
      <p className="text-sm text-slate-700">{insight.text}</p>
    </div>
  );
}

export const ReportsInsights = memo(ReportsInsightsComponent);
