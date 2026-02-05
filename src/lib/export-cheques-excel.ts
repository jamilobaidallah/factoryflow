import { ExcelReportBuilder, EXCEL_COLORS } from './excel';
import { formatNumber, formatShortDate } from './date-utils';
import { safeAdd, roundCurrency } from './currency';

// Status colors for cheques
const STATUS_COLORS = {
  PENDING_BG: 'FFFEF3C7',      // Yellow-100
  PENDING_TEXT: 'FFA16207',    // Amber-700
  CLEARED_BG: 'FFDCFCE7',      // Green-100
  CLEARED_TEXT: 'FF16A34A',    // Green-600
  BOUNCED_BG: 'FFFEE2E2',      // Red-100
  BOUNCED_TEXT: 'FFDC2626',    // Red-600
} as const;

interface Cheque {
  id: string;
  chequeNumber?: string;
  clientName?: string;
  type?: string;
  amount: number;
  bankName?: string;
  dueDate: Date;
  issueDate?: Date;
  status?: string;
  chequeType?: string;
  notes?: string;
}

/**
 * Export cheques to a professional Excel file with styled headers,
 * status-based cell coloring (pending=yellow, cleared=green, bounced=red),
 * and summary totals.
 * @param cheques - Array of cheque records to export
 */
export async function exportChequesToExcelProfessional(cheques: Cheque[]): Promise<void> {
  // Sort cheques by due date ascending (oldest first)
  const sortedCheques = [...cheques].sort((a, b) => {
    const dateA = a.dueDate instanceof Date ? a.dueDate.getTime() : new Date(a.dueDate).getTime();
    const dateB = b.dueDate instanceof Date ? b.dueDate.getTime() : new Date(b.dueDate).getTime();
    return dateA - dateB;
  });

  // Calculate totals
  const totalIncoming = cheques
    .filter(c => c.type === 'صادر' || c.type === 'incoming' || c.chequeType === 'incoming')
    .reduce((sum, c) => safeAdd(sum, c.amount || 0), 0);
  const totalOutgoing = cheques
    .filter(c => c.type === 'وارد' || c.type === 'outgoing' || c.chequeType === 'outgoing')
    .reduce((sum, c) => safeAdd(sum, c.amount || 0), 0);
  const pendingCount = cheques.filter(c =>
    c.status === 'قيد الانتظار' || c.status === 'pending' || c.status === 'معلق'
  ).length;
  const clearedCount = cheques.filter(c =>
    c.status === 'مقبوض' || c.status === 'cleared' || c.status === 'تم التحصيل'
  ).length;
  const netAmount = roundCurrency(totalIncoming - totalOutgoing);

  // Build report
  const builder = new ExcelReportBuilder('Cheques Report', 7);

  builder
    .setColumns([
      { key: 'chequeNumber', width: 18 },
      { key: 'clientName', width: 35 },
      { key: 'dueDate', width: 14 },
      { key: 'amount', width: 16 },
      { key: 'type', width: 14 },
      { key: 'status', width: 16 },
      { key: 'bank', width: 25 },
    ])
    .setTitle('Cheques Report - الشيكات', 'Cheque Management Report')
    .addInfoRow(`Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
    .addInfoRow(`Total Cheques: ${cheques.length} | Pending: ${pendingCount} | Cleared: ${clearedCount}`, { bold: true })
    .addInfoRow(`Total Incoming: ${formatNumber(totalIncoming, 2)} JOD`, { bold: true, color: EXCEL_COLORS.SUCCESS })
    .addInfoRow(`Total Outgoing: ${formatNumber(totalOutgoing, 2)} JOD`, { bold: true, color: EXCEL_COLORS.DANGER })
    .addEmptyRow()
    .addTableHeader(['Cheque No.', 'Client Name', 'Due Date', 'Amount', 'Type', 'Status', 'Bank'])
    .addDataRows(sortedCheques, (row, cheque, _index, isEven) => {
      const isPending = cheque.status === 'قيد الانتظار' || cheque.status === 'pending' || cheque.status === 'معلق';
      const isCleared = cheque.status === 'مقبوض' || cheque.status === 'cleared' || cheque.status === 'تم التحصيل';
      const isBounced = cheque.status === 'مرتجع' || cheque.status === 'bounced';
      const bgColor = isEven ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;

      row.values = [
        cheque.chequeNumber || '-',
        cheque.clientName || '-',
        cheque.dueDate instanceof Date ? formatShortDate(cheque.dueDate) : '-',
        formatNumber(cheque.amount || 0, 2),
        cheque.type || cheque.chequeType || '-',
        cheque.status || '-',
        cheque.bankName || '-',
      ];

      // Apply cell-specific styling
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 7) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };

          // Align amount to right with bold
          if (colNumber === 4) {
            cell.alignment = { horizontal: 'right' };
            cell.font = { bold: true };
          }

          // Center type and status
          if (colNumber === 5 || colNumber === 6) {
            cell.alignment = { horizontal: 'center' };
          }

          // Color status based on state
          if (colNumber === 6) {
            if (isPending) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLORS.PENDING_BG } };
              cell.font = { color: { argb: STATUS_COLORS.PENDING_TEXT }, bold: true };
            } else if (isCleared) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLORS.CLEARED_BG } };
              cell.font = { color: { argb: STATUS_COLORS.CLEARED_TEXT }, bold: true };
            } else if (isBounced) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLORS.BOUNCED_BG } };
              cell.font = { color: { argb: STATUS_COLORS.BOUNCED_TEXT }, bold: true };
            }
          }
        }
      });
    })
    .addTotalsRow(
      ['TOTALS', '', '', formatNumber(netAmount, 2), '', '', ''],
      { rightAlignColumns: [4] }
    )
    .addFooter();

  await builder.download(`Cheques_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
