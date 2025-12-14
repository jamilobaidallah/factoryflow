"use client";

import { memo, useState } from 'react';
import { ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { formatNumber } from '@/lib/date-utils';
import { REPORTS_LABELS } from '../constants/reports.constants';
import type { ReportsDetailedTablesProps, SubcategoryData } from '../types/reports.types';

/**
 * Detailed revenue and expenses tables with expandable subcategories
 */
function ReportsDetailedTablesComponent({
  revenueByCategory,
  expensesByCategory,
  expenseSubcategories,
  onExportExcel,
  onExportPDF,
}: ReportsDetailedTablesProps) {
  // Calculate totals
  const totalRevenue = Object.values(revenueByCategory).reduce((sum, val) => sum + val, 0);
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-700">
            {REPORTS_LABELS.detailedBreakdown}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {REPORTS_LABELS.exportExcel}
            </button>
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
              {REPORTS_LABELS.exportPDF}
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-x-reverse divide-slate-200">
        {/* Revenue Table */}
        <div className="p-5">
          <h4 className="text-sm font-semibold text-emerald-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            {REPORTS_LABELS.revenueByCategory}
          </h4>
          <div className="space-y-2">
            {Object.entries(revenueByCategory).map(([category, amount]) => (
              <CategoryRow
                key={category}
                category={category}
                amount={amount}
                type="revenue"
              />
            ))}
            {Object.keys(revenueByCategory).length === 0 && (
              <p className="text-sm text-slate-400 py-2">لا توجد إيرادات</p>
            )}
            {/* Total row */}
            <div className="flex items-center justify-between p-3 bg-emerald-100 rounded-lg mt-3">
              <span className="text-sm font-semibold text-emerald-800">
                {REPORTS_LABELS.totalAmount}
              </span>
              <span className="text-sm font-bold text-emerald-800">
                {formatNumber(totalRevenue)} د.أ
              </span>
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="p-5 border-t lg:border-t-0 border-slate-200">
          <h4 className="text-sm font-semibold text-rose-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full" />
            {REPORTS_LABELS.expensesByCategory2}
          </h4>
          <div className="space-y-2">
            {Object.entries(expensesByCategory).map(([category, amount]) => (
              <ExpandableCategoryRow
                key={category}
                category={category}
                amount={amount}
                subcategories={expenseSubcategories?.[category]}
              />
            ))}
            {Object.keys(expensesByCategory).length === 0 && (
              <p className="text-sm text-slate-400 py-2">لا توجد مصروفات</p>
            )}
            {/* Total row */}
            <div className="flex items-center justify-between p-3 bg-rose-100 rounded-lg mt-3">
              <span className="text-sm font-semibold text-rose-800">
                {REPORTS_LABELS.totalAmount}
              </span>
              <span className="text-sm font-bold text-rose-800">
                {formatNumber(totalExpenses)} د.أ
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simple category row (for revenue) - memoized to prevent re-renders */
const CategoryRow = memo(function CategoryRow({
  category,
  amount,
}: {
  category: string;
  amount: number;
  type: 'revenue' | 'expense';
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <span className="text-sm text-slate-700">{category}</span>
      <span className="text-sm font-semibold text-slate-800">{formatNumber(amount)} د.أ</span>
    </div>
  );
});

/** Expandable category row with subcategories (for expenses) */
function ExpandableCategoryRow({
  category,
  amount,
  subcategories,
}: {
  category: string;
  amount: number;
  subcategories?: SubcategoryData[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSubcategories = subcategories && subcategories.length > 0;

  return (
    <div className="group">
      <div
        onClick={() => hasSubcategories && setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between p-3 bg-slate-50 rounded-lg transition-colors ${
          hasSubcategories ? 'cursor-pointer hover:bg-slate-100' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700">{category}</span>
          {hasSubcategories && (
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
        <span className="text-sm font-semibold text-slate-800">{formatNumber(amount)} د.أ</span>
      </div>

      {/* Subcategories (expandable) */}
      {hasSubcategories && isExpanded && (
        <div className="mr-4 mt-1 space-y-1">
          {subcategories.map((sub, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-slate-50/50 rounded text-xs"
            >
              <span className="text-slate-500">↳ {sub.name}</span>
              <span className="text-slate-600">{formatNumber(sub.amount)} د.أ</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ReportsDetailedTables = memo(ReportsDetailedTablesComponent);
