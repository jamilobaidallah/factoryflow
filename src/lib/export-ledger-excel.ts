import ExcelJS from 'exceljs';
import { formatNumber, formatShortDate } from './date-utils';
import { safeAdd, roundCurrency } from './currency';

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
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactoryFlow';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Ledger Report', {
    views: [{ rightToLeft: false }],
    properties: { defaultColWidth: 15 }
  });

  // Set column widths
  worksheet.columns = [
    { key: 'date', width: 14 },
    { key: 'transactionId', width: 26 },
    { key: 'description', width: 55 },
    { key: 'category', width: 40 },
    { key: 'type', width: 12 },
    { key: 'amount', width: 16 },
    { key: 'status', width: 14 },
  ];

  // Sort entries by date ascending (oldest first)
  const sortedEntries = [...entries].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return dateA - dateB;
  });

  let rowNum = 1;

  // === TITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const titleCell = worksheet.getCell(`A${rowNum}`);
  titleCell.value = 'Ledger Report - دفتر الأستاذ';
  titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 32;
  rowNum++;

  // === SUBTITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const subtitleCell = worksheet.getCell(`A${rowNum}`);
  subtitleCell.value = 'Financial Transactions Report';
  subtitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB8860B' }
  };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 24;
  rowNum++;

  // Empty row
  rowNum++;

  // === INFO SECTION ===
  // Calculate totals
  const totalIncome = entries
    .filter(e => e.type === 'إيراد' || e.type === 'income')
    .reduce((sum, e) => safeAdd(sum, e.amount || 0), 0);
  const totalExpenses = entries
    .filter(e => e.type === 'مصروف' || e.type === 'expense')
    .reduce((sum, e) => safeAdd(sum, e.amount || 0), 0);
  const netBalance = roundCurrency(totalIncome - totalExpenses);

  // Generated date
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const genCell = worksheet.getCell(`A${rowNum}`);
  genCell.value = `Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  genCell.font = { size: 11 };
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Period
  if (dateFrom || dateTo) {
    worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
    const periodCell = worksheet.getCell(`A${rowNum}`);
    const fromStr = dateFrom ? formatShortDate(dateFrom) : 'Start';
    const toStr = dateTo ? formatShortDate(dateTo) : 'Present';
    periodCell.value = `Period: ${fromStr} - ${toStr}`;
    periodCell.font = { size: 11 };
    periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    rowNum++;
  }

  // Total entries
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const entriesCell = worksheet.getCell(`A${rowNum}`);
  entriesCell.value = `Total Entries: ${entries.length}`;
  entriesCell.font = { size: 11, bold: true };
  entriesCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Income/Expense summary
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const incomeCell = worksheet.getCell(`A${rowNum}`);
  incomeCell.value = `Total Income: ${formatNumber(totalIncome, 2)} JOD | Total Expenses: ${formatNumber(totalExpenses, 2)} JOD | Net: ${formatNumber(netBalance, 2)} JOD`;
  incomeCell.font = { size: 11, bold: true, color: { argb: netBalance >= 0 ? 'FF16A34A' : 'FFDC2626' } };
  incomeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Empty row
  rowNum++;

  // === TABLE HEADER ===
  const headerRow = worksheet.getRow(rowNum);
  headerRow.values = ['Date', 'Transaction ID', 'Description', 'Category', 'Type', 'Amount', 'Status'];
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= 7) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'thin', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF0F172A' } }
      };
    }
  });
  headerRow.height = 24;
  rowNum++;

  // === DATA ROWS ===
  sortedEntries.forEach((entry, index) => {
    const row = worksheet.getRow(rowNum);
    const isExpense = entry.type === 'مصروف' || entry.type === 'expense';
    const categoryDisplay = entry.subCategory ? `${entry.category} / ${entry.subCategory}` : (entry.category || '-');

    row.values = [
      entry.date instanceof Date ? formatShortDate(entry.date) : '-',
      entry.transactionId || '-',
      entry.description || '-',
      categoryDisplay,
      entry.type || '-',
      formatNumber(entry.amount || 0, 2),
      entry.paymentStatus || '-'
    ];

    // Alternate row colors
    const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
    row.eachCell((cell, colNumber) => {
      if (colNumber <= 7) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        // Align amount to right
        if (colNumber === 6) {
          cell.alignment = { horizontal: 'right' };
          cell.font = {
            bold: true,
            color: { argb: isExpense ? 'FFDC2626' : 'FF16A34A' }
          };
        }

        // Center type and status
        if (colNumber === 5 || colNumber === 7) {
          cell.alignment = { horizontal: 'center' };
        }
      }
    });
    rowNum++;
  });

  // === TOTALS ROW ===
  const totalsRow = worksheet.getRow(rowNum);
  totalsRow.values = ['TOTALS', '', '', '', '', formatNumber(roundCurrency(totalIncome - totalExpenses), 2), ''];
  totalsRow.eachCell((cell, colNumber) => {
    if (colNumber <= 7) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC0392B' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF922B21' } },
        bottom: { style: 'medium', color: { argb: 'FF922B21' } },
        left: { style: 'medium', color: { argb: 'FF922B21' } },
        right: { style: 'medium', color: { argb: 'FF922B21' } }
      };
      if (colNumber === 6) {
        cell.alignment = { horizontal: 'right' };
      }
    }
  });
  totalsRow.height = 26;
  rowNum += 2;

  // === FOOTER ===
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const footerCell = worksheet.getCell(`A${rowNum}`);
  footerCell.value = 'Generated by FactoryFlow - Factory Management System';
  footerCell.font = { size: 9, color: { argb: 'FF9CA3AF' }, italic: true };
  footerCell.alignment = { horizontal: 'center' };

  // === SAVE FILE ===
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ledger_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
