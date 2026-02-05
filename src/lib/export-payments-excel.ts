import { ExcelReportBuilder, EXCEL_COLORS } from './excel';
import { formatNumber, formatShortDate } from './date-utils';
import { safeAdd, roundCurrency } from './currency';

interface Payment {
  id: string;
  clientName?: string;
  date: Date;
  type?: string;
  amount: number;
  paymentMethod?: string;
  linkedTransactionId?: string;
  notes?: string;
}

/**
 * Export payments to a professional Excel file with styled headers,
 * color-coded receipts (green) and disbursements (red), and summary totals.
 * @param payments - Array of payment records to export
 */
export async function exportPaymentsToExcelProfessional(payments: Payment[]): Promise<void> {
  // Sort payments by date ascending (oldest first)
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return dateA - dateB;
  });

  // Calculate totals
  const totalReceipts = payments
    .filter(p => p.type === 'قبض' || p.type === 'receipt')
    .reduce((sum, p) => safeAdd(sum, p.amount || 0), 0);
  const totalDisbursements = payments
    .filter(p => p.type === 'صرف' || p.type === 'disbursement')
    .reduce((sum, p) => safeAdd(sum, p.amount || 0), 0);
  const netAmount = roundCurrency(totalReceipts - totalDisbursements);

  // Build report
  const builder = new ExcelReportBuilder('Payments Report', 7);

  builder
    .setColumns([
      { key: 'date', width: 14 },
      { key: 'clientName', width: 35 },
      { key: 'type', width: 12 },
      { key: 'amount', width: 16 },
      { key: 'method', width: 16 },
      { key: 'reference', width: 20 },
      { key: 'notes', width: 40 },
    ])
    .setTitle('Payments Report - المدفوعات', 'Payment Transactions Report')
    .addInfoRow(`Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
    .addInfoRow(`Total Payments: ${payments.length}`, { bold: true })
    .addInfoRow(`Total Receipts (قبض): ${formatNumber(totalReceipts, 2)} JOD`, { bold: true, color: EXCEL_COLORS.SUCCESS })
    .addInfoRow(`Total Disbursements (صرف): ${formatNumber(totalDisbursements, 2)} JOD`, { bold: true, color: EXCEL_COLORS.DANGER })
    .addEmptyRow()
    .addTableHeader(['Date', 'Client Name', 'Type', 'Amount', 'Method', 'Reference', 'Notes'])
    .addDataRows(sortedPayments, (row, payment, _index, isEven) => {
      const isReceipt = payment.type === 'قبض' || payment.type === 'receipt';
      const bgColor = isEven ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;

      row.values = [
        payment.date instanceof Date ? formatShortDate(payment.date) : '-',
        payment.clientName || '-',
        payment.type || '-',
        formatNumber(payment.amount || 0, 2),
        payment.paymentMethod || '-',
        payment.linkedTransactionId || '-',
        payment.notes || '-',
      ];

      // Apply cell-specific styling
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 7) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };

          // Align amount to right with color
          if (colNumber === 4) {
            cell.alignment = { horizontal: 'right' };
            cell.font = {
              bold: true,
              color: { argb: isReceipt ? EXCEL_COLORS.SUCCESS : EXCEL_COLORS.DANGER },
            };
          }

          // Center type and method
          if (colNumber === 3 || colNumber === 5) {
            cell.alignment = { horizontal: 'center' };
          }
        }
      });
    })
    .addTotalsRow(
      ['TOTALS', '', '', formatNumber(netAmount, 2), '', '', ''],
      { rightAlignColumns: [4] }
    )
    .addFooter();

  await builder.download(`Payments_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
