/**
 * Dashboard Constants
 * Centralized configuration values for the dashboard module
 */

// Re-export shared constants from ledger-helpers (single source of truth)
export {
  LOAN_CATEGORIES,
  LOAN_SUBCATEGORIES,
  EQUITY_SUBCATEGORIES,
} from "@/components/ledger/utils/ledger-helpers";

/** Core dashboard configuration */
export const DASHBOARD_CONFIG = {
  /** Number of days to look ahead for cheque due alerts */
  CHEQUE_DUE_DAYS: 7,
  /** Duration of cash counter animation in milliseconds */
  ANIMATION_DURATION_MS: 1500,
  /** Animation frame interval in milliseconds */
  ANIMATION_FRAME_MS: 16,
  /** Number of recent transactions to display */
  TRANSACTIONS_LIMIT: 5,
  /** Initial load delay for animations in milliseconds */
  LOAD_DELAY_MS: 100,
  /** Number of months to show in dropdown */
  MONTHS_TO_SHOW: 12,
} as const;

/** Chart period options with labels */
export const CHART_PERIODS = [
  { value: "1" as const, label: "شهر" },
  { value: "3" as const, label: "3 أشهر" },
  { value: "6" as const, label: "6 أشهر" },
] as const;

/** Color palette for expense categories */
export const EXPENSE_CATEGORY_COLORS = [
  "#475569", // slate-600
  "#0d9488", // teal-600
  "#d97706", // amber-600
  "#7c7c8a", // zinc-500
  "#6366f1", // indigo-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
] as const;

/** Tailwind color classes for dashboard elements */
export const DASHBOARD_COLORS = {
  // Hero section
  hero: {
    background: "bg-slate-800",
    text: "text-white",
    label: "text-slate-400",
    negative: "text-rose-400",
  },
  // Revenue indicators
  revenue: {
    text: "text-emerald-600",
    background: "bg-emerald-50",
    icon: "bg-emerald-100",
  },
  // Expense indicators
  expense: {
    text: "text-slate-600",
    background: "bg-slate-100",
    icon: "bg-slate-100",
  },
  // Profit indicators
  profit: {
    text: "text-emerald-700",
    background: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "bg-emerald-100",
  },
  // Loss indicators
  loss: {
    text: "text-rose-700",
    background: "bg-rose-50",
    border: "border-rose-200",
    icon: "bg-rose-100",
  },
  // Alert severity colors
  alert: {
    urgent: {
      background: "bg-rose-50",
      border: "border-rose-100",
      dot: "bg-rose-500",
      text: "text-rose-700",
    },
    warning: {
      background: "bg-amber-50",
      border: "border-amber-100",
      dot: "bg-amber-500",
      text: "text-amber-700",
    },
    success: {
      background: "bg-emerald-50",
      border: "border-emerald-100",
      dot: "bg-emerald-500",
      text: "text-emerald-600",
    },
  },
  // Chart colors
  chart: {
    revenue: "bg-emerald-500",
    revenueHover: "bg-emerald-600",
    expense: "bg-slate-400",
    expenseHover: "bg-slate-500",
  },
} as const;

/** Arabic labels for dashboard UI */
export const DASHBOARD_LABELS = {
  cashBalance: "الرصيد النقدي",
  currency: "دينار",
  financialSummary: "الملخص المالي",
  revenue: "صافي الإيرادات",
  expenses: "المصروفات",
  netProfit: "صافي الربح",
  profit: "ربح",
  loss: "خسارة",
  monthly: "شهري",
  total: "الإجمالي",
  needsAttention: "يحتاج انتباهك",
  chequesDueSoon: "شيكات تستحق قريباً",
  unpaidReceivables: "ذمم غير محصلة",
  unpaidPayables: "ذمم مستحقة علينا",
  noAlerts: "لا توجد تنبيهات عاجلة",
  noOverduePayments: "لا توجد مدفوعات متأخرة",
  revenueAndExpenses: "الإيرادات والمصروفات",
  expensesByCategory: "المصروفات حسب الفئة",
  noExpenses: "لا توجد مصروفات",
  noExpensesThisMonth: "لا توجد مصروفات لهذا الشهر",
  last5Transactions: "آخر 5 حركات مالية",
  recentTransactions: "آخر 5 حركات مالية",
  viewAll: "عرض الكل ←",
  noTransactions: "لا توجد حركات مالية بعد",
  chequesWithinDays: "شيكات خلال 7 أيام",
  overdueInvoices: "فاتورة متأخرة",
  dueInvoices: "فاتورة مستحقة",
} as const;

/** Categories to exclude from P&L calculations (for backward compatibility with old data) */
export const EXCLUDED_CATEGORIES = ["رأس المال", "Owner Equity", "سلفة مورد", "سلفة عميل", "قروض مستلمة", "قروض ممنوحة"] as const;

/** Income type identifiers in Arabic */
export const INCOME_TYPES = ["دخل", "إيراد"] as const;

/** Expense type identifier in Arabic */
export const EXPENSE_TYPE = "مصروف" as const;

/** Equity type identifier in Arabic (NOT P&L - affects cash balance only) */
export const EQUITY_TYPE = "حركة رأس مال" as const;

/** Loan type identifier in Arabic (NOT P&L - Balance Sheet item) */
export const LOAN_TYPE = "قرض" as const;

/** Payment types for cash flow */
export const PAYMENT_TYPES = {
  INCOMING: "قبض",
  OUTGOING: "صرف",
} as const;

/** Cheque pending status in Arabic */
export const CHEQUE_PENDING_STATUS = "قيد الانتظار" as const;
