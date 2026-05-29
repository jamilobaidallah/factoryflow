"use client";

import { useMemo } from "react";
import { useLedgerLocal } from "./useLedgerLocal";
import { usePaymentsLocal } from "./usePaymentsLocal";
import type {
  UseDashboardDataReturn,
  MonthlyFinancialData,
  DashboardLedgerEntry,
  AlertData,
} from "@/components/dashboard/types/dashboard.types";

const INCOME_TYPES   = ["دخل", "إيراد"] as const;
const EXPENSE_TYPE   = "مصروف";
const EQUITY_TYPE    = "حركة رأس مال";
const RETURN_TYPE    = "مردود";
const EXCLUDED_CATEGORIES = ["مردودات المبيعات"];

const LOAN_CATEGORIES = {
  RECEIVED: "قروض مستلمة",
  GIVEN:    "قروض ممنوحة",
} as const;
const LOAN_SUBCATEGORIES = {
  LOAN_RECEIPT:    "استلام قرض",
  LOAN_REPAYMENT:  "سداد قرض",
  LOAN_GIVEN:      "منح قرض",
  LOAN_COLLECTION: "تحصيل قرض",
} as const;

const PAYMENT_TYPES = {
  INCOMING: "قبض",
  OUTGOING: "صرف",
} as const;

const CAPITAL_SUBCATEGORIES  = ["رأس مال", "رأس مال مالك", "رأس المال"];
const DRAWING_SUBCATEGORIES  = ["سحوبات", "سحوبات المالك"];

interface RawLedgerRow {
  id:               string;
  transactionId:    string;
  type:             string;
  amount:           number;
  category:         string;
  subCategory?:     string;
  associatedParty?: string;
  description?:     string;
  date:             string;
  paymentStatus?:   string;
  remainingBalance?: number;
  totalPaid?:       number;
  totalDiscount?:   number;
  writeoffAmount?:  number;
  isARAPEntry?:     boolean | number | null;
  isInventoryPurchase?: boolean | number | null;
  isCOGSReversal?:  boolean | number | null;
  isReturnEntry?:   boolean | number | null;
}

interface RawPaymentRow {
  amount:           number;
  type:             string;
  isEndorsement?:   boolean | number | null;
  noCashMovement?:  boolean | number | null;
}

function asBoolean(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
}

function formatMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function updateMonthlyData(
  map: Map<string, MonthlyFinancialData>,
  monthKey: string,
  revenue: number, expenses: number, discounts: number, badDebt: number,
): void {
  const existing = map.get(monthKey) || { revenue: 0, expenses: 0, discounts: 0, badDebt: 0 };
  existing.revenue   += revenue;
  existing.expenses  += expenses;
  existing.discounts = (existing.discounts || 0) + discounts;
  existing.badDebt   = (existing.badDebt || 0) + badDebt;
  map.set(monthKey, existing);
}

function updateCategoryData(
  map: Map<string, { total: number; monthly: Map<string, number> }>,
  category: string, monthKey: string, amount: number,
): void {
  if (!category) { return; }
  const cat = map.get(category) || { total: 0, monthly: new Map() };
  cat.total += amount;
  cat.monthly.set(monthKey, (cat.monthly.get(monthKey) || 0) + amount);
  map.set(category, cat);
}

/**
 * Local-mode equivalent of useDashboardData() — aggregates ledger and
 * payment data from SQLite into the dashboard's expected shape.
 *
 * Field-name compatibility: the SQLite ledger schema mirrors the Firestore
 * one, so the aggregation logic mirrors transformLedgerData() in
 * src/hooks/firebase-query/useDashboardQueries.ts.
 */
export function useDashboardDataLocal(selectedMonth?: string): UseDashboardDataReturn {
  const { data: ledgerData,    isLoading: ledgerLoading }   = useLedgerLocal(5000);
  const { data: paymentsData,  isLoading: paymentsLoading } = usePaymentsLocal();

  const ledger   = (ledgerData   ?? []) as RawLedgerRow[];
  const payments = (paymentsData ?? []) as RawPaymentRow[];

  const aggregated = useMemo(() => {
    let revenue = 0, expenses = 0, discounts = 0, badDebt = 0;
    let expenseDiscounts = 0, expenseWriteoffs = 0;
    let finCashIn = 0, finCashOut = 0;
    let loanReceivable = 0, loanPayable = 0, loanIn = 0, loanOut = 0;

    const monthlyMap  = new Map<string, MonthlyFinancialData>();
    const categoryMap = new Map<string, { total: number; monthly: Map<string, number> }>();
    const transactions: DashboardLedgerEntry[] = [];
    const arApRows: RawLedgerRow[] = [];

    for (const row of ledger) {
      const entry: DashboardLedgerEntry = {
        id:               row.id,
        type:             row.type ?? "",
        amount:           row.amount ?? 0,
        category:         row.category ?? "",
        subCategory:      row.subCategory ?? "",
        date:             new Date(row.date),
        associatedParty:  row.associatedParty,
        description:      row.description,
        paymentStatus:    row.paymentStatus as 'paid' | 'unpaid' | 'partial' | undefined,
        remainingBalance: row.remainingBalance,
        totalPaid:        row.totalPaid,
        totalDiscount:    row.totalDiscount,
        isARAPEntry:        asBoolean(row.isARAPEntry),
        isInventoryPurchase: asBoolean(row.isInventoryPurchase),
        isCOGSReversal:      asBoolean(row.isCOGSReversal),
      };
      transactions.push(entry);

      if (row.paymentStatus !== undefined && row.paymentStatus !== null) {
        arApRows.push(row);
      }

      const isEquity   = entry.type === EQUITY_TYPE;
      const isExcluded = EXCLUDED_CATEGORIES.some(c => entry.category === c);
      const isExcludedRow = isEquity || isExcluded || asBoolean(row.isInventoryPurchase);
      const monthKey = formatMonthKey(entry.date);

      if (isExcludedRow) {
        if (CAPITAL_SUBCATEGORIES.includes(entry.subCategory ?? "")) {
          finCashIn += entry.amount;
        } else if (DRAWING_SUBCATEGORIES.includes(entry.subCategory ?? "")) {
          finCashOut += entry.amount;
        }
        // Loan handling
        if (entry.category === LOAN_CATEGORIES.RECEIVED) {
          if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_RECEIPT) {
            loanIn      += entry.amount;
            loanPayable += entry.remainingBalance ?? entry.amount ?? 0;
          } else if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_REPAYMENT) {
            loanOut += entry.amount;
          }
        } else if (entry.category === LOAN_CATEGORIES.GIVEN) {
          if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_GIVEN) {
            loanOut          += entry.amount;
            loanReceivable   += entry.remainingBalance ?? entry.amount ?? 0;
          } else if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_COLLECTION) {
            loanIn += entry.amount;
          }
        }
        continue;
      }

      // Returns
      const isReturn = entry.type === RETURN_TYPE ||
        (INCOME_TYPES.some(t => t === entry.type) &&
          (asBoolean(row.isReturnEntry) || entry.category === "مردودات المبيعات"));

      const isIncome  = !isReturn && INCOME_TYPES.some(t => t === entry.type);
      const isExpense = entry.type === EXPENSE_TYPE;

      if (isReturn) {
        revenue -= entry.amount;
        if (entry.totalDiscount) { discounts += entry.totalDiscount; }
        updateMonthlyData(monthlyMap, monthKey, -entry.amount, 0, entry.totalDiscount || 0, 0);
      } else if (isIncome) {
        revenue += entry.amount;
        if (entry.totalDiscount) { discounts += entry.totalDiscount; }
        if (row.writeoffAmount)  { badDebt   += row.writeoffAmount; }
        updateMonthlyData(monthlyMap, monthKey, entry.amount, 0,
          entry.totalDiscount || 0, row.writeoffAmount || 0);
      } else if (isExpense) {
        if (entry.isCOGSReversal) {
          expenses -= entry.amount;
          updateMonthlyData(monthlyMap, monthKey, 0, -entry.amount, 0, 0);
          updateCategoryData(categoryMap, entry.category, monthKey, -entry.amount);
        } else {
          expenses += entry.amount;
          if (entry.totalDiscount) { expenseDiscounts += entry.totalDiscount; }
          if (row.writeoffAmount)  { expenseWriteoffs += row.writeoffAmount; }
          updateMonthlyData(monthlyMap, monthKey, 0, entry.amount, 0, 0);
          updateCategoryData(categoryMap, entry.category, monthKey, entry.amount);
        }
      }
    }

    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    // ── Payments → operating cash in/out ─────────────────────────────────
    let opCashIn = 0, opCashOut = 0;
    for (const p of payments) {
      if (asBoolean(p.isEndorsement) || asBoolean(p.noCashMovement)) { continue; }
      const amount = p.amount ?? 0;
      if (p.type === PAYMENT_TYPES.INCOMING) { opCashIn  += amount; }
      else if (p.type === PAYMENT_TYPES.OUTGOING) { opCashOut += amount; }
    }

    // ── AR/AP alert counts ───────────────────────────────────────────────
    let monthFrom: Date | null = null, monthTo: Date | null = null;
    if (selectedMonth) {
      const [y, m] = selectedMonth.split("-");
      const year = parseInt(y, 10), month = parseInt(m, 10);
      monthFrom = new Date(year, month - 1, 1);
      monthTo   = new Date(year, month, 0, 23, 59, 59, 999);
    }

    let recvCount = 0, recvTotal = 0, payCount = 0, payTotal = 0;
    for (const r of arApRows) {
      const entryDate = new Date(r.date);
      if (monthFrom && monthTo && (entryDate < monthFrom || entryDate > monthTo)) { continue; }
      if (r.paymentStatus !== "unpaid" && r.paymentStatus !== "partial") { continue; }
      const outstanding =
        typeof r.remainingBalance === "number" && r.remainingBalance > 0
          ? r.remainingBalance
          : (r.paymentStatus === "unpaid" && typeof r.amount === "number" ? r.amount : 0);
      const isIncome  = INCOME_TYPES.some(t => t === r.type);
      const isExpense = r.type === EXPENSE_TYPE;
      if (isIncome)  { recvCount++; recvTotal += outstanding; }
      if (isExpense) { payCount++;  payTotal  += outstanding; }
    }

    const unpaidReceivables: AlertData = { count: recvCount, total: recvTotal };
    const unpaidPayables:    AlertData = { count: payCount,  total: payTotal };

    return {
      revenue, expenses, discounts, badDebt,
      expenseDiscounts, expenseWriteoffs,
      finCashIn, finCashOut,
      loanReceivable, loanPayable, loanIn, loanOut,
      monthlyMap, categoryMap, transactions,
      opCashIn, opCashOut,
      unpaidReceivables, unpaidPayables,
    };
  }, [ledger, payments, selectedMonth]);

  const totalCashIn  = aggregated.opCashIn  + aggregated.finCashIn  + aggregated.loanIn;
  const totalCashOut = aggregated.opCashOut + aggregated.finCashOut + aggregated.loanOut;
  const cashBalance  = totalCashIn - totalCashOut;

  return {
    totalCashIn, totalCashOut, cashBalance,
    totalRevenue:           aggregated.revenue,
    totalExpenses:          aggregated.expenses,
    totalDiscounts:         aggregated.discounts,
    totalBadDebt:           aggregated.badDebt,
    totalExpenseDiscounts:  aggregated.expenseDiscounts,
    totalExpenseWriteoffs:  aggregated.expenseWriteoffs,
    loansReceivable:        aggregated.loanReceivable,
    loansPayable:           aggregated.loanPayable,
    loanCashIn:             aggregated.loanIn,
    loanCashOut:            aggregated.loanOut,
    monthlyDataMap:         aggregated.monthlyMap,
    expensesByCategoryMap:  aggregated.categoryMap,
    recentTransactions:     aggregated.transactions.slice(0, 5),
    unpaidReceivables:      aggregated.unpaidReceivables,
    unpaidPayables:         aggregated.unpaidPayables,
    isLoading: ledgerLoading || paymentsLoading,
  };
}
