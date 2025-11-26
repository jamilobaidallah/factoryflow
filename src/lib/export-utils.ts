'use client';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Translate Arabic text to English for PDF export
 * @param text Text to translate
 * @returns English translation
 */
function translateToEnglish(text: string): string {
  const translations: { [key: string]: string } = {
    // Types
    'دخل': 'Income',
    'مصروف': 'Expense',
    'حصيل': 'Collection',

    // Categories
    'شراء': 'Purchase',
    'بيع': 'Sale',
    'رأس المال': 'Capital',
    'رأس مال مالك': 'Owner Capital',
    'راتب عمل': 'Salary',
    'مصاريف تشغيلية': 'Operating Expenses',
    'مصاريف شخصية': 'Personal Expenses',
    'تحويل بنكي الى فاضي': 'Bank Transfer to Fady',
    'تحويل كليك من رضوان': 'Click Transfer from Radwan',
    'تحويل مشترينا': 'Purchase Transfer',

    // Payment methods
    'نقدي': 'Cash',
    'شيك': 'Check',
    'تحويل': 'Transfer',

    // Status
    'مدفوع': 'Paid',
    'معلق': 'Pending',
    'ملغي': 'Cancelled',
    'مكتمل': 'Completed',
  };

  return translations[text] || text;
}

/**
 * Export data to Excel file
 * @param data Array of objects to export
 * @param filename Name of the file (without extension)
 * @param sheetName Name of the worksheet
 */
export function exportToExcel(
  data: any[],
  filename: string,
  sheetName: string = 'Sheet1'
): void {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate Excel file and trigger download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export ledger entries to Excel
 * @param entries Ledger entries to export
 * @param filename Name of the file
 */
export function exportLedgerToExcel(entries: any[], filename: string = 'ledger-entries'): void {
  const exportData = entries.map((entry) => ({
    'رقم المعاملة': entry.transactionId || '',
    'التاريخ': entry.date instanceof Date ? entry.date.toLocaleDateString('ar-EG') : '',
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

  exportToExcel(exportData, filename, 'الحركات المالية');
}

/**
 * Export payments to Excel
 * @param payments Payment entries to export
 * @param filename Name of the file
 */
export function exportPaymentsToExcel(payments: any[], filename: string = 'payments'): void {
  const exportData = payments.map((payment) => ({
    'اسم العميل': payment.clientName || '',
    'التاريخ': payment.date instanceof Date ? payment.date.toLocaleDateString('ar-EG') : '',
    'النوع': payment.type || '',
    'المبلغ': payment.amount || 0,
    'طريقة الدفع': payment.paymentMethod || '',
    'رقم المعاملة المرتبطة': payment.linkedTransactionId || '',
    'الملاحظات': payment.notes || '',
  }));

  exportToExcel(exportData, filename, 'المدفوعات');
}

/**
 * Export cheques to Excel
 * @param cheques Cheque entries to export
 * @param filename Name of the file
 */
export function exportChequesToExcel(cheques: any[], filename: string = 'cheques'): void {
  const exportData = cheques.map((cheque) => ({
    'رقم الشيك': cheque.chequeNumber || '',
    'اسم العميل': cheque.clientName || '',
    'النوع': cheque.type || '',
    'المبلغ': cheque.amount || 0,
    'البنك': cheque.bankName || '',
    'تاريخ الاستحقاق': cheque.dueDate instanceof Date ? cheque.dueDate.toLocaleDateString('ar-EG') : '',
    'الحالة': cheque.status || '',
    'نوع الشيك': cheque.chequeType || '',
    'الملاحظات': cheque.notes || '',
  }));

  exportToExcel(exportData, filename, 'الشيكات');
}

/**
 * Export inventory to Excel
 * @param items Inventory items to export
 * @param filename Name of the file
 */
export function exportInventoryToExcel(items: any[], filename: string = 'inventory'): void {
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

  exportToExcel(exportData, filename, 'المخزون');
}

/**
 * Export income statement to PDF
 * @param data Income statement data
 * @param startDate Start date of report
 * @param endDate End date of report
 * @param filename Name of the file
 */
export function exportIncomeStatementToPDF(
  data: {
    revenues: { category: string; amount: number }[];
    expenses: { category: string; amount: number }[];
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
  },
  startDate: string,
  endDate: string,
  filename: string = 'income-statement'
): void {
  const doc = new jsPDF();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);

  // Title
  doc.text('Income Statement', 105, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Period: ${startDate} to ${endDate}`, 105, 30, { align: 'center' });

  // Revenues section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Revenues', 20, 45);

  const revenueData = data.revenues.map((item) => [
    translateToEnglish(item.category),
    item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Category', 'Amount']],
    body: revenueData,
    foot: [['Total Revenue', data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    theme: 'striped',
    styles: { fontSize: 10, font: 'helvetica' },
    headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: 'bold' },
  });

  // Expenses section
  const finalY = (doc as any).lastAutoTable.finalY || 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Expenses', 20, finalY + 15);

  const expenseData = data.expenses.map((item) => [
    translateToEnglish(item.category),
    item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: finalY + 20,
    head: [['Category', 'Amount']],
    body: expenseData,
    foot: [['Total Expenses', data.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    theme: 'striped',
    styles: { fontSize: 10, font: 'helvetica' },
    headStyles: { fillColor: [231, 76, 60], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [192, 57, 43], textColor: 255, fontStyle: 'bold' },
  });

  // Net income
  const finalY2 = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const netIncomeText = `Net Income: ${data.netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  doc.text(netIncomeText, 20, finalY2 + 15);

  // Save PDF
  doc.save(`${filename}.pdf`);
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
    <p class="date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
  </div>
  <table>
    <thead>
      <tr><th>رقم المعاملة</th><th>التاريخ</th><th>الوصف</th><th>النوع</th><th>التصنيف</th><th>المبلغ</th></tr>
    </thead>
    <tbody>
      ${entries.map(entry => `<tr>
        <td>${entry.transactionId || ''}</td>
        <td>${entry.date instanceof Date ? entry.date.toLocaleDateString('ar-EG') : ''}</td>
        <td>${entry.description || ''}</td>
        <td>${entry.type || ''}</td>
        <td>${entry.category || ''}</td>
        <td class="amount ${entry.type === 'مصروف' ? 'expense' : ''}">${entry.amount?.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) || '0'} دينار</td>
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
    <p class="date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
  </div>
  <div class="section">
    <h2>الإيرادات</h2>
    <table>
      <thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${data.revenues.map(item => `<tr><td>${item.category}</td><td class="revenue-amount">${item.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} دينار</td></tr>`).join('')}
        <tr class="total-row"><td>إجمالي الإيرادات</td><td class="revenue-amount">${data.totalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} دينار</td></tr>
      </tbody>
    </table>
  </div>
  <div class="section">
    <h2>المصروفات</h2>
    <table>
      <thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead>
      <tbody>
        ${data.expenses.map(item => `<tr><td>${item.category}</td><td class="expense-amount">${item.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} دينار</td></tr>`).join('')}
        <tr class="total-row"><td>إجمالي المصروفات</td><td class="expense-amount">${data.totalExpenses.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} دينار</td></tr>
      </tbody>
    </table>
  </div>
  <div class="net-income">
    <h3>صافي الدخل</h3>
    <p class="amount">${data.netIncome.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} دينار</p>
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
 * Export ledger entries to PDF
 * @param entries Ledger entries
 * @param filename Name of the file
 */
export function exportLedgerToPDF(entries: any[], filename: string = 'ledger-entries'): void {
  const doc = new jsPDF();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Ledger Entries', 105, 20, { align: 'center' });

  const tableData = entries.slice(0, 50).map((entry) => [
    entry.transactionId || '',
    entry.date instanceof Date ? entry.date.toLocaleDateString('en-US') : '',
    translateToEnglish(entry.type || ''),
    translateToEnglish(entry.category || ''),
    entry.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0',
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Transaction ID', 'Date', 'Type', 'Category', 'Amount']],
    body: tableData,
    theme: 'striped',
    styles: { fontSize: 9, font: 'helvetica' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
  });

  if (entries.length > 50) {
    const finalY = (doc as any).lastAutoTable.finalY || 30;
    doc.setFontSize(10);
    doc.text(`Note: Showing first 50 of ${entries.length} entries`, 20, finalY + 10);
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Export balance sheet to PDF
 * @param data Balance sheet data
 * @param date Date of the report
 * @param filename Name of the file
 */
export function exportBalanceSheetToPDF(
  data: {
    assets: { category: string; amount: number }[];
    liabilities: { category: string; amount: number }[];
    equity: { category: string; amount: number }[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  },
  date: string,
  filename: string = 'balance-sheet'
): void {
  const doc = new jsPDF();

  doc.setFont('helvetica');
  doc.setFontSize(16);
  doc.text('Balance Sheet / الميزانية العمومية', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`As of: ${date}`, 105, 30, { align: 'center' });

  // Assets
  doc.setFontSize(14);
  doc.text('Assets / الأصول', 20, 45);

  const assetData = data.assets.map((item) => [
    item.category,
    item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Category / الفئة', 'Amount / المبلغ']],
    body: assetData,
    foot: [['Total Assets / إجمالي الأصول', data.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    theme: 'grid',
  });

  // Liabilities
  const finalY1 = (doc as any).lastAutoTable.finalY || 50;
  doc.setFontSize(14);
  doc.text('Liabilities / الخصوم', 20, finalY1 + 15);

  const liabilityData = data.liabilities.map((item) => [
    item.category,
    item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: finalY1 + 20,
    head: [['Category / الفئة', 'Amount / المبلغ']],
    body: liabilityData,
    foot: [['Total Liabilities / إجمالي الخصوم', data.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    theme: 'grid',
  });

  // Equity
  const finalY2 = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(14);
  doc.text('Equity / حقوق الملكية', 20, finalY2 + 15);

  const equityData = data.equity.map((item) => [
    item.category,
    item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: finalY2 + 20,
    head: [['Category / الفئة', 'Amount / المبلغ']],
    body: equityData,
    foot: [['Total Equity / إجمالي حقوق الملكية', data.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    theme: 'grid',
  });

  doc.save(`${filename}.pdf`);
}
