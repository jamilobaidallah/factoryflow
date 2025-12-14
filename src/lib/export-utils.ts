'use client';

import { formatShortDate, formatNumber } from './date-utils';

// ExcelJS is dynamically imported only when needed to reduce bundle size (~23MB)

/**
 * Export data to Excel file
 * @param data Array of objects to export
 * @param filename Name of the file (without extension)
 * @param sheetName Name of the worksheet
 */
export async function exportToExcel(
  data: any[],
  filename: string,
  sheetName: string = 'Sheet1'
): Promise<void> {
  // Dynamically import ExcelJS only when exporting
  const ExcelJS = (await import('exceljs')).default;

  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // If data is empty, return
  if (data.length === 0) { return; }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Add header row
  worksheet.addRow(headers);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2563EB' }
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };

  // Add data rows
  data.forEach(item => {
    const row = headers.map(header => item[header]);
    worksheet.addRow(row);
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column) {
      column.width = 15;
    }
  });

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Export ledger entries to Excel
 * @param entries Ledger entries to export
 * @param filename Name of the file
 */
export async function exportLedgerToExcel(entries: any[], filename: string = 'ledger-entries'): Promise<void> {
  const exportData = entries.map((entry) => ({
    'رقم المعاملة': entry.transactionId || '',
    'التاريخ': entry.date instanceof Date ? formatShortDate(entry.date) : '',
    'الوصف': entry.description || '',
    'النوع': entry.type || '',
    'الفئة': entry.category || '',
    'الفئة الفرعية': entry.subCategory || '',
    'المبلغ': entry.amount || 0,
    'الطرف المرتبط': entry.associatedParty || '',
    'حالة الدفع': entry.paymentStatus || '',
    'المبلغ المدفوع': entry.totalPaid || 0,
    'الرصيد المتبقي': entry.remainingBalance || 0,
  }));

  await exportToExcel(exportData, filename, 'الحركات المالية');
}

/**
 * Export payments to Excel
 * @param payments Payment entries to export
 * @param filename Name of the file
 */
export async function exportPaymentsToExcel(payments: any[], filename: string = 'payments'): Promise<void> {
  const exportData = payments.map((payment) => ({
    'اسم العميل': payment.clientName || '',
    'التاريخ': payment.date instanceof Date ? formatShortDate(payment.date) : '',
    'النوع': payment.type || '',
    'المبلغ': payment.amount || 0,
    'طريقة الدفع': payment.paymentMethod || '',
    'رقم المعاملة المرتبطة': payment.linkedTransactionId || '',
    'الملاحظات': payment.notes || '',
  }));

  await exportToExcel(exportData, filename, 'المدفوعات');
}

/**
 * Export cheques to Excel
 * @param cheques Cheque entries to export
 * @param filename Name of the file
 */
export async function exportChequesToExcel(cheques: any[], filename: string = 'cheques'): Promise<void> {
  const exportData = cheques.map((cheque) => ({
    'رقم الشيك': cheque.chequeNumber || '',
    'اسم العميل': cheque.clientName || '',
    'النوع': cheque.type || '',
    'المبلغ': cheque.amount || 0,
    'البنك': cheque.bankName || '',
    'تاريخ الاستحقاق': cheque.dueDate instanceof Date ? formatShortDate(cheque.dueDate) : '',
    'الحالة': cheque.status || '',
    'نوع الشيك': cheque.chequeType || '',
    'الملاحظات': cheque.notes || '',
  }));

  await exportToExcel(exportData, filename, 'الشيكات');
}

/**
 * Export inventory to Excel
 * @param items Inventory items to export
 * @param filename Name of the file
 */
export async function exportInventoryToExcel(items: any[], filename: string = 'inventory'): Promise<void> {
  const exportData = items.map((item) => ({
    'اسم العنصر': item.itemName || '',
    'الفئة': item.category || '',
    'الكمية': item.quantity || 0,
    'الوحدة': item.unit || '',
    'سعر الوحدة': item.unitPrice || 0,
    'السماكة': item.thickness || '',
    'العرض': item.width || '',
    'الطول': item.length || '',
    'الموقع': item.location || '',
    'الحد الأدنى': item.minStock || 0,
    'الملاحظات': item.notes || '',
  }));

  await exportToExcel(exportData, filename, 'المخزون');
}

/**
 * Export ledger entries as HTML (printable to PDF with Arabic support)
 * @param entries Ledger entries
 * @param title Report title
 */
export function exportLedgerToHTML(entries: any[], title: string = 'الحركات المالية'): void {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; background: white; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2563eb; }
    h1 { color: #1e40af; font-size: 28px; margin-bottom: 10px; }
    .date { color: #64748b; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #2563eb; color: white; padding: 12px; text-align: right; font-weight: bold; font-size: 14px; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    .amount { font-weight: bold; color: #059669; }
    .expense { color: #dc2626; }
    .print-button { position: fixed; top: 20px; left: 20px; background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .print-button:hover { background: #1d4ed8; }
    @media print { .print-button { display: none; } body { padding: 0; } @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button>
  <div class="header">
    <h1>${title}</h1>
    <p class="date">تاريخ الطباعة: ${formatShortDate(new Date())}</p>
  </div>
  <table>
    <thead>
      <tr><th>رقم المعاملة</th><th>التاريخ</th><th>الوصف</th><th>النوع</th><th>التصنيف</th><th>المبلغ</th></tr>
    </thead>
    <tbody>
      ${entries.map(entry => `<tr>
        <td>${entry.transactionId || ''}</td>
        <td>${entry.date instanceof Date ? formatShortDate(entry.date) : ''}</td>
        <td>${entry.description || ''}</td>
        <td>${entry.type || ''}</td>
        <td>${entry.category || ''}</td>
        <td class="amount ${entry.type === 'مصروف' ? 'expense' : ''}">${formatNumber(entry.amount || 0, 2)} دينار</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/**
 * Export income statement as HTML (printable to PDF with Arabic support)
 */
export function exportIncomeStatementToHTML(
  data: { revenues: Array<{ category: string; amount: number }>; expenses: Array<{ category: string; amount: number }>; totalRevenue: number; totalExpenses: number; netIncome: number; },
  startDate: string,
  endDate: string
): void {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>قائمة الدخل</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; background: white; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2563eb; }
    h1 { color: #1e40af; font-size: 32px; margin-bottom: 10px; }
    .period { color: #64748b; font-size: 16px; margin-bottom: 5px; }
    .date { color: #94a3b8; font-size: 14px; }
    .section { margin-bottom: 40px; }
    h2 { color: #1e40af; font-size: 22px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #2563eb; color: white; padding: 12px; text-align: right; font-weight: bold; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    tr:nth-child(even) { background: #f8fafc; }
    .total-row { background: #dbeafe !important; font-weight: bold; font-size: 16px; }
    .total-row td { border-top: 2px solid #2563eb; border-bottom: 2px solid #2563eb; }
    .net-income { background: #dcfce7; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px; border: 2px solid #16a34a; }
    .net-income h3 { color: #166534; font-size: 20px; margin-bottom: 10px; }
    .net-income .amount { color: #15803d; font-size: 32px; font-weight: bold; }
    .revenue-amount { color: #059669; font-weight: bold; }
    .expense-amount { color: #dc2626; font-weight: bold; }
    .print-button { position: fixed; top: 20px; left: 20px; background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; }
    .print-button:hover { background: #1d4ed8; }
    @media print { .print-button { display: none; } body { padding: 0; } @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button>
  <div class="header">
    <h1>قائمة الدخل</h1>
    <p class="period">من ${startDate} إلى ${endDate}</p>
    <p class="date">تاريخ الطباعة: ${formatShortDate(new Date())}</p>
  </div>
  <div class="section">
    <h2>الإيرادات</h2>
    <table>
      <thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${data.revenues.map(item => `<tr><td>${item.category}</td><td class="revenue-amount">${formatNumber(item.amount, 2)} دينار</td></tr>`).join('')}
        <tr class="total-row"><td>إجمالي الإيرادات</td><td class="revenue-amount">${formatNumber(data.totalRevenue, 2)} دينار</td></tr>
      </tbody>
    </table>
  </div>
  <div class="section">
    <h2>المصروفات</h2>
    <table>
      <thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${data.expenses.map(item => `<tr><td>${item.category}</td><td class="expense-amount">${formatNumber(item.amount, 2)} دينار</td></tr>`).join('')}
        <tr class="total-row"><td>إجمالي المصروفات</td><td class="expense-amount">${formatNumber(data.totalExpenses, 2)} دينار</td></tr>
      </tbody>
    </table>
  </div>
  <div class="net-income">
    <h3>صافي الدخل</h3>
    <p class="amount">${formatNumber(data.netIncome, 2)} دينار</p>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
