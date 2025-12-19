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
import { isEquityTransaction, isCapitalContribution, isOwnerDrawing } from "../utils/ledger-helpers";

/** Date filter preset options */
export type DatePreset = "today" | "week" | "month" | "all" | "custom";
/** Entry type filter options (income/expense/capital) */
export type EntryType = "all" | "دخل" | "مصروف" | "حركة رأس مال";

/** Payment status filter options */
export type PaymentStatus = "all" | "paid" | "unpaid" | "partial" | "outstanding";

/** View mode for main filter tabs */
export type ViewMode = "all" | "income" | "expense" | "unpaid";

/** Current state of all ledger filters */
export interface LedgerFiltersState {
  datePreset: DatePreset;
  dateRange: { from: Date | null; to: Date | null };
  entryType: EntryType;
  category: string;
  subCategory: string;
  paymentStatus: PaymentStatus;
  search: string;
  viewMode: ViewMode;
}

/** Filtered totals for display */
export interface FilteredTotals {
  count: number;
  income: number;
  expenses: number;
  equityIn: number;
  equityOut: number;
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
  /** Set subcategory filter */
  setSubCategory: (subCategory: string) => void;
  /** Set payment status filter */
  setPaymentStatus: (status: PaymentStatus) => void;
  /** Set search query */
  setSearch: (search: string) => void;
  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Reset all filters to default */
  clearFilters: () => void;
  /** Whether any filter is active */
  hasActiveFilters: boolean;
  /** Filter entries based on current filter state */
  filterEntries: (entries: LedgerEntry[]) => LedgerEntry[];
  /** Calculate totals for filtered entries */
  calculateTotals: (entries: LedgerEntry[]) => FilteredTotals;
}

const defaultFilters: LedgerFiltersState = {
  datePreset: "all",
  dateRange: { from: null, to: null },
  entryType: "all",
  category: "all",
  subCategory: "all",
  paymentStatus: "all",
  search: "",
  viewMode: "all",
};

/** Options for initializing useLedgerFilters hook */
export interface UseLedgerFiltersOptions {
  /** Initial payment status filter */
  initialPaymentStatus?: PaymentStatus;
  /** Initial entry type filter */
  initialEntryType?: EntryType;
  /** Initial category filter */
  initialCategory?: string;
  /** Initial subcategory filter */
  initialSubCategory?: string;
  /** Initial view mode */
  initialViewMode?: ViewMode;
  /** Initial search query */
  initialSearch?: string;
}

/**
 * Hook for managing ledger entry filters.
 * Provides state and handlers for filtering by date, type, category, subcategory, payment status, and search.
 * All filtering is performed client-side for fast performance.
 *
 * @example
 * ```tsx
 * const { filters, setDatePreset, filterEntries, calculateTotals } = useLedgerFilters();
 * const filtered = filterEntries(entries);
 * const totals = calculateTotals(filtered);
 * ```
 */
export function useLedgerFilters(options?: UseLedgerFiltersOptions): UseLedgerFiltersReturn {
  const initialFilters: LedgerFiltersState = {
    ...defaultFilters,
    paymentStatus: options?.initialPaymentStatus || "all",
    entryType: options?.initialEntryType || "all",
    category: options?.initialCategory || "all",
    subCategory: options?.initialSubCategory || "all",
    viewMode: options?.initialViewMode || "all",
    search: options?.initialSearch || "",
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
    setFilters((prev) => ({
      ...prev,
      entryType: type,
      // Reset category and subcategory when type changes
      category: "all",
      subCategory: "all",
    }));
  }, []);

  const setCategory = useCallback((category: string) => {
    setFilters((prev) => ({
      ...prev,
      category,
      // Reset subcategory when category changes
      subCategory: "all",
    }));
  }, []);

  const setSubCategory = useCallback((subCategory: string) => {
    setFilters((prev) => ({ ...prev, subCategory }));
  }, []);

  const setPaymentStatus = useCallback((status: PaymentStatus) => {
    setFilters((prev) => ({ ...prev, paymentStatus: status }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setFilters((prev) => ({ ...prev, viewMode: mode }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.datePreset !== "all" ||
      filters.entryType !== "all" ||
      filters.category !== "all" ||
      filters.subCategory !== "all" ||
      filters.paymentStatus !== "all" ||
      filters.search !== "" ||
      filters.viewMode !== "all"
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

        // View mode filter (main tabs)
        if (filters.viewMode !== "all") {
          if (filters.viewMode === "income" && entry.type !== "دخل") return false;
          if (filters.viewMode === "expense" && entry.type !== "مصروف") return false;
          if (filters.viewMode === "unpaid") {
            // Exclude equity/capital transactions - they don't have AR/AP
            if (isEquityTransaction(entry.type, entry.category)) return false;
            if (!entry.paymentStatus) return false;
            if (entry.paymentStatus !== "unpaid" && entry.paymentStatus !== "partial") return false;
          }
        }

        // Type filter (advanced filter)
        if (filters.entryType !== "all" && entry.type !== filters.entryType) {
          return false;
        }

        // Category filter
        if (filters.category !== "all" && entry.category !== filters.category) {
          return false;
        }

        // Subcategory filter
        if (filters.subCategory !== "all" && entry.subCategory !== filters.subCategory) {
          return false;
        }

        // Payment status filter
        if (filters.paymentStatus !== "all") {
          // If filtering by payment status but entry doesn't have one, exclude it
          if (!entry.paymentStatus) {
            return false;
          }
          // "outstanding" matches both "unpaid" and "partial"
          if (filters.paymentStatus === "outstanding") {
            if (entry.paymentStatus !== "unpaid" && entry.paymentStatus !== "partial") {
              return false;
            }
          } else {
            // Only filter entries that have payment status (AR/AP entries)
            if (entry.paymentStatus !== filters.paymentStatus) {
              return false;
            }
          }
        }

        // Search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesDescription = entry.description?.toLowerCase().includes(searchLower);
          const matchesParty = entry.associatedParty?.toLowerCase().includes(searchLower);
          const matchesOwnerName = entry.ownerName?.toLowerCase().includes(searchLower);
          const matchesCategory = entry.category?.toLowerCase().includes(searchLower);
          const matchesSubCategory = entry.subCategory?.toLowerCase().includes(searchLower);
          const matchesTransactionId = entry.transactionId?.toLowerCase().includes(searchLower);

          if (!matchesDescription && !matchesParty && !matchesOwnerName && !matchesCategory && !matchesSubCategory && !matchesTransactionId) {
            return false;
          }
        }

        return true;
      });
    },
    [filters]
  );

  const calculateTotals = useCallback((entries: LedgerEntry[]): FilteredTotals => {
    return entries.reduce(
      (acc, entry) => {
        // Check if this is an equity transaction
        if (isEquityTransaction(entry.type, entry.category)) {
          // Equity entries: track separately as investments or withdrawals
          if (isCapitalContribution(entry.subCategory)) {
            acc.equityIn += entry.amount || 0;
          } else if (isOwnerDrawing(entry.subCategory)) {
            acc.equityOut += entry.amount || 0;
          }
        } else if (entry.type === "دخل") {
          acc.income += entry.amount || 0;
        } else if (entry.type === "مصروف") {
          acc.expenses += entry.amount || 0;
        }
        acc.count++;
        return acc;
      },
      { count: 0, income: 0, expenses: 0, equityIn: 0, equityOut: 0 }
    );
  }, []);

  return {
    filters,
    setDatePreset,
    setCustomDateRange,
    setEntryType,
    setCategory,
    setSubCategory,
    setPaymentStatus,
    setSearch,
    setViewMode,
    clearFilters,
    hasActiveFilters,
    filterEntries,
    calculateTotals,
  };
}
