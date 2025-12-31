import ExcelJS from 'exceljs';
import { formatNumber, formatShortDate } from './date-utils';
import { sumAmounts, roundCurrency } from './currency';

interface PayrollExportEntry {
  employeeName: string;
  baseSalary: number;
  overtimeHours: number;
  overtimePay: number;
  bonuses?: { amount: number }[];
  deductions?: { amount: number }[];
  totalSalary: number;
  isPaid: boolean;
  paidDate?: Date;
}

/**
 * Export payroll to a professional Excel file with styled headers,
 * summary totals, and color coding for paid/unpaid status.
 * @param entries - Array of payroll entries to export
 * @param month - The month in "YYYY-MM" format
 */
export async function exportPayrollToExcel(
  entries: PayrollExportEntry[],
  month: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactoryFlow';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Payroll Report', {
    views: [{ rightToLeft: true }],
    properties: { defaultColWidth: 15 }
  });

  // Set column widths
  worksheet.columns = [
    { key: 'name', width: 30 },
    { key: 'base', width: 16 },
    { key: 'overtime', width: 14 },
    { key: 'overtimePay', width: 14 },
    { key: 'bonus', width: 14 },
    { key: 'deduction', width: 14 },
    { key: 'total', width: 18 },
    { key: 'status', width: 14 },
  ];

  // Sort by employee name
  const sortedEntries = [...entries].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, 'ar')
  );

  let rowNum = 1;

  // === TITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  const titleCell = worksheet.getCell(`A${rowNum}`);
  titleCell.value = `كشف الرواتب - ${month}`;
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
  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  const subtitleCell = worksheet.getCell(`A${rowNum}`);
  subtitleCell.value = 'Payroll Report - تقرير الرواتب الشهرية';
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
  const totalBaseSalaries = sumAmounts(entries.map(e => e.baseSalary));
  const totalOvertime = sumAmounts(entries.map(e => e.overtimePay));
  const totalBonuses = sumAmounts(entries.map(e =>
    e.bonuses ? sumAmounts(e.bonuses.map(b => b.amount)) : 0
  ));
  const totalDeductions = sumAmounts(entries.map(e =>
    e.deductions ? sumAmounts(e.deductions.map(d => d.amount)) : 0
  ));
  const grandTotal = sumAmounts(entries.map(e => e.totalSalary));
  const paidCount = entries.filter(e => e.isPaid).length;
  const unpaidCount = entries.length - paidCount;

  // Generated date
  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  const genCell = worksheet.getCell(`A${rowNum}`);
  genCell.value = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`;
  genCell.font = { size: 11 };
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Employee count
  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  const countCell = worksheet.getCell(`A${rowNum}`);
  countCell.value = `عدد الموظفين: ${entries.length}`;
  countCell.font = { size: 11, bold: true };
  countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Paid/Unpaid
  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  const statusCell = worksheet.getCell(`A${rowNum}`);
  statusCell.value = `تم الدفع: ${paidCount} | لم يتم الدفع: ${unpaidCount}`;
  statusCell.font = { size: 11, bold: true };
  statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Empty row
  rowNum++;

  // === TABLE HEADER ===
  const headerRow = worksheet.getRow(rowNum);
  headerRow.values = ['اسم الموظف', 'الراتب الأساسي', 'ساعات إضافية', 'أجر إضافي', 'مكافآت', 'خصومات', 'الإجمالي', 'الحالة'];
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= 8) {
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
    const bonusTotal = entry.bonuses ? sumAmounts(entry.bonuses.map(b => b.amount)) : 0;
    const deductionTotal = entry.deductions ? sumAmounts(entry.deductions.map(d => d.amount)) : 0;

    row.values = [
      entry.employeeName,
      formatNumber(entry.baseSalary, 2),
      entry.overtimeHours > 0 ? entry.overtimeHours.toString() : '-',
      entry.overtimePay > 0 ? formatNumber(entry.overtimePay, 2) : '-',
      bonusTotal > 0 ? formatNumber(bonusTotal, 2) : '-',
      deductionTotal > 0 ? formatNumber(deductionTotal, 2) : '-',
      formatNumber(entry.totalSalary, 2),
      entry.isPaid ? 'تم الدفع' : 'لم يتم الدفع'
    ];

    // Alternate row colors
    const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
    row.eachCell((cell, colNumber) => {
      if (colNumber <= 8) {
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

        // Align numbers to center
        if (colNumber >= 2 && colNumber <= 7) {
          cell.alignment = { horizontal: 'center' };
        }

        // Color for totals
        if (colNumber === 7) {
          cell.font = { bold: true };
        }

        // Color for bonus (green)
        if (colNumber === 5 && bonusTotal > 0) {
          cell.font = { color: { argb: 'FF16A34A' } };
        }

        // Color for deductions (red)
        if (colNumber === 6 && deductionTotal > 0) {
          cell.font = { color: { argb: 'FFDC2626' } };
        }

        // Status color
        if (colNumber === 8) {
          cell.alignment = { horizontal: 'center' };
          cell.font = {
            bold: true,
            color: { argb: entry.isPaid ? 'FF16A34A' : 'FFDC2626' }
          };
        }
      }
    });
    rowNum++;
  });

  // === TOTALS ROW ===
  const totalsRow = worksheet.getRow(rowNum);
  totalsRow.values = [
    'المجموع',
    formatNumber(totalBaseSalaries, 2),
    '',
    formatNumber(totalOvertime, 2),
    formatNumber(totalBonuses, 2),
    formatNumber(totalDeductions, 2),
    formatNumber(grandTotal, 2),
    ''
  ];
  totalsRow.eachCell((cell, colNumber) => {
    if (colNumber <= 8) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'medium', color: { argb: 'FF0F172A' } }
      };
      if (colNumber >= 2 && colNumber <= 7) {
        cell.alignment = { horizontal: 'center' };
      }
    }
  });
  totalsRow.height = 26;
  rowNum += 2;

  // === FOOTER ===
  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  const footerCell = worksheet.getCell(`A${rowNum}`);
  footerCell.value = 'تم إنشاء التقرير بواسطة FactoryFlow - نظام إدارة المصنع';
  footerCell.font = { size: 9, color: { argb: 'FF9CA3AF' }, italic: true };
  footerCell.alignment = { horizontal: 'center' };

  // === SAVE FILE ===
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Payroll_Report_${month}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
