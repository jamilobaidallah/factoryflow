/**
 * Dashboard Types
 * All TypeScript interfaces for the dashboard module
 */

/** Ledger entry with essential fields for dashboard */
export interface DashboardLedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  subCategory?: string;
  date: Date;
  associatedParty?: string;
  description?: string;
  paymentStatus?: "paid" | "unpaid" | "partial";
  remainingBalance?: number;
  totalPaid?: number;
  totalDiscount?: number;
  isARAPEntry?: boolean;
}

/** Summary data for financial cards */
export interface DashboardSummaryData {
  revenue: number;
  expenses: number;
  profit: number;
  isLoss: boolean;
}

/** Monthly aggregated data */
export interface MonthlyFinancialData {
  revenue: number;
  expenses: number;
  discounts?: number;
  badDebt?: number;  // Bad debt write-offs (ديون معدومة)
}

/** Chart bar data point */
export interface ChartDataPoint {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  revenueFormatted: string;
  expensesFormatted: string;
}

/** Expense category for donut chart */
export interface ExpenseCategory {
  id: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
  offset: number;
}

/** Alert item for attention section */
export interface AlertItem {
  id: string;
  type: "cheque" | "receivable";
  title: string;
  subtitle: string;
  amount: number;
  count: number;
  severity: "urgent" | "warning" | "info";
  href: string;
}

/** Alert counts and totals */
export interface AlertData {
  count: number;
  total: number;
}

/** Month option for dropdown */
export interface MonthOption {
  value: string;
  label: string;
}

/** View toggle type */
export type ViewMode = "month" | "total";

/** Chart period type */
export type ChartPeriod = "1" | "3" | "6";

/** Props for DashboardHero component */
export interface DashboardHeroProps {
  cashBalance: number;
  isAnimating: boolean;
}

/** Props for DashboardSummaryCards component */
export interface DashboardSummaryCardsProps {
  summaryData: DashboardSummaryData;
  viewMode: ViewMode;
  selectedMonth: string;
  availableMonths: MonthOption[];
  onViewModeChange: (mode: ViewMode) => void;
  onMonthChange: (month: string) => void;
}

/** Props for DashboardAlerts component */
export interface DashboardAlertsProps {
  chequesDueSoon: AlertData;
  unpaidReceivables: AlertData;
  unpaidPayables: AlertData;
}

/** Props for DashboardBarChart component */
export interface DashboardBarChartProps {
  chartData: ChartDataPoint[];
  chartPeriod: ChartPeriod;
  isLoaded: boolean;
  onPeriodChange: (period: ChartPeriod) => void;
}

/** Props for DashboardDonutChart component */
export interface DashboardDonutChartProps {
  categories: ExpenseCategory[];
  totalAmount: number;
  viewMode: ViewMode;
  selectedMonth: string;
  availableMonths: MonthOption[];
  isLoaded: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onMonthChange: (month: string) => void;
}

/** Props for DashboardTransactions component */
export interface DashboardTransactionsProps {
  transactions: DashboardLedgerEntry[];
  isLoaded: boolean;
}

/** Dashboard data hook return type */
export interface UseDashboardDataReturn {
  // Cash balance
  totalCashIn: number;
  totalCashOut: number;
  cashBalance: number;
  // Revenue & Expenses
  totalRevenue: number;
  totalExpenses: number;
  totalDiscounts: number;
  totalBadDebt: number;  // Bad debt write-offs (ديون معدومة)
  totalExpenseDiscounts: number;   // Expense discounts (contra-expense)
  totalExpenseWriteoffs: number;   // Expense writeoffs (contra-expense)
  // Loan tracking
  loansReceivable: number;  // Outstanding loans we gave (assets)
  loansPayable: number;     // Outstanding loans we owe (liabilities)
  loanCashIn: number;       // Cash received from loans
  loanCashOut: number;      // Cash paid for loans
  // Monthly data
  monthlyDataMap: Map<string, MonthlyFinancialData>;
  // Expense categories
  expensesByCategoryMap: Map<string, { total: number; monthly: Map<string, number> }>;
  // Recent transactions
  recentTransactions: DashboardLedgerEntry[];
  // Loading state
  isLoading: boolean;
}

/** Cheques alerts hook return type */
export interface UseChequesAlertsReturn {
  chequesDueSoon: AlertData;
  isLoading: boolean;
}

/** Receivables and payables alerts hook return type */
export interface UseReceivablesAlertsReturn {
  unpaidReceivables: AlertData;
  unpaidPayables: AlertData;
}
