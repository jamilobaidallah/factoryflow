"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw } from "lucide-react";
import { DatePresetButtons } from "./DatePresetButtons";
import { FilterDropdown } from "./FilterDropdown";
import {
  LedgerFiltersState,
  DatePreset,
  EntryType,
  PaymentStatus,
} from "./useLedgerFilters";
import { LedgerEntry } from "../types/ledger";

/** Props for LedgerFilters component */
interface LedgerFiltersProps {
  filters: LedgerFiltersState;
  onDatePresetChange: (preset: DatePreset) => void;
  onEntryTypeChange: (type: EntryType) => void;
  onCategoryChange: (category: string) => void;
  onPaymentStatusChange: (status: PaymentStatus) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  entries: LedgerEntry[];
  filteredCount: number;
  totalCount: number;
}

// Type options
const typeOptions: { value: EntryType; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "دخل", label: "دخل" },
  { value: "مصروف", label: "مصروف" },
];

// Payment status options
const paymentStatusOptions: { value: PaymentStatus; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "paid", label: "مدفوع" },
  { value: "unpaid", label: "غير مدفوع" },
  { value: "partial", label: "جزئي" },
];

/**
 * Main filter bar component for the Ledger page.
 * Combines date presets, dropdown filters, and a clear button.
 * Displays filtered results count.
 */
export function LedgerFilters({
  filters,
  onDatePresetChange,
  onEntryTypeChange,
  onCategoryChange,
  onPaymentStatusChange,
  onClearFilters,
  hasActiveFilters,
  entries,
  filteredCount,
  totalCount,
}: LedgerFiltersProps) {
  // Extract unique categories from entries
  const categoryOptions = useMemo(() => {
    const categories = new Set(entries.map((e) => e.category).filter(Boolean));
    return [
      { value: "all", label: "الكل" },
      ...Array.from(categories).map((cat) => ({ value: cat, label: cat })),
    ];
  }, [entries]);

  return (
    <Card className="mb-4">
      <CardContent className="pt-4 pb-3">
        {/* Date Presets Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
          <span className="text-sm font-medium text-muted-foreground min-w-fit">
            الفترة:
          </span>
          <DatePresetButtons
            selected={filters.datePreset}
            onSelect={onDatePresetChange}
          />
        </div>

        {/* Dropdowns Row */}
        <div className="flex flex-wrap items-end gap-3">
          <FilterDropdown
            label="النوع"
            value={filters.entryType}
            options={typeOptions}
            onChange={(val) => onEntryTypeChange(val as EntryType)}
          />

          <FilterDropdown
            label="التصنيف"
            value={filters.category}
            options={categoryOptions}
            onChange={onCategoryChange}
          />

          <FilterDropdown
            label="الحالة"
            value={filters.paymentStatus}
            options={paymentStatusOptions}
            onChange={(val) => onPaymentStatusChange(val as PaymentStatus)}
          />

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-4 h-4 ml-1" />
              مسح الفلاتر
            </Button>
          )}

          {/* Results Count */}
          <div className="flex-1 text-left">
            <span className="text-sm text-muted-foreground">
              عرض {filteredCount} من {totalCount} حركة
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
