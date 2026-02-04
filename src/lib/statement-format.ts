/**
 * Shared formatting functions for client statement exports
 */

/**
 * Format a number with commas and 2 decimal places
 * @example formatCurrency(1234.5) → "1,234.50"
 */
export function formatCurrency(amount: number): string {
  return Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format a date to DD/MM/YYYY format
 * @example formatStatementDate(new Date('2025-01-15')) → "15/01/2025"
 */
export function formatStatementDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB');
}

/**
 * Format balance with suffix indicating debit/credit status (English)
 * @example formatBalanceWithSuffix(100) → "100.00 JOD (Debit)"
 * @example formatBalanceWithSuffix(-50) → "50.00 JOD (Credit)"
 */
export function formatBalanceWithSuffix(balance: number): string {
  const formatted = formatCurrency(balance);
  if (balance > 0.01) {return `${formatted} JOD (Debit)`;}
  if (balance < -0.01) {return `${formatted} JOD (Credit)`;}
  return `${formatted} JOD (Settled)`;
}

/**
 * Format balance with Arabic suffix indicating debit/credit status
 * @example formatBalanceAr(100) → "100.00 د.أ عليه"
 * @example formatBalanceAr(-50) → "50.00 د.أ له"
 */
export function formatBalanceAr(balance: number): string {
  const formatted = formatCurrency(balance);
  if (balance > 0.01) {return `${formatted} د.أ عليه`;}
  if (balance < -0.01) {return `${formatted} د.أ له`;}
  return `${formatted} د.أ مسدد`;
}

/**
 * Calculate date range from array of items with date property
 */
export function getDateRange(items: Array<{ date: Date }>): { oldest: Date; newest: Date } {
  if (items.length === 0) {return { oldest: new Date(), newest: new Date() };}
  const dates = items.map(item => new Date(item.date)).sort((a, b) => a.getTime() - b.getTime());
  return { oldest: dates[0], newest: dates[dates.length - 1] };
}

/**
 * Extract payment method from notes/description
 * If notes contains " - ", extract only the part before it
 * @example extractPaymentMethod("تحويل كليك - ملاحظة") → "تحويل كليك"
 */
export function extractPaymentMethod(description: string): string {
  if (!description) {return '';}
  const dashIndex = description.indexOf(' - ');
  return dashIndex > 0 ? description.substring(0, dashIndex) : description;
}
