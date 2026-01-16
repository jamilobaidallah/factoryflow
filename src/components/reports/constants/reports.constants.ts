/**
 * Reports Page Constants
 * Labels, options, and configuration for the reports page
 */

import type {
  PeriodOption,
  ComparisonOption,
  QuickReport,
} from '../types/reports.types';

// Import shared constants from ledger-helpers (single source of truth)
import { LOAN_CATEGORIES as LOAN_CATEGORIES_OBJ } from "@/components/ledger/utils/ledger-helpers";

// Arabic labels for the reports page
export const REPORTS_LABELS = {
  // Page header
  pageTitle: 'التقارير المالية',
  pageSubtitle: 'تحليل شامل للأداء المالي',
  export: 'تصدير',

  // Period selector
  period: 'الفترة:',
  compareTo: 'مقارنة بـ:',
  custom: 'مخصص...',

  // Summary cards
  revenue: 'صافي الإيرادات',
  grossRevenue: 'إجمالي الإيرادات',
  discounts: 'خصومات التسوية',
  expenses: 'المصروفات',
  netProfit: 'صافي الربح',
  profitMargin: 'هامش الربح',
  currency: 'دينار',
  profit: 'ربح',
  loss: 'خسارة',
  previous: 'الماضي:',
  fromRevenue: 'من الإيرادات',

  // Charts
  revenueAndExpenses: 'الإيرادات والمصروفات',
  expensesByCategory: 'المصروفات حسب الفئة',
  details: 'تفاصيل ←',
  total: 'إجمالي',

  // Quick reports
  quickReports: 'التقارير السريعة',
  allReports: 'جميع التقارير ←',

  // Insights
  financialInsights: 'رؤى مالية',
  automatic: 'تلقائي',

  // Tables
  detailedBreakdown: 'تفصيل الإيرادات والمصروفات',
  revenueByCategory: 'الإيرادات حسب الفئة',
  expensesByCategory2: 'المصروفات حسب الفئة',
  totalAmount: 'المجموع',

  // Export
  exportExcel: 'Excel',
  exportPDF: 'PDF',
  exportCSV: 'CSV',
} as const;

// Period options for quick selection
export const PERIOD_OPTIONS: PeriodOption[] = [
  { id: 'total', label: 'الإجمالي' },
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'الأسبوع' },
  { id: 'month', label: 'الشهر' },
  { id: 'quarter', label: 'الربع' },
  { id: 'year', label: 'السنة' },
];

// Comparison options for dropdown
export const COMPARISON_OPTIONS: ComparisonOption[] = [
  { id: 'lastMonth', label: 'الشهر الماضي' },
  { id: 'lastQuarter', label: 'الربع الماضي' },
  { id: 'lastYear', label: 'نفس الفترة العام الماضي' },
  { id: 'none', label: 'بدون مقارنة' },
];

// Chart period options
export const CHART_PERIOD_OPTIONS = [
  { value: '1' as const, label: 'شهر' },
  { value: '3' as const, label: '3 أشهر' },
  { value: '6' as const, label: '6 أشهر' },
];

// Quick report definitions
export const QUICK_REPORTS: QuickReport[] = [
  {
    id: 'income',
    icon: '📄',
    title: 'قائمة الدخل',
    description: 'تقرير الأرباح والخسائر',
    color: 'emerald',
    link: '/reports/income-statement',
  },
  {
    id: 'balancesheet',
    icon: '📋',
    title: 'الميزانية العمومية',
    description: 'الأصول والخصوم وحقوق الملكية',
    color: 'slate',
    link: '/reports/balance-sheet',
  },
  {
    id: 'trialbalance',
    icon: '⚖️',
    title: 'ميزان المراجعة',
    description: 'أرصدة جميع الحسابات',
    color: 'teal',
    link: '/reports/trial-balance',
  },
  {
    id: 'aging',
    icon: '👥',
    title: 'أعمار الذمم',
    description: 'تحليل المستحقات',
    color: 'blue',
    link: '/reports/aging',
  },
  {
    id: 'expenses',
    icon: '📊',
    title: 'تحليل المصروفات',
    description: 'تفصيل حسب الفئة والفرعية',
    color: 'amber',
    link: '/reports/expenses',
  },
  {
    id: 'cashflow',
    icon: '💰',
    title: 'التدفقات النقدية',
    description: 'حركة النقد الداخل والخارج',
    color: 'purple',
    link: '/reports/cashflow',
  },
];

// Category colors for charts (matching dashboard)
export const CATEGORY_COLORS = [
  '#475569', // slate-600
  '#0d9488', // teal-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#dc2626', // red-600
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#c026d3', // fuchsia-600
];

// Animation delays
export const ANIMATION_CONFIG = {
  LOAD_DELAY_MS: 100,
  STAGGER_DELAY_MS: 100,
  TRANSITION_DURATION_MS: 300,
} as const;

// Owner equity categories to exclude from calculations
export const OWNER_EQUITY_CATEGORIES = ['رأس المال', 'Owner Equity'] as const;

// Advance categories to exclude from P&L (prepaid credits, not actual income/expense)
export const ADVANCE_CATEGORIES = ['سلفة مورد', 'سلفة عميل'] as const;

// Loan categories to exclude from P&L (derived from shared constants)
export const LOAN_CATEGORIES = [LOAN_CATEGORIES_OBJ.RECEIVED, LOAN_CATEGORIES_OBJ.GIVEN] as const;

// All categories excluded from P&L calculations
export const EXCLUDED_FROM_PL_CATEGORIES = [
  ...OWNER_EQUITY_CATEGORIES,
  ...ADVANCE_CATEGORIES,
  ...LOAN_CATEGORIES,
] as const;

// Arabic month names for charts
export const ARABIC_MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;
