"use client";

import { memo } from 'react';
import {
  REPORTS_LABELS,
  PERIOD_OPTIONS,
  COMPARISON_OPTIONS,
} from '../constants/reports.constants';
import type { ReportsPeriodSelectorProps, PeriodType, ComparisonType } from '../types/reports.types';

/**
 * Period selection bar with quick buttons and comparison dropdown
 */
function ReportsPeriodSelectorComponent({
  selectedPeriod,
  comparisonType,
  onPeriodChange,
  onComparisonChange,
  onCustomDateClick,
}: ReportsPeriodSelectorProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Quick Period Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 ml-2">{REPORTS_LABELS.period}</span>
          <div className="flex bg-slate-100 rounded-lg p-1">
            {PERIOD_OPTIONS.filter(opt => opt.id !== 'custom').map((option) => (
              <button
                key={option.id}
                onClick={() => onPeriodChange(option.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  selectedPeriod === option.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom date link */}
          <button
            onClick={onCustomDateClick}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedPeriod === 'custom'
                ? 'text-blue-700'
                : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            {REPORTS_LABELS.custom}
          </button>
        </div>

        {/* Comparison Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{REPORTS_LABELS.compareTo}</span>
          <select
            value={comparisonType}
            onChange={(e) => onComparisonChange(e.target.value as ComparisonType)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            {COMPARISON_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export const ReportsPeriodSelector = memo(ReportsPeriodSelectorComponent);
