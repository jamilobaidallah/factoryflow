"use client";

import { memo } from 'react';
import { REPORTS_LABELS, QUICK_REPORTS } from '../constants/reports.constants';
import type { ReportsQuickAccessProps, QuickReport } from '../types/reports.types';

/**
 * Quick access section with 4 clickable report cards
 */
function ReportsQuickAccessComponent({
  onReportClick,
  activeReport,
  isLoaded,
}: ReportsQuickAccessProps) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <span>📋</span>
          {REPORTS_LABELS.quickReports}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_REPORTS.map((report, index) => (
          <QuickReportCard
            key={report.id}
            report={report}
            isActive={activeReport === report.id}
            isLoaded={isLoaded}
            index={index}
            onClick={() => onReportClick(report.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Individual quick report card */
function QuickReportCard({
  report,
  isActive,
  isLoaded,
  index,
  onClick,
}: {
  report: QuickReport;
  isActive: boolean;
  isLoaded: boolean;
  index: number;
  onClick: () => void;
}) {
  // Color classes based on report color
  const colorClasses: Record<QuickReport['color'], { border: string; bg: string }> = {
    emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50' },
    blue: { border: 'border-blue-500', bg: 'bg-blue-50' },
    amber: { border: 'border-amber-500', bg: 'bg-amber-50' },
    purple: { border: 'border-purple-500', bg: 'bg-purple-50' },
  };

  const colors = colorClasses[report.color];

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
        isActive ? `${colors.border} ${colors.bg}` : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      style={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.4s ease-out ${index * 100}ms`,
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      <div className="text-3xl mb-3">{report.icon}</div>
      <h4 className="font-semibold text-slate-800 mb-1">{report.title}</h4>
      <p className="text-xs text-slate-500">{report.description}</p>
    </div>
  );
}

export const ReportsQuickAccess = memo(ReportsQuickAccessComponent);
