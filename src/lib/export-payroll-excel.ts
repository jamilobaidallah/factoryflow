import { ExcelReportBuilder, EXCEL_COLORS } from './excel';
import { formatNumber } from './date-utils';
import { sumAmounts } from './currency';

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
  // Sort by employee name
  const sortedEntries = [...entries].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, 'ar')
  );

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

  // Build report (RTL for Arabic)
  const builder = new ExcelReportBuilder('Payroll Report', 8, true);

  builder
    .setColumns([
      { key: 'name', width: 30 },
      { key: 'base', width: 16 },
      { key: 'overtime', width: 14 },
      { key: 'overtimePay', width: 14 },
      { key: 'bonus', width: 14 },
      { key: 'deduction', width: 14 },
      { key: 'total', width: 18 },
      { key: 'status', width: 14 },
    ])
    .setTitle(`كشف الرواتب - ${month}`, 'Payroll Report - تقرير الرواتب الشهرية')
    .addInfoRow(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`)
    .addInfoRow(`عدد الموظفين: ${entries.length}`, { bold: true })
    .addInfoRow(`تم الدفع: ${paidCount} | لم يتم الدفع: ${unpaidCount}`, { bold: true })
    .addEmptyRow()
    .addTableHeader(['اسم الموظف', 'الراتب الأساسي', 'ساعات إضافية', 'أجر إضافي', 'مكافآت', 'خصومات', 'الإجمالي', 'الحالة'])
    .addDataRows(sortedEntries, (row, entry, _index, isEven) => {
      const bonusTotal = entry.bonuses ? sumAmounts(entry.bonuses.map(b => b.amount)) : 0;
      const deductionTotal = entry.deductions ? sumAmounts(entry.deductions.map(d => d.amount)) : 0;
      const bgColor = isEven ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;

      row.values = [
        entry.employeeName,
        formatNumber(entry.baseSalary, 2),
        entry.overtimeHours > 0 ? entry.overtimeHours.toString() : '-',
        entry.overtimePay > 0 ? formatNumber(entry.overtimePay, 2) : '-',
        bonusTotal > 0 ? formatNumber(bonusTotal, 2) : '-',
        deductionTotal > 0 ? formatNumber(deductionTotal, 2) : '-',
        formatNumber(entry.totalSalary, 2),
        entry.isPaid ? 'تم الدفع' : 'لم يتم الدفع',
      ];

      // Apply cell-specific styling
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 8) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };

          // Align numbers to center
          if (colNumber >= 2 && colNumber <= 7) {
            cell.alignment = { horizontal: 'center' };
          }

          // Bold total column
          if (colNumber === 7) {
            cell.font = { bold: true };
          }

          // Color for bonus (green)
          if (colNumber === 5 && bonusTotal > 0) {
            cell.font = { color: { argb: EXCEL_COLORS.SUCCESS } };
          }

          // Color for deductions (red)
          if (colNumber === 6 && deductionTotal > 0) {
            cell.font = { color: { argb: EXCEL_COLORS.DANGER } };
          }

          // Status color
          if (colNumber === 8) {
            cell.alignment = { horizontal: 'center' };
            cell.font = {
              bold: true,
              color: { argb: entry.isPaid ? EXCEL_COLORS.SUCCESS : EXCEL_COLORS.DANGER },
            };
          }
        }
      });
    })
    .addTotalsRow(
      [
        'المجموع',
        formatNumber(totalBaseSalaries, 2),
        '',
        formatNumber(totalOvertime, 2),
        formatNumber(totalBonuses, 2),
        formatNumber(totalDeductions, 2),
        formatNumber(grandTotal, 2),
        '',
      ],
      { centerAlignColumns: [2, 3, 4, 5, 6, 7] }
    )
    .addFooter('تم إنشاء التقرير بواسطة FactoryFlow - نظام إدارة المصنع');

  await builder.download(`Payroll_Report_${month}.xlsx`);
}
