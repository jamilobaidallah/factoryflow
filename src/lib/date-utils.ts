/**
 * Date and Number Formatting Utilities
 * All dates use English format with English numerals
 * أدوات تنسيق التاريخ والأرقام - جميع الأرقام بالإنجليزية
 */

// Type for date-like values
type DateLike = Date | { toDate: () => Date } | string | number;

/**
 * Safely convert any date-like value to a Date object
 * Handles Firestore Timestamp, Date, string, etc.
 */
function toDate(date: DateLike | null | undefined): Date {
  if (!date) {
    return new Date();
  }
  if (date instanceof Date) {
    return date;
  }
  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  return new Date(date as string | number);
}

/**
 * Format: "13 December 2025"
 */
export function formatDate(date: DateLike): string {
  const d = toDate(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format: "13 December 2025, 9:29 AM"
 */
export function formatDateTime(date: DateLike): string {
  const d = toDate(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format: "9:29 AM"
 */
export function formatTime(date: DateLike): string {
  const d = toDate(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format: "13/12/2025" (day/month/year)
 */
export function formatShortDate(date: DateLike): string {
  const d = toDate(date);
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format: "December 2025"
 */
export function formatMonthYear(date: DateLike): string {
  const d = toDate(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

/**
 * Format: "Dec 2025" (short month)
 */
export function formatShortMonthYear(date: DateLike): string {
  const d = toDate(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

/**
 * Format numbers with commas: 1000 → "1,000"
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format currency: 1000 → "1,000 دينار"
 */
export function formatCurrency(amount: number, currency: string = 'دينار', decimals: number = 0): string {
  return `${formatNumber(amount, decimals)} ${currency}`;
}

/**
 * Format currency with 2 decimal places: 1000 → "1,000.00 دينار"
 */
export function formatCurrencyDecimal(amount: number, currency: string = 'دينار'): string {
  return formatCurrency(amount, currency, 2);
}
