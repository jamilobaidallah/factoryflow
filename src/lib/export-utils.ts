'use client';

import { formatShortDate, formatNumber } from './date-utils';
import { COMPANY_NAME_AR_FULL } from './branding';

/** Generic record type for export functions - represents a row of data
 * Uses `any` intentionally - these deprecated functions accept any object shape */
type ExportRecord = Record<string, any>;

// ExcelJS is dynamically imported only when needed to reduce bundle size (~23MB)

/**
 * Export data to Excel file (basic version)
 * @deprecated Use the professional export functions in separate files instead:
 * - exportLedgerToExcelProfessional from '@/lib/export-ledger-excel'
 * - exportPaymentsToExcelProfessional from '@/lib/export-payments-excel'
 * - exportChequesToExcelProfessional from '@/lib/export-cheques-excel'
 * - exportInventoryToExcelProfessional from '@/lib/export-inventory-excel'
 * - exportReportsToExcelProfessional from '@/lib/export-reports-excel'
 * @param data Array of objects to export
 * @param filename Name of the file (without extension)
 * @param sheetName Name of the worksheet
 */
export async function exportToExcel(
  data: ExportRecord[],
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
 * Export ledger entries to Excel (basic version)
 * @deprecated Use exportLedgerToExcelProfessional from '@/lib/export-ledger-excel' instead
 * @param entries Ledger entries to export
 * @param filename Name of the file
 */
export async function exportLedgerToExcel(entries: ExportRecord[], filename: string = 'ledger-entries'): Promise<void> {
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
 * Export payments to Excel (basic version)
 * @deprecated Use exportPaymentsToExcelProfessional from '@/lib/export-payments-excel' instead
 * @param payments Payment entries to export
 * @param filename Name of the file
 */
export async function exportPaymentsToExcel(payments: ExportRecord[], filename: string = 'payments'): Promise<void> {
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
 * Export cheques to Excel (basic version)
 * @deprecated Use exportChequesToExcelProfessional from '@/lib/export-cheques-excel' instead
 * @param cheques Cheque entries to export
 * @param filename Name of the file
 */
export async function exportChequesToExcel(cheques: ExportRecord[], filename: string = 'cheques'): Promise<void> {
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
 * Export inventory to Excel (basic version)
 * @deprecated Use exportInventoryToExcelProfessional from '@/lib/export-inventory-excel' instead
 * @param items Inventory items to export
 * @param filename Name of the file
 */
export async function exportInventoryToExcel(items: ExportRecord[], filename: string = 'inventory'): Promise<void> {
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
export function exportLedgerToHTML(entries: ExportRecord[], title: string = 'الحركات المالية'): void {
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

/**
 * Export client statement as HTML (printable to PDF with Arabic support)
 * This is the recommended method for Arabic content as jsPDF has RTL issues.
 * @param data Statement data including transactions, balances, and pending cheques
 */
export function exportStatementToHTML(data: {
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  dateFrom?: Date;
  dateTo?: Date;
  openingBalance: number;
  transactions: Array<{
    date: Date;
    type?: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  pendingCheques?: Array<{
    chequeNumber: string;
    bankName: string;
    dueDate: Date;
    amount: number;
  }>;
  expectedBalanceAfterCheques?: number;
}): void {
  const fromDate = data.dateFrom ? formatShortDate(data.dateFrom) : 'البداية';
  const toDate = data.dateTo ? formatShortDate(data.dateTo) : 'اليوم';
  const balanceColor = data.finalBalance > 0 ? '#dc2626' : data.finalBalance < 0 ? '#16a34a' : '#6b7280';
  const balanceLabel = data.finalBalance > 0 ? 'رصيد مدين (لنا عليه)' : data.finalBalance < 0 ? 'رصيد دائن (له علينا)' : 'الحساب مسوّى';
  const balanceBg = data.finalBalance > 0 ? '#fef2f2' : data.finalBalance < 0 ? '#f0fdf4' : '#f9fafb';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كشف حساب - ${data.clientName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; background: white; color: #1f2937; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 25px; border-radius: 12px; margin-bottom: 25px; }
    .header-title { font-size: 28px; font-weight: 700; margin-bottom: 5px; }
    .header-subtitle { font-size: 14px; opacity: 0.9; }
    .client-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 25px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 15px; }
    .info-group { }
    .info-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
    .info-value { font-size: 16px; font-weight: 600; color: #1e40af; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
    th { background: #2563eb; color: white; padding: 12px 15px; text-align: right; font-weight: 600; font-size: 13px; }
    td { padding: 10px 15px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    .opening-row { background: #f1f5f9 !important; font-weight: 600; }
    .totals-row { background: #1e40af !important; color: white !important; font-weight: 700; }
    .totals-row td { color: white !important; border: none; }
    .debit { color: #dc2626; }
    .credit { color: #16a34a; }
    .balance-box { background: ${balanceBg}; border: 2px solid ${balanceColor}; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 25px; }
    .balance-label { font-size: 14px; color: #64748b; margin-bottom: 8px; }
    .balance-value { font-size: 28px; font-weight: 700; color: ${balanceColor}; }
    .cheques-section { margin-top: 30px; }
    .cheques-header { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px 8px 0 0; padding: 12px 15px; }
    .cheques-header h3 { color: #92400e; font-size: 16px; margin: 0; }
    .cheques-table { border: 1px solid #f59e0b; border-top: none; border-radius: 0 0 8px 8px; }
    .cheques-table th { background: #fef3c7; color: #92400e; }
    .cheques-total { background: #fef9c3 !important; font-weight: 700; }
    .expected-balance { background: #f3f4f6; border-radius: 8px; padding: 15px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center; }
    .expected-label { color: #4b5563; font-weight: 600; }
    .expected-value { font-size: 18px; font-weight: 700; color: #1e40af; }
    .print-button { position: fixed; top: 20px; left: 20px; background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; font-family: 'Cairo', Arial, sans-serif; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3); display: flex; align-items: center; gap: 8px; }
    .print-button:hover { background: #1d4ed8; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
    @media print {
      .print-button { display: none; }
      body { padding: 0; }
      @page { margin: 1.5cm; size: A4; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .totals-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .balance-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
    طباعة / حفظ كـ PDF
  </button>

  <div class="header">
    <div class="header-title">كشف حساب</div>
    <div class="header-subtitle">${data.clientName}</div>
  </div>

  <div class="client-info">
    <div class="info-group">
      <div class="info-label">اسم العميل</div>
      <div class="info-value">${data.clientName}</div>
    </div>
    ${data.clientPhone ? `<div class="info-group"><div class="info-label">رقم الهاتف</div><div class="info-value">${data.clientPhone}</div></div>` : ''}
    <div class="info-group">
      <div class="info-label">الفترة</div>
      <div class="info-value">${fromDate} - ${toDate}</div>
    </div>
    <div class="info-group">
      <div class="info-label">تاريخ الطباعة</div>
      <div class="info-value">${formatShortDate(new Date())}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        <th>البيان</th>
        <th>مدين</th>
        <th>دائن</th>
        <th>الرصيد</th>
      </tr>
    </thead>
    <tbody>
      <tr class="opening-row">
        <td></td>
        <td>رصيد افتتاحي</td>
        <td></td>
        <td></td>
        <td>${formatNumber(data.openingBalance, 2)} ${data.openingBalance > 0 ? 'د.أ عليه' : data.openingBalance < 0 ? 'د.أ له' : ''}</td>
      </tr>
      ${data.transactions.map(t => `
      <tr>
        <td>${formatShortDate(t.date)}</td>
        <td>${t.description || '-'}</td>
        <td class="debit">${t.debit > 0 ? formatNumber(t.debit, 2) : ''}</td>
        <td class="credit">${t.credit > 0 ? formatNumber(t.credit, 2) : ''}</td>
        <td>${formatNumber(Math.abs(t.balance), 2)} ${t.balance > 0 ? 'د.أ عليه' : t.balance < 0 ? 'د.أ له' : ''}</td>
      </tr>`).join('')}
      <tr class="totals-row">
        <td></td>
        <td>المجموع</td>
        <td>${formatNumber(data.totalDebit, 2)}</td>
        <td>${formatNumber(data.totalCredit, 2)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="balance-box">
    <div class="balance-label">${balanceLabel}</div>
    <div class="balance-value">${formatNumber(Math.abs(data.finalBalance), 2)} د.أ</div>
  </div>

  ${data.pendingCheques && data.pendingCheques.length > 0 ? `
  <div class="cheques-section">
    <div class="cheques-header">
      <h3>شيكات قيد التحصيل (${data.pendingCheques.length})</h3>
    </div>
    <table class="cheques-table">
      <thead>
        <tr>
          <th>رقم الشيك</th>
          <th>البنك</th>
          <th>تاريخ الاستحقاق</th>
          <th>المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${data.pendingCheques.map(c => `
        <tr>
          <td>${c.chequeNumber}</td>
          <td>${c.bankName || '-'}</td>
          <td>${formatShortDate(c.dueDate)}</td>
          <td>${formatNumber(c.amount, 2)} د.أ</td>
        </tr>`).join('')}
        <tr class="cheques-total">
          <td colspan="3">إجمالي الشيكات</td>
          <td>${formatNumber(data.pendingCheques.reduce((sum, c) => sum + c.amount, 0), 2)} د.أ</td>
        </tr>
      </tbody>
    </table>
    ${data.expectedBalanceAfterCheques !== undefined ? `
    <div class="expected-balance">
      <span class="expected-label">الرصيد المتوقع بعد تحصيل الشيكات:</span>
      <span class="expected-value">${formatNumber(Math.abs(data.expectedBalanceAfterCheques), 2)} ${data.expectedBalanceAfterCheques > 0 ? 'د.أ عليه' : data.expectedBalanceAfterCheques < 0 ? 'د.أ له' : 'د.أ'}</span>
    </div>` : ''}
  </div>` : ''}

  <div class="footer">
    ${`تم إنشاء هذا التقرير بواسطة ${COMPANY_NAME_AR_FULL}`}
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
