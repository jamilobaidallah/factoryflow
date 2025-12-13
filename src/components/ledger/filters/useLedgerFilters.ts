import { useState, useMemo, useCallback } from "react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { LedgerEntry } from "../types/ledger";

/** Date filter preset options */
export type DatePreset = "today" | "week" | "month" | "all" | "custom";
/** Entry type filter options (income/expense) */
export type EntryType = "all" | "دخل" | "مصروف";

/** Payment status filter options */
export type PaymentStatus = "all" | "paid" | "unpaid" | "partial";

/** Current state of all ledger filters */
export interface LedgerFiltersState {
  datePreset: DatePreset;
  dateRange: { from: Date | null; to: Date | null };
  entryType: EntryType;
  category: string;
  paymentStatus: PaymentStatus;
}

/** Return type for the useLedgerFilters hook */
export interface UseLedgerFiltersReturn {
  /** Current filter state */
  filters: LedgerFiltersState;
  /** Set date preset (today, week, month, all, custom) */
  setDatePreset: (preset: DatePreset) => void;
  /** Set custom date range */
  setCustomDateRange: (from: Date | null, to: Date | null) => void;
  /** Set entry type filter */
  setEntryType: (type: EntryType) => void;
  /** Set category filter */
  setCategory: (category: string) => void;
  /** Set payment status filter */
  setPaymentStatus: (status: PaymentStatus) => void;
  /** Reset all filters to default */
  clearFilters: () => void;
  /** Whether any filter is active */
  hasActiveFilters: boolean;
  /** Filter entries based on current filter state */
  filterEntries: (entries: LedgerEntry[]) => LedgerEntry[];
}

const defaultFilters: LedgerFiltersState = {
  datePreset: "all",
  dateRange: { from: null, to: null },
  entryType: "all",
  category: "all",
  paymentStatus: "all",
};

/** Options for initializing useLedgerFilters hook */
export interface UseLedgerFiltersOptions {
  /** Initial payment status filter */
  initialPaymentStatus?: PaymentStatus;
}

/**
 * Hook for managing ledger entry filters.
 * Provides state and handlers for filtering by date, type, category, and payment status.
 * All filtering is performed client-side for fast performance.
 *
 * @example
 * ```tsx
 * const { filters, setDatePreset, filterEntries } = useLedgerFilters();
 * const filtered = filterEntries(entries);
 * ```
 */
export function useLedgerFilters(options?: UseLedgerFiltersOptions): UseLedgerFiltersReturn {
  const initialFilters: LedgerFiltersState = {
    ...defaultFilters,
    paymentStatus: options?.initialPaymentStatus || "all",
  };
  const [filters, setFilters] = useState<LedgerFiltersState>(initialFilters);

  const setDatePreset = useCallback((preset: DatePreset) => {
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;

    switch (preset) {
      case "today":
        from = startOfDay(now);
        to = endOfDay(now);
        break;
      case "week":
        from = startOfWeek(now, { weekStartsOn: 0 });
        to = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case "month":
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case "all":
      case "custom":
        from = null;
        to = null;
        break;
    }

    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      dateRange: { from, to },
    }));
  }, []);

  const setCustomDateRange = useCallback((from: Date | null, to: Date | null) => {
    setFilters((prev) => ({
      ...prev,
      datePreset: "custom",
      dateRange: { from, to },
    }));
  }, []);

  const setEntryType = useCallback((type: EntryType) => {
    setFilters((prev) => ({ ...prev, entryType: type }));
  }, []);

  const setCategory = useCallback((category: string) => {
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  const setPaymentStatus = useCallback((status: PaymentStatus) => {
    setFilters((prev) => ({ ...prev, paymentStatus: status }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.datePreset !== "all" ||
      filters.entryType !== "all" ||
      filters.category !== "all" ||
      filters.paymentStatus !== "all"
    );
  }, [filters]);

  const filterEntries = useCallback(
    (entries: LedgerEntry[]): LedgerEntry[] => {
      return entries.filter((entry) => {
        // Date filter
        if (filters.dateRange.from || filters.dateRange.to) {
          const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
          if (filters.dateRange.from && entryDate < filters.dateRange.from) return false;
          if (filters.dateRange.to && entryDate > filters.dateRange.to) return false;
        }

        // Type filter
        if (filters.entryType !== "all" && entry.type !== filters.entryType) {
          return false;
        }

        // Category filter
        if (filters.category !== "all" && entry.category !== filters.category) {
          return false;
        }

        // Payment status filter
        if (filters.paymentStatus !== "all") {
          // If filtering by payment status but entry doesn't have one, exclude it
          if (!entry.paymentStatus) {
            return false;
          }
          // Only filter entries that have payment status (AR/AP entries)
          if (entry.paymentStatus !== filters.paymentStatus) {
            return false;
          }
        }

        return true;
      });
    },
    [filters]
  );

  return {
    filters,
    setDatePreset,
    setCustomDateRange,
    setEntryType,
    setCategory,
    setPaymentStatus,
    clearFilters,
    hasActiveFilters,
    filterEntries,
  };
}
