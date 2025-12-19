"use client";

import { useState, useMemo, memo } from "react";
import { Search, Filter, Download, X, FileSpreadsheet, FileText } from "lucide-react";
import {
  LedgerFiltersState,
  DatePreset,
  EntryType,
  ViewMode,
  FilteredTotals,
} from "./useLedgerFilters";
import { LedgerEntry } from "../types/ledger";
import { CATEGORIES } from "../utils/ledger-constants";
import { formatNumber } from "@/lib/date-utils";

/** Props for LedgerFilters component */
interface LedgerFiltersProps {
  filters: LedgerFiltersState;
  onDatePresetChange: (preset: DatePreset) => void;
  onEntryTypeChange: (type: EntryType) => void;
  onCategoryChange: (category: string) => void;
  onSubCategoryChange: (subCategory: string) => void;
  onSearchChange: (search: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  entries: LedgerEntry[];
  filteredEntries: LedgerEntry[];
  filteredTotals: FilteredTotals;
  unpaidCount: number;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

/** View mode tab configuration */
const viewModeTabs: { id: ViewMode; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "income", label: "الدخل" },
  { id: "expense", label: "المصروفات" },
  { id: "unpaid", label: "غير المدفوع" },
];

/** Period/date preset tabs */
const periodTabs: { id: DatePreset; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "الأسبوع" },
  { id: "month", label: "الشهر" },
  { id: "all", label: "الكل" },
];

/** Type options for advanced filter */
const typeOptions: { value: EntryType; label: string }[] = [
  { value: "all", label: "جميع الأنواع" },
  { value: "دخل", label: "دخل" },
  { value: "مصروف", label: "مصروف" },
  { value: "حركة رأس مال", label: "حركة رأس مال" },
];

/**
 * Main filter bar component for the Ledger page.
 * Features: view mode tabs, search, advanced filters toggle, period tabs, export buttons.
 */
function LedgerFiltersComponent({
  filters,
  onDatePresetChange,
  onEntryTypeChange,
  onCategoryChange,
  onSubCategoryChange,
  onSearchChange,
  onViewModeChange,
  onClearFilters,
  hasActiveFilters,
  entries,
  filteredEntries,
  filteredTotals,
  unpaidCount,
  onExportExcel,
  onExportPDF,
}: LedgerFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Get available categories based on selected entry type
  const availableCategories = useMemo(() => {
    if (filters.entryType === "all") {
      return CATEGORIES.map((cat) => cat.name);
    }
    return CATEGORIES.filter((cat) => cat.type === filters.entryType).map((cat) => cat.name);
  }, [filters.entryType]);

  // Get available subcategories based on selected category
  const availableSubcategories = useMemo(() => {
    if (filters.category === "all") return [];
    const category = CATEGORIES.find((cat) => cat.name === filters.category);
    return category?.subcategories || [];
  }, [filters.category]);

  // Check if advanced filters have any active values
  const hasAdvancedFilters =
    filters.entryType !== "all" ||
    filters.category !== "all" ||
    filters.subCategory !== "all";

  return (
    <div className="space-y-4">
      {/* Main Filter Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View Mode Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {viewModeTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onViewModeChange(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  filters.viewMode === tab.id
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
                {tab.id === "unpaid" && unpaidCount > 0 && (
                  <span className="mr-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full">
                    {unpaidCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="flex-1 max-w-sm min-w-[200px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="البحث..."
                value={filters.search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              showAdvancedFilters || hasAdvancedFilters
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Filter className="w-5 h-5" />
            فلاتر متقدمة
            {hasAdvancedFilters && (
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>

          {/* Period Filter */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {periodTabs.map((period) => (
              <button
                key={period.id}
                onClick={() => onDatePresetChange(period.id)}
                className={`px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                  filters.datePreset === period.id
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-600"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onExportExcel}
              disabled={filteredEntries.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={onExportPDF}
              disabled={filteredEntries.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-end gap-4">
            {/* Type Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                النوع
              </label>
              <select
                value={filters.entryType}
                onChange={(e) => onEntryTypeChange(e.target.value as EntryType)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                التصنيف
              </label>
              <select
                value={filters.category}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="all">جميع التصنيفات</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                التصنيف الفرعي
              </label>
              <select
                value={filters.subCategory}
                onChange={(e) => onSubCategoryChange(e.target.value)}
                disabled={filters.category === "all"}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all ${
                  filters.category === "all"
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <option value="all">
                  {filters.category === "all"
                    ? "اختر التصنيف أولاً"
                    : "جميع التصنيفات الفرعية"}
                </option>
                {availableSubcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasAdvancedFilters && (
              <button
                onClick={onClearFilters}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Summary with Totals */}
      {hasActiveFilters && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-blue-800">
                الفلاتر النشطة:
              </span>

              {/* View Mode Badge */}
              {filters.viewMode !== "all" && (
                <FilterBadge
                  label={
                    filters.viewMode === "unpaid"
                      ? "غير المدفوع"
                      : filters.viewMode === "income"
                      ? "الدخل"
                      : "المصروفات"
                  }
                  onRemove={() => onViewModeChange("all")}
                />
              )}

              {/* Date Preset Badge */}
              {filters.datePreset !== "all" && (
                <FilterBadge
                  label={`الفترة: ${
                    filters.datePreset === "today"
                      ? "اليوم"
                      : filters.datePreset === "week"
                      ? "الأسبوع"
                      : "الشهر"
                  }`}
                  onRemove={() => onDatePresetChange("all")}
                />
              )}

              {/* Search Badge */}
              {filters.search && (
                <FilterBadge
                  label={`البحث: ${filters.search}`}
                  onRemove={() => onSearchChange("")}
                />
              )}

              {/* Type Badge */}
              {filters.entryType !== "all" && (
                <FilterBadge
                  label={`النوع: ${filters.entryType}`}
                  onRemove={() => onEntryTypeChange("all")}
                />
              )}

              {/* Category Badge */}
              {filters.category !== "all" && (
                <FilterBadge
                  label={`التصنيف: ${filters.category}`}
                  onRemove={() => onCategoryChange("all")}
                />
              )}

              {/* Subcategory Badge */}
              {filters.subCategory !== "all" && (
                <FilterBadge
                  label={filters.subCategory}
                  onRemove={() => onSubCategoryChange("all")}
                  variant="purple"
                />
              )}
            </div>

            {/* Filtered Totals */}
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">عدد الحركات:</span>
                <span className="font-bold text-slate-800">
                  {filteredTotals.count}
                </span>
              </div>
              {filteredTotals.income > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">الدخل:</span>
                  <span className="font-bold text-emerald-600">
                    {formatNumber(filteredTotals.income)}
                  </span>
                </div>
              )}
              {filteredTotals.expenses > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">المصروفات:</span>
                  <span className="font-bold text-rose-600">
                    {formatNumber(filteredTotals.expenses)}
                  </span>
                </div>
              )}
              {/* Equity Stats - shown when equity entries are present */}
              {filteredTotals.equityIn > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">الاستثمارات:</span>
                  <span className="font-bold text-green-600">
                    {formatNumber(filteredTotals.equityIn)}
                  </span>
                </div>
              )}
              {filteredTotals.equityOut > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">السحوبات:</span>
                  <span className="font-bold text-red-600">
                    {formatNumber(filteredTotals.equityOut)}
                  </span>
                </div>
              )}
              {(filteredTotals.equityIn > 0 || filteredTotals.equityOut > 0) && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">صافي رأس المال:</span>
                  <span className={`font-bold ${filteredTotals.equityIn - filteredTotals.equityOut >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {formatNumber(filteredTotals.equityIn - filteredTotals.equityOut)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Filter badge component for active filters summary */
function FilterBadge({
  label,
  onRemove,
  variant = "blue",
}: {
  label: string;
  onRemove: () => void;
  variant?: "blue" | "purple";
}) {
  const colorClasses =
    variant === "purple"
      ? "bg-white text-purple-800 border-purple-200"
      : "bg-white text-blue-800 border-blue-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${colorClasses}`}
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:opacity-70 transition-opacity"
        aria-label={`إزالة فلتر ${label}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

export const LedgerFilters = memo(LedgerFiltersComponent);
