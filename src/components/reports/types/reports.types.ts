/**
 * Reports Page Types
 * TypeScript interfaces for the redesigned reports page
 */

// Period selection types
export type PeriodType = 'total' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type ComparisonType = 'lastMonth' | 'lastQuarter' | 'lastYear' | 'none';
export type ChartPeriodType = '1' | '3' | '6';

// Custom date range
export interface CustomDateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
}

// Period data structure
export interface PeriodData {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

// Comparison result for a single metric
export interface ComparisonResult {
  current: number;
  previous: number;
  percentChange: number;
  isPositive: boolean;
}

// Full comparison data for all metrics
export interface ComparisonData {
  revenue: ComparisonResult;
  expenses: ComparisonResult;
  profit: ComparisonResult;
  margin: ComparisonResult;
  // Revenue breakdown (optional - for reports page detail)
  grossRevenue?: number;
  discounts?: number;
}

// Insight types
export type InsightSeverity = 'high' | 'medium' | 'low';
export type InsightType = 'warning' | 'info' | 'tip';

export interface Insight {
  id: string;
  type: InsightType;
  icon: string;
  text: string;
  severity: InsightSeverity;
}

// Quick report card
export interface QuickReport {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: 'emerald' | 'blue' | 'amber' | 'purple';
  link?: string;
}

// Category breakdown for charts/tables
export interface CategoryData {
  id: string;
  name: string;
  amount: number;
  percent: number;
  color: string;
  subcategories?: SubcategoryData[];
}

export interface SubcategoryData {
  name: string;
  amount: number;
}

// Chart data point
export interface ReportsChartDataPoint {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  revenueFormatted: string;
  expensesFormatted: string;
}

// Period option for selector
export interface PeriodOption {
  id: PeriodType;
  label: string;
}

// Comparison option for dropdown
export interface ComparisonOption {
  id: ComparisonType;
  label: string;
}

// Props interfaces for components
export interface ReportsHeaderProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
}

export interface ReportsPeriodSelectorProps {
  selectedPeriod: PeriodType;
  comparisonType: ComparisonType;
  customDateRange?: CustomDateRange | null;
  onPeriodChange: (period: PeriodType) => void;
  onComparisonChange: (comparison: ComparisonType) => void;
  onCustomDateClick?: () => void;
}

export interface ReportsSummaryCardsProps {
  comparison: ComparisonData;
  isLoading?: boolean;
}

export interface ReportsBarChartProps {
  chartData: ReportsChartDataPoint[];
  chartPeriod: ChartPeriodType;
  isLoaded: boolean;
  onPeriodChange: (period: ChartPeriodType) => void;
}

export interface ReportsDonutChartProps {
  categories: CategoryData[];
  totalAmount: number;
  isLoaded: boolean;
  onDetailsClick?: () => void;
}

export interface ReportsQuickAccessProps {
  onReportClick: (reportId: string) => void;
  activeReport?: string | null;
  isLoaded: boolean;
}

export interface ReportsInsightsProps {
  insights: Insight[];
  isLoaded: boolean;
}

export interface ReportsDetailedTablesProps {
  revenueByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  expenseSubcategories?: Record<string, SubcategoryData[]>;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

// Hook return types
export interface UseReportsComparisonReturn {
  comparison: ComparisonData;
  isLoading: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
  comparisonDateRange: {
    start: Date;
    end: Date;
  } | null;
}

export interface UseReportsInsightsReturn {
  insights: Insight[];
  isLoading: boolean;
}
