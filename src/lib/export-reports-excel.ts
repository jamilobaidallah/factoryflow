import ExcelJS from 'exceljs';
import { formatNumber } from './date-utils';
import { roundCurrency } from './currency';
import { EXCEL_COLORS } from './excel';

interface ReportData {
  revenueByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Export financial reports to a professional Excel file with separate
 * revenue and expenses sections, color-coded totals, and net income display.
 * @param data - Report data containing revenue/expenses by category and totals
 * @param dateRange - The date range for the report period
 */
export async function exportReportsToExcelProfessional(
  data: ReportData,
  dateRange: DateRange
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactoryFlow';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Financial Report', {
    views: [{ rightToLeft: false }],
    properties: { defaultColWidth: 15 }
  });

  // Set column widths
  worksheet.columns = [
    { key: 'category', width: 50 },
    { key: 'type', width: 16 },
    { key: 'amount', width: 20 },
  ];

  let rowNum = 1;

  // === TITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const titleCell = worksheet.getCell(`A${rowNum}`);
  titleCell.value = 'Financial Report - التقارير المالية';
  titleCell.font = { size: 18, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.TITLE_BG }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 32;
  rowNum++;

  // === SUBTITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const subtitleCell = worksheet.getCell(`A${rowNum}`);
  subtitleCell.value = 'Income Statement Report';
  subtitleCell.font = { size: 12, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.SUBTITLE_BG }
  };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 24;
  rowNum++;

  // Empty row
  rowNum++;

  // === INFO SECTION ===
  const periodStart = dateRange.start.toLocaleDateString('en-GB');
  const periodEnd = dateRange.end.toLocaleDateString('en-GB');

  // Generated date
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const genCell = worksheet.getCell(`A${rowNum}`);
  genCell.value = `Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  genCell.font = { size: 11 };
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.INFO_BG } };
  rowNum++;

  // Period
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const periodCell = worksheet.getCell(`A${rowNum}`);
  periodCell.value = `Period: ${periodStart} - ${periodEnd}`;
  periodCell.font = { size: 11, bold: true };
  periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.INFO_BG } };
  rowNum++;

  // Empty row
  rowNum++;

  // === REVENUE SECTION ===
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const revenueTitleCell = worksheet.getCell(`A${rowNum}`);
  revenueTitleCell.value = 'REVENUE - الإيرادات';
  revenueTitleCell.font = { size: 13, bold: true, color: { argb: EXCEL_COLORS.SUCCESS } };
  revenueTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.SUCCESS_BG_LIGHT } };
  revenueTitleCell.alignment = { horizontal: 'center' };
  worksheet.getRow(rowNum).height = 26;
  rowNum++;

  // Revenue header
  const revenueHeaderRow = worksheet.getRow(rowNum);
  revenueHeaderRow.values = ['Category', 'Type', 'Amount (JOD)'];
  revenueHeaderRow.eachCell((cell, colNumber) => {
    if (colNumber <= 3) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.HEADER_BG } };
      cell.font = { bold: true, color: { argb: EXCEL_COLORS.WHITE } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
        bottom: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
        left: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
        right: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } }
      };
    }
  });
  revenueHeaderRow.height = 22;
  rowNum++;

  // Revenue data
  const revenueEntries = Object.entries(data.revenueByCategory);
  revenueEntries.forEach(([ category, amount], index) => {
    const row = worksheet.getRow(rowNum);
    row.values = [category, 'إيراد', formatNumber(amount, 2)];

    const bgColor = index % 2 === 0 ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;
    row.eachCell((cell, colNumber) => {
      if (colNumber <= 3) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
          bottom: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
          left: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
          right: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } }
        };
        if (colNumber === 2) { cell.alignment = { horizontal: 'center' }; }
        if (colNumber === 3) {
          cell.alignment = { horizontal: 'right' };
          cell.font = { color: { argb: EXCEL_COLORS.SUCCESS }, bold: true };
        }
      }
    });
    rowNum++;
  });

  // Revenue total
  const revenueTotalRow = worksheet.getRow(rowNum);
  revenueTotalRow.values = ['Total Revenue - إجمالي الإيرادات', '', formatNumber(data.totalRevenue, 2)];
  revenueTotalRow.eachCell((cell, colNumber) => {
    if (colNumber <= 3) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.SUCCESS } };
      cell.font = { bold: true, color: { argb: EXCEL_COLORS.WHITE } };
      cell.border = {
        top: { style: 'medium', color: { argb: EXCEL_COLORS.SUCCESS_BORDER } },
        bottom: { style: 'medium', color: { argb: EXCEL_COLORS.SUCCESS_BORDER } },
        left: { style: 'medium', color: { argb: EXCEL_COLORS.SUCCESS_BORDER } },
        right: { style: 'medium', color: { argb: EXCEL_COLORS.SUCCESS_BORDER } }
      };
      if (colNumber === 3) { cell.alignment = { horizontal: 'right' }; }
    }
  });
  revenueTotalRow.height = 24;
  rowNum += 2;

  // === EXPENSES SECTION ===
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const expensesTitleCell = worksheet.getCell(`A${rowNum}`);
  expensesTitleCell.value = 'EXPENSES - المصروفات';
  expensesTitleCell.font = { size: 13, bold: true, color: { argb: EXCEL_COLORS.DANGER } };
  expensesTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.DANGER_BG_LIGHT } };
  expensesTitleCell.alignment = { horizontal: 'center' };
  worksheet.getRow(rowNum).height = 26;
  rowNum++;

  // Expenses header
  const expensesHeaderRow = worksheet.getRow(rowNum);
  expensesHeaderRow.values = ['Category', 'Type', 'Amount (JOD)'];
  expensesHeaderRow.eachCell((cell, colNumber) => {
    if (colNumber <= 3) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.HEADER_BG } };
      cell.font = { bold: true, color: { argb: EXCEL_COLORS.WHITE } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
        bottom: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
        left: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
        right: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } }
      };
    }
  });
  expensesHeaderRow.height = 22;
  rowNum++;

  // Expenses data
  const expenseEntries = Object.entries(data.expensesByCategory);
  expenseEntries.forEach(([category, amount], index) => {
    const row = worksheet.getRow(rowNum);
    row.values = [category, 'مصروف', formatNumber(amount, 2)];

    const bgColor = index % 2 === 0 ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;
    row.eachCell((cell, colNumber) => {
      if (colNumber <= 3) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
          bottom: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
          left: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
          right: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } }
        };
        if (colNumber === 2) { cell.alignment = { horizontal: 'center' }; }
        if (colNumber === 3) {
          cell.alignment = { horizontal: 'right' };
          cell.font = { color: { argb: EXCEL_COLORS.DANGER }, bold: true };
        }
      }
    });
    rowNum++;
  });

  // Expenses total
  const expensesTotalRow = worksheet.getRow(rowNum);
  expensesTotalRow.values = ['Total Expenses - إجمالي المصروفات', '', formatNumber(data.totalExpenses, 2)];
  expensesTotalRow.eachCell((cell, colNumber) => {
    if (colNumber <= 3) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.DANGER } };
      cell.font = { bold: true, color: { argb: EXCEL_COLORS.WHITE } };
      cell.border = {
        top: { style: 'medium', color: { argb: EXCEL_COLORS.DANGER_BORDER } },
        bottom: { style: 'medium', color: { argb: EXCEL_COLORS.DANGER_BORDER } },
        left: { style: 'medium', color: { argb: EXCEL_COLORS.DANGER_BORDER } },
        right: { style: 'medium', color: { argb: EXCEL_COLORS.DANGER_BORDER } }
      };
      if (colNumber === 3) { cell.alignment = { horizontal: 'right' }; }
    }
  });
  expensesTotalRow.height = 24;
  rowNum += 2;

  // === NET INCOME ROW ===
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const netIncomeLabel = worksheet.getCell(`A${rowNum}`);
  netIncomeLabel.value = 'NET INCOME - صافي الدخل';
  netIncomeLabel.font = { size: 14, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  netIncomeLabel.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: data.netProfit >= 0 ? EXCEL_COLORS.SUCCESS : EXCEL_COLORS.DANGER }
  };
  netIncomeLabel.alignment = { horizontal: 'center' };
  worksheet.getRow(rowNum).height = 28;
  rowNum++;

  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const netIncomeValue = worksheet.getCell(`A${rowNum}`);
  netIncomeValue.value = `${formatNumber(roundCurrency(data.netProfit), 2)} JOD`;
  netIncomeValue.font = { size: 20, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  netIncomeValue.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: data.netProfit >= 0 ? EXCEL_COLORS.SUCCESS : EXCEL_COLORS.DANGER }
  };
  netIncomeValue.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 36;
  rowNum += 2;

  // === FOOTER ===
  worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
  const footerCell = worksheet.getCell(`A${rowNum}`);
  footerCell.value = 'Generated by FactoryFlow - Factory Management System';
  footerCell.font = { size: 9, color: { argb: EXCEL_COLORS.MUTED }, italic: true };
  footerCell.alignment = { horizontal: 'center' };

  // === SAVE FILE ===
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const periodStr = `${dateRange.start.toISOString().split('T')[0]}_${dateRange.end.toISOString().split('T')[0]}`;
  a.download = `Financial_Report_${periodStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
