import { ExcelReportBuilder, EXCEL_COLORS } from './excel';
import { formatNumber, formatShortDate } from './date-utils';
import { safeAdd, roundCurrency } from './currency';

// Special colors for ledger report
const LEDGER_COLORS = {
  DISCOUNT: 'FF2563EB',    // Blue for discounts
  WRITEOFF: 'FFD97706',    // Amber for writeoffs
} as const;

interface LedgerEntry {
  id: string;
  transactionId?: string;
  date: Date;
  description?: string;
  type?: string;
  category?: string;
  subCategory?: string;
  amount: number;
  paymentStatus?: string;
  totalPaid?: number;
  remainingBalance?: number;
  totalDiscount?: number;
  writeoffAmount?: number;
}

/**
 * Export ledger entries to a professional Excel file with styled headers,
 * alternating row colors, and summary totals.
 * @param entries - Array of ledger entries to export
 * @param dateFrom - Optional start date for the report period
 * @param dateTo - Optional end date for the report period
 */
export async function exportLedgerToExcelProfessional(
  entries: LedgerEntry[],
  dateFrom?: Date,
  dateTo?: Date
): Promise<void> {
  // Sort entries by date ascending (oldest first)
  const sortedEntries = [...entries].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return dateA - dateB;
  });

  // Calculate totals
  // Note: 'دخل' = income, 'مصروف' = expense in Arabic
  // Skip equity/capital transactions (رأس المال) - they don't affect P&L
  const isEquityEntry = (e: LedgerEntry) =>
    e.type === 'حركة رأس مال' || e.category === 'رأس المال' || e.category === 'Owner Equity';

  const totalIncome = entries
    .filter(e => (e.type === 'دخل' || e.type === 'income') && !isEquityEntry(e))
    .reduce((sum, e) => safeAdd(sum, e.amount || 0), 0);
  const totalExpenses = entries
    .filter(e => (e.type === 'مصروف' || e.type === 'expense') && !isEquityEntry(e))
    .reduce((sum, e) => safeAdd(sum, e.amount || 0), 0);
  const netBalance = roundCurrency(totalIncome - totalExpenses);
  const totalDiscounts = entries.reduce((sum, e) => safeAdd(sum, e.totalDiscount || 0), 0);
  const totalWriteoffs = entries.reduce((sum, e) => safeAdd(sum, e.writeoffAmount || 0), 0);

  // Build report
  const builder = new ExcelReportBuilder('Ledger Report', 9);

  builder
    .setColumns([
      { key: 'date', width: 14 },
      { key: 'transactionId', width: 26 },
      { key: 'description', width: 55 },
      { key: 'category', width: 40 },
      { key: 'type', width: 12 },
      { key: 'amount', width: 16 },
      { key: 'discount', width: 14 },
      { key: 'writeoff', width: 14 },
      { key: 'status', width: 14 },
    ])
    .setTitle('Ledger Report - دفتر الأستاذ', 'Financial Transactions Report')
    .addInfoRow(`Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);

  // Add period row if date range provided
  if (dateFrom || dateTo) {
    const fromStr = dateFrom ? formatShortDate(dateFrom) : 'Start';
    const toStr = dateTo ? formatShortDate(dateTo) : 'Present';
    builder.addInfoRow(`Period: ${fromStr} - ${toStr}`);
  }

  builder
    .addInfoRow(`Total Entries: ${entries.length}`, { bold: true })
    .addInfoRow(
      `Total Income: ${formatNumber(totalIncome, 2)} JOD | Total Expenses: ${formatNumber(totalExpenses, 2)} JOD | Net: ${formatNumber(netBalance, 2)} JOD`,
      { bold: true, color: netBalance >= 0 ? EXCEL_COLORS.SUCCESS : EXCEL_COLORS.DANGER }
    )
    .addEmptyRow()
    .addTableHeader(['Date', 'Transaction ID', 'Description', 'Category', 'Type', 'Amount', 'Discount', 'Write-off', 'Status'])
    .addDataRows(sortedEntries, (row, entry, _index, isEven) => {
      const isExpense = entry.type === 'مصروف' || entry.type === 'expense';
      const categoryDisplay = entry.subCategory ? `${entry.category} / ${entry.subCategory}` : (entry.category || '-');
      const bgColor = isEven ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;

      row.values = [
        entry.date instanceof Date ? formatShortDate(entry.date) : '-',
        entry.transactionId || '-',
        entry.description || '-',
        categoryDisplay,
        entry.type || '-',
        formatNumber(entry.amount || 0, 2),
        entry.totalDiscount ? formatNumber(entry.totalDiscount, 2) : '-',
        entry.writeoffAmount ? formatNumber(entry.writeoffAmount, 2) : '-',
        entry.paymentStatus || '-',
      ];

      // Apply cell-specific styling
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 9) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };

          // Align amount to right with color based on income/expense
          if (colNumber === 6) {
            cell.alignment = { horizontal: 'right' };
            cell.font = {
              bold: true,
              color: { argb: isExpense ? EXCEL_COLORS.DANGER : EXCEL_COLORS.SUCCESS },
            };
          }

          // Align discount to right with blue color
          if (colNumber === 7) {
            cell.alignment = { horizontal: 'right' };
            if (entry.totalDiscount && entry.totalDiscount > 0) {
              cell.font = { color: { argb: LEDGER_COLORS.DISCOUNT } };
            }
          }

          // Align writeoff to right with amber color
          if (colNumber === 8) {
            cell.alignment = { horizontal: 'right' };
            if (entry.writeoffAmount && entry.writeoffAmount > 0) {
              cell.font = { color: { argb: LEDGER_COLORS.WRITEOFF } };
            }
          }

          // Center type and status
          if (colNumber === 5 || colNumber === 9) {
            cell.alignment = { horizontal: 'center' };
          }
        }
      });
    })
    .addTotalsRow(
      [
        'TOTALS', '', '', '', '',
        formatNumber(netBalance, 2),
        totalDiscounts > 0 ? formatNumber(totalDiscounts, 2) : '-',
        totalWriteoffs > 0 ? formatNumber(totalWriteoffs, 2) : '-',
        '',
      ],
      { rightAlignColumns: [6, 7, 8] }
    )
    .addFooter();

  await builder.download(`Ledger_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
