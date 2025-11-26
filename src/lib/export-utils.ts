import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  // Set Arabic font support (basic)
  doc.setFont('helvetica');
  doc.setFontSize(16);

  // Title
  doc.text('Income Statement / قائمة الدخل', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Period: ${startDate} to ${endDate}`, 105, 30, { align: 'center' });

  // Revenues section
  doc.setFontSize(14);
  doc.text('Revenues / الإيرادات', 20, 45);

  const revenueData = data.revenues.map((item) => [
    item.category,
    item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Category / الفئة', 'Amount / المبلغ']],
    body: revenueData,
    foot: [['Total Revenue / إجمالي الإيرادات', data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    theme: 'grid',
  });

  // Expenses section
  const finalY = (doc as any).lastAutoTable.finalY || 50;
  doc.setFontSize(14);
  doc.text('Expenses / المصروفات', 20, finalY + 15);

  const expenseData = data.expenses.map((item) => [
    item.category,
    item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: finalY + 20,
    head: [['Category / الفئة', 'Amount / المبلغ']],
    body: expenseData,
    foot: [['Total Expenses / إجمالي المصروفات', data.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    theme: 'grid',
  });

  // Net income
  const finalY2 = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const netIncomeText = `Net Income / صافي الدخل: ${data.netIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  doc.text(netIncomeText, 20, finalY2 + 15);

  // Save PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Export ledger entries to PDF
 * @param entries Ledger entries
 * @param filename Name of the file
 */
export function exportLedgerToPDF(entries: any[], filename: string = 'ledger-entries'): void {
  const doc = new jsPDF();

  doc.setFont('helvetica');
  doc.setFontSize(16);
  doc.text('Ledger Entries / الحركات المالية', 105, 20, { align: 'center' });

  const tableData = entries.slice(0, 50).map((entry) => [
    entry.transactionId || '',
    entry.date instanceof Date ? entry.date.toLocaleDateString('en-US') : '',
    entry.description?.substring(0, 30) || '',
    entry.type || '',
    entry.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0',
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Transaction ID', 'Date', 'Description', 'Type', 'Amount']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
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
