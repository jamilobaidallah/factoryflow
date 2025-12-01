/**
 * useReportsCalculations - Custom hook for all report calculations
 * Extracted from reports-page.tsx for better maintainability and reusability
 * Phase 2 of reports-page refactoring
 */

import { useMemo } from "react";
import { safeAdd, safeSubtract, safeDivide, safeMultiply, sumAmounts } from "@/lib/currency";

interface LedgerEntry {
  id: string;
  transactionId: string;
  description: string;
  type: string;
  amount: number;
  category: string;
  subCategory: string;
  associatedParty: string;
  date: Date;
  totalPaid?: number;
  remainingBalance?: number;
  paymentStatus?: "paid" | "unpaid" | "partial";
  isARAPEntry?: boolean;
}

interface Payment {
  id: string;
  amount: number;
  type: string;
  date: Date;
  linkedTransactionId?: string;
  isEndorsement?: boolean;
  noCashMovement?: boolean;
}

interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  category: string;
}

interface FixedAsset {
  id: string;
  assetName: string;
  category: string;
  purchaseCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
  status: string;
}

export interface OwnerEquityData {
  ownerInvestments: number;
  ownerWithdrawals: number;
  netOwnerEquity: number;
}

export interface IncomeStatementData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  revenueByCategory: { [key: string]: number };
  expensesByCategory: { [key: string]: number };
}

export interface CashFlowData {
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}

export interface ARAPAgingData {
  receivables: LedgerEntry[];
  payables: LedgerEntry[];
  totalReceivables: number;
  totalPayables: number;
  getAgingBucket: (date: Date) => string;
}

export interface InventoryValuationData {
  valuedInventory: Array<InventoryItem & { totalValue: number }>;
  totalValue: number;
  totalItems: number;
  lowStockItems: number;
}

export interface SalesAndCOGSData {
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
}

export interface FixedAssetsSummaryData {
  activeAssets: FixedAsset[];
  totalCost: number;
  totalAccumulatedDepreciation: number;
  totalBookValue: number;
  monthlyDepreciation: number;
  assetsByCategory: { [key: string]: number };
}

interface UseReportsCalculationsProps {
  ledgerEntries: LedgerEntry[];
  payments: Payment[];
  inventory: InventoryItem[];
  fixedAssets: FixedAsset[];
}

export function useReportsCalculations({
  ledgerEntries,
  payments,
  inventory,
  fixedAssets,
}: UseReportsCalculationsProps) {
  // Calculate Owner Equity (separate from profit/loss)
  const ownerEquity = useMemo((): OwnerEquityData => {
    let ownerInvestments = 0;
    let ownerWithdrawals = 0;

    ledgerEntries.forEach((entry) => {
      // Exclude owner equity transactions (رأس المال) from P&L
      if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
        if (entry.type === "دخل") {
          ownerInvestments = safeAdd(ownerInvestments, entry.amount);
        } else if (entry.type === "مصروف") {
          ownerWithdrawals = safeAdd(ownerWithdrawals, entry.amount);
        }
      }
    });

    const netOwnerEquity = safeSubtract(ownerInvestments, ownerWithdrawals);

    return {
      ownerInvestments,
      ownerWithdrawals,
      netOwnerEquity,
    };
  }, [ledgerEntries]);

  // Calculate Income Statement (EXCLUDING owner equity)
  const incomeStatement = useMemo((): IncomeStatementData => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    const revenueByCategory: { [key: string]: number } = {};
    const expensesByCategory: { [key: string]: number } = {};

    ledgerEntries.forEach((entry) => {
      // EXCLUDE owner equity transactions from profit/loss
      if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
        return; // Skip owner equity transactions
      }

      if (entry.type === "دخل") {
        totalRevenue = safeAdd(totalRevenue, entry.amount);
        revenueByCategory[entry.category] =
          safeAdd(revenueByCategory[entry.category] || 0, entry.amount);
      } else if (entry.type === "مصروف") {
        totalExpenses = safeAdd(totalExpenses, entry.amount);
        expensesByCategory[entry.category] =
          safeAdd(expensesByCategory[entry.category] || 0, entry.amount);
      }
    });

    const netProfit = safeSubtract(totalRevenue, totalExpenses);
    const profitMargin = totalRevenue > 0 ? safeMultiply(safeDivide(netProfit, totalRevenue), 100) : 0;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      revenueByCategory,
      expensesByCategory,
    };
  }, [ledgerEntries]);

  // Calculate Cash Flow
  const cashFlow = useMemo((): CashFlowData => {
    let cashIn = 0;
    let cashOut = 0;

    // Count all payments from Payments collection
    // Instant settlement automatically creates payment records, so we only need to count from payments
    // EXCLUDE endorsed cheques and no-cash-movement payments to avoid double counting
    payments.forEach((payment: any) => {
      // Skip endorsed cheques and no-cash-movement payments
      if (payment.isEndorsement || payment.noCashMovement) {
        return;
      }

      if (payment.type === "قبض") {
        cashIn = safeAdd(cashIn, payment.amount);
      } else if (payment.type === "صرف") {
        cashOut = safeAdd(cashOut, payment.amount);
      }
    });

    const netCashFlow = safeSubtract(cashIn, cashOut);

    return { cashIn, cashOut, netCashFlow };
  }, [payments]);

  // Calculate AR/AP Aging
  const arapAging = useMemo((): ARAPAgingData => {
    const receivables: LedgerEntry[] = [];
    const payables: LedgerEntry[] = [];
    let totalReceivables = 0;
    let totalPayables = 0;

    ledgerEntries.forEach((entry) => {
      if (entry.isARAPEntry && entry.paymentStatus !== "paid") {
        if (entry.type === "دخل") {
          receivables.push(entry);
          totalReceivables = safeAdd(totalReceivables, entry.remainingBalance || 0);
        } else if (entry.type === "مصروف") {
          payables.push(entry);
          totalPayables = safeAdd(totalPayables, entry.remainingBalance || 0);
        }
      }
    });

    // Calculate aging buckets (days overdue)
    const getAgingBucket = (date: Date) => {
      const today = new Date();
      const diffTime = today.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) { return "0-30 يوم"; }
      if (diffDays <= 60) { return "31-60 يوم"; }
      if (diffDays <= 90) { return "61-90 يوم"; }
      return "+90 يوم";
    };

    return {
      receivables,
      payables,
      totalReceivables,
      totalPayables,
      getAgingBucket,
    };
  }, [ledgerEntries]);

  // Calculate Inventory Valuation
  const inventoryValuation = useMemo((): InventoryValuationData => {
    let totalValue = 0;
    const totalItems = inventory.length;
    let lowStockItems = 0;

    const valuedInventory = inventory.map((item) => {
      const value = safeMultiply(item.quantity, item.unitPrice);
      totalValue = safeAdd(totalValue, value);
      if (item.quantity < 10) { lowStockItems++; } // Arbitrary low stock threshold
      return { ...item, totalValue: value };
    });

    return { valuedInventory, totalValue, totalItems, lowStockItems };
  }, [inventory]);

  // Calculate Sales & COGS
  const salesAndCOGS = useMemo((): SalesAndCOGSData => {
    let totalSales = 0;
    let totalCOGS = 0;

    ledgerEntries.forEach((entry) => {
      if (entry.category === "إيرادات المبيعات") {
        totalSales = safeAdd(totalSales, entry.amount);
      }
      if (entry.category === "تكلفة البضاعة المباعة (COGS)") {
        totalCOGS = safeAdd(totalCOGS, entry.amount);
      }
    });

    const grossProfit = safeSubtract(totalSales, totalCOGS);
    const grossMargin = totalSales > 0 ? safeMultiply(safeDivide(grossProfit, totalSales), 100) : 0;

    return { totalSales, totalCOGS, grossProfit, grossMargin };
  }, [ledgerEntries]);

  // Calculate Fixed Assets Summary
  const fixedAssetsSummary = useMemo((): FixedAssetsSummaryData => {
    let totalCost = 0;
    let totalAccumulatedDepreciation = 0;
    let totalBookValue = 0;
    let monthlyDepreciation = 0;

    const activeAssets = fixedAssets.filter((asset) => asset.status === "active");

    activeAssets.forEach((asset) => {
      totalCost = safeAdd(totalCost, asset.purchaseCost);
      totalAccumulatedDepreciation = safeAdd(totalAccumulatedDepreciation, asset.accumulatedDepreciation);
      totalBookValue = safeAdd(totalBookValue, asset.bookValue);
      monthlyDepreciation = safeAdd(monthlyDepreciation, asset.monthlyDepreciation);
    });

    const assetsByCategory: { [key: string]: number } = {};
    activeAssets.forEach((asset) => {
      assetsByCategory[asset.category] =
        safeAdd(assetsByCategory[asset.category] || 0, asset.bookValue);
    });

    return {
      activeAssets,
      totalCost,
      totalAccumulatedDepreciation,
      totalBookValue,
      monthlyDepreciation,
      assetsByCategory,
    };
  }, [fixedAssets]);

  return {
    ownerEquity,
    incomeStatement,
    cashFlow,
    arapAging,
    inventoryValuation,
    salesAndCOGS,
    fixedAssetsSummary,
  };
}
