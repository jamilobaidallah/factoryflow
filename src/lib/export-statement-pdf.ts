import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportStatementData } from './statement-types';
import { formatCurrency, formatBalanceWithSuffix, formatStatementDate } from './statement-format';

// Alias for backward compatibility
const formatDate = formatStatementDate;

// Load Arabic font from Google Fonts CDN
async function loadArabicFont(doc: jsPDF): Promise<void> {
  try {
    // Amiri Regular from Google Fonts
    const fontUrl = 'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.ttf';
    const response = await fetch(fontUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch Arabic font');
    }

    const fontData = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(fontData);

    // Register the font with jsPDF
    doc.addFileToVFS('Amiri-Regular.ttf', base64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  } catch (error) {
    console.warn('Could not load Arabic font, falling back to default:', error);
  }
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Check if text contains Arabic characters
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

// Reverse Arabic text for proper RTL display in jsPDF
function processArabicText(text: string): string {
  if (!containsArabic(text)) return text;
  // Reverse the text for RTL display since jsPDF doesn't handle RTL natively
  return text.split('').reverse().join('');
}

export async function exportStatementToPDF(data: ExportStatementData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Load Arabic font
  await loadArabicFont(doc);
  const hasArabicFont = doc.getFontList()['Amiri'] !== undefined;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Helper to set font based on text content
  const setFontForText = (text: string, style: 'normal' | 'bold' = 'normal') => {
    if (hasArabicFont && containsArabic(text)) {
      doc.setFont('Amiri', style);
    } else {
      doc.setFont('helvetica', style);
    }
  };

  // === HEADER ===
  // Company branding area
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo placeholder
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 8, 28, 18, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(37, 99, 235);
  doc.setFont('helvetica', 'normal');
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

  // Client name - use Arabic font if needed
  setFontForText(data.clientName, 'normal');
  const clientNameDisplay = hasArabicFont ? data.clientName : processArabicText(data.clientName);
  doc.text(clientNameDisplay, margin + 22, yPos + 8);

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
  doc.setTextColor(75, 85, 99); // gray-600 (darker for better readability)
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
    data.openingBalance > 0 ? 'JD' : data.openingBalance < 0 ? 'CR' : '-'
  ]);

  // Transaction rows - process Arabic text in descriptions
  data.transactions.forEach(item => {
    const description = hasArabicFont ? (item.description || '-') : processArabicText(item.description || '-');
    tableData.push([
      formatDate(item.date),
      description,
      item.debit > 0 ? formatCurrency(item.debit) : '',
      item.credit > 0 ? formatCurrency(item.credit) : '',
      formatCurrency(Math.abs(item.balance)),
      item.balance > 0 ? 'JD' : item.balance < 0 ? 'CR' : '-'
    ]);
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Description', 'Debit', 'Credit', 'Balance', '']],
    body: tableData,
    theme: 'striped',
    styles: {
      font: hasArabicFont ? 'Amiri' : 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      textColor: [0, 0, 0], // Black text for body rows
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: [255, 255, 255], // Pure white text
      fontStyle: 'bold',
      halign: 'center',
      font: 'helvetica',
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
      textColor: [0, 0, 0], // Ensure black text on alternate rows
    },
    margin: { left: margin, right: margin },
    didParseCell: function(hookData) {
      // Style opening balance row
      if (hookData.row.index === 0) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [243, 244, 246]; // gray-100
        hookData.cell.styles.textColor = [0, 0, 0]; // Ensure black text
      }
      // Ensure all body rows have black text
      if (hookData.section === 'body') {
        hookData.cell.styles.textColor = [0, 0, 0];
      }
    },
  });

  // @ts-expect-error jspdf-autotable adds lastAutoTable property
  yPos = doc.lastAutoTable.finalY + 2;

  // === TOTALS ROW ===
  autoTable(doc, {
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
      textColor: [255, 255, 255], // Pure white text
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error jspdf-autotable adds lastAutoTable property
  yPos = doc.lastAutoTable.finalY + 10;

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

    const chequesData = data.pendingCheques.map(c => {
      const bankName = hasArabicFont ? (c.bankName || '-') : processArabicText(c.bankName || '-');
      return [
        c.chequeNumber,
        bankName,
        formatDate(c.dueDate),
        formatCurrency(c.amount)
      ];
    });

    // Add total row
    const totalPendingCheques = data.pendingCheques.reduce((sum, c) => sum + c.amount, 0);
    chequesData.push(['', '', 'Total:', formatCurrency(totalPendingCheques)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Cheque No.', 'Bank', 'Due Date', 'Amount']],
      body: chequesData,
      theme: 'grid',
      styles: {
        font: hasArabicFont ? 'Amiri' : 'helvetica',
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 0, 0], // Black text for body rows
      },
      headStyles: {
        fillColor: [254, 243, 199], // yellow-100
        textColor: [161, 98, 7], // yellow-700 (dark enough for yellow bg)
        fontStyle: 'bold',
        font: 'helvetica',
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 35 },
      },
      margin: { left: margin, right: margin },
      didParseCell: function(hookData) {
        // Ensure all body rows have black text
        if (hookData.section === 'body') {
          hookData.cell.styles.textColor = [0, 0, 0];
        }
        // Style total row
        if (data.pendingCheques && hookData.row.index === data.pendingCheques.length) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [254, 249, 195]; // yellow-100
        }
      },
    });

    // @ts-expect-error jspdf-autotable adds lastAutoTable property
    yPos = doc.lastAutoTable.finalY + 8;

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

  // === FOOTER (add to all pages) ===
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(209, 213, 219); // gray-300 (darker line for visibility)
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128); // gray-500 (darker for better readability)
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by FactoryFlow - Factory Management System', pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
  }

  // Save the PDF
  const sanitizedName = data.clientName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  const fileName = `Statement_${sanitizedName}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
