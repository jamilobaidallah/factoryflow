import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface StatementTransaction {
  date: Date;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface PendingCheque {
  chequeNumber: string;
  bankName: string;
  dueDate: Date;
  amount: number;
}

interface ExportStatementData {
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  dateFrom?: Date;
  dateTo?: Date;
  openingBalance: number;
  transactions: StatementTransaction[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  pendingCheques?: PendingCheque[];
  expectedBalanceAfterCheques?: number;
}

// Helper functions
function formatCurrency(amount: number): string {
  return Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBalanceWithSuffix(balance: number): string {
  const formatted = formatCurrency(balance);
  if (balance > 0) return `${formatted} JOD (Debit)`;
  if (balance < 0) return `${formatted} JOD (Credit)`;
  return `${formatted} JOD (Settled)`;
}

function formatBalanceArabic(balance: number): string {
  const formatted = formatCurrency(balance);
  if (balance > 0) return `عليه`;
  if (balance < 0) return `له`;
  return `مسدد`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB');
}

export function exportStatementToPDF(data: ExportStatementData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // === HEADER ===
  // Company branding area
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo placeholder
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 8, 28, 18, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(37, 99, 235);
  doc.text('FactoryFlow', margin + 14, 18, { align: 'center' });

  // Title
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('Account Statement', pageWidth - margin, 18, { align: 'right' });
  doc.setFontSize(10);
  doc.text('Client Financial Report', pageWidth - margin, 26, { align: 'right' });

  yPos = 45;

  // === CLIENT INFO BOX ===
  doc.setFillColor(249, 250, 251); // gray-50
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 28, 3, 3, 'F');

  doc.setFontSize(11);
  doc.setTextColor(55, 65, 81); // gray-700

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', margin + 5, yPos + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName, margin + 22, yPos + 8);

  if (data.clientPhone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', margin + 5, yPos + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(data.clientPhone, margin + 22, yPos + 16);
  }

  // Right column - Period
  const fromDate = data.dateFrom ? formatDate(data.dateFrom) : 'Start';
  const toDate = data.dateTo ? formatDate(data.dateTo) : 'Today';

  doc.setFont('helvetica', 'bold');
  doc.text('Period:', pageWidth - margin - 55, yPos + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${fromDate} - ${toDate}`, pageWidth - margin - 38, yPos + 8);

  // Generated date
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - margin - 5, yPos + 22, { align: 'right' });

  yPos += 35;

  // === STATEMENT TABLE ===
  const tableData: (string | number)[][] = [];

  // Opening balance row
  tableData.push([
    '',
    'Opening Balance',
    '',
    '',
    formatCurrency(data.openingBalance),
    data.openingBalance > 0 ? 'DR' : data.openingBalance < 0 ? 'CR' : '-'
  ]);

  // Transaction rows
  data.transactions.forEach(item => {
    tableData.push([
      formatDate(item.date),
      item.description || '-',
      item.debit > 0 ? formatCurrency(item.debit) : '',
      item.credit > 0 ? formatCurrency(item.credit) : '',
      formatCurrency(Math.abs(item.balance)),
      item.balance > 0 ? 'DR' : item.balance < 0 ? 'CR' : '-'
    ]);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: yPos,
    head: [['Date', 'Description', 'Debit', 'Credit', 'Balance', '']],
    body: tableData,
    theme: 'striped',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 12 },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // gray-50
    },
    margin: { left: margin, right: margin },
    didParseCell: function(hookData: { row: { index: number }; column: { index: number }; cell: { styles: { fontStyle: string; fillColor: number[] } } }) {
      // Style opening balance row
      if (hookData.row.index === 0) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [243, 244, 246]; // gray-100
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 2;

  // === TOTALS ROW ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: yPos,
    body: [[
      '',
      'TOTALS',
      formatCurrency(data.totalDebit),
      formatCurrency(data.totalCredit),
      '',
      ''
    ]],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 4,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 12 },
    },
    bodyStyles: {
      fillColor: [30, 64, 175], // blue-800
      textColor: 255,
    },
    margin: { left: margin, right: margin },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // === FINAL BALANCE BOX ===
  const balanceBoxHeight = 20;
  const balanceColor = data.finalBalance > 0 ? [220, 38, 38] : data.finalBalance < 0 ? [22, 163, 74] : [107, 114, 128]; // red/green/gray

  doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, balanceBoxHeight, 3, 3, 'F');

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');

  const balanceLabel = data.finalBalance > 0 ? 'Amount Due (Client Owes)' : data.finalBalance < 0 ? 'Credit Balance (We Owe)' : 'Account Settled';
  doc.text(balanceLabel, margin + 8, yPos + 12);
  doc.text(`${formatCurrency(data.finalBalance)} JOD`, pageWidth - margin - 8, yPos + 12, { align: 'right' });

  yPos += balanceBoxHeight + 10;

  // === PENDING CHEQUES (if any) ===
  if (data.pendingCheques && data.pendingCheques.length > 0) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    // Section header
    doc.setFillColor(254, 243, 199); // yellow-100
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setTextColor(161, 98, 7); // yellow-700
    doc.setFont('helvetica', 'bold');
    doc.text(`Pending Cheques (${data.pendingCheques.length})`, margin + 5, yPos + 7);

    yPos += 12;

    const chequesData = data.pendingCheques.map(c => [
      c.chequeNumber,
      c.bankName || '-',
      formatDate(c.dueDate),
      formatCurrency(c.amount)
    ]);

    // Add total row
    const totalPendingCheques = data.pendingCheques.reduce((sum, c) => sum + c.amount, 0);
    chequesData.push(['', '', 'Total:', formatCurrency(totalPendingCheques)]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: yPos,
      head: [['Cheque No.', 'Bank', 'Due Date', 'Amount']],
      body: chequesData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [254, 243, 199], // yellow-100
        textColor: [161, 98, 7], // yellow-700
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 35 },
      },
      margin: { left: margin, right: margin },
      didParseCell: function(hookData: { row: { index: number }; cell: { styles: { fontStyle: string; fillColor: number[] } } }) {
        // Style total row
        if (data.pendingCheques && hookData.row.index === data.pendingCheques.length) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [254, 249, 195]; // yellow-100
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Expected balance after cheques
    if (data.expectedBalanceAfterCheques !== undefined) {
      doc.setFillColor(243, 244, 246); // gray-100
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 2, 2, 'F');

      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('Expected Balance After Cheques Clear:', margin + 5, yPos + 9);
      doc.text(formatBalanceWithSuffix(data.expectedBalanceAfterCheques), pageWidth - margin - 5, yPos + 9, { align: 'right' });
    }
  }

  // === FOOTER ===
  const pageHeight = doc.internal.pageSize.getHeight();

  // Footer line
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by FactoryFlow - Factory Management System', pageWidth / 2, pageHeight - 12, { align: 'center' });
  doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 7, { align: 'center' });

  // Save the PDF
  const sanitizedName = data.clientName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  const fileName = `Statement_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
