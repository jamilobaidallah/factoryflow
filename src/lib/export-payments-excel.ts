import ExcelJS from 'exceljs';
import { formatNumber, formatShortDate } from './date-utils';
import { safeAdd, roundCurrency } from './currency';

interface Payment {
  id: string;
  clientName?: string;
  date: Date;
  type?: string;
  amount: number;
  paymentMethod?: string;
  linkedTransactionId?: string;
  notes?: string;
}

export async function exportPaymentsToExcelProfessional(payments: Payment[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactoryFlow';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Payments Report', {
    views: [{ rightToLeft: false }],
    properties: { defaultColWidth: 15 }
  });

  // Set column widths
  worksheet.columns = [
    { key: 'date', width: 14 },
    { key: 'clientName', width: 35 },
    { key: 'type', width: 12 },
    { key: 'amount', width: 16 },
    { key: 'method', width: 16 },
    { key: 'reference', width: 20 },
    { key: 'notes', width: 40 },
  ];

  let rowNum = 1;

  // === TITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const titleCell = worksheet.getCell(`A${rowNum}`);
  titleCell.value = 'Payments Report - المدفوعات';
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
  subtitleCell.value = 'Payment Transactions Report';
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
  const totalReceipts = payments
    .filter(p => p.type === 'قبض' || p.type === 'receipt')
    .reduce((sum, p) => safeAdd(sum, p.amount || 0), 0);
  const totalDisbursements = payments
    .filter(p => p.type === 'صرف' || p.type === 'disbursement')
    .reduce((sum, p) => safeAdd(sum, p.amount || 0), 0);

  // Generated date
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const genCell = worksheet.getCell(`A${rowNum}`);
  genCell.value = `Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  genCell.font = { size: 11 };
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Total payments
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const countCell = worksheet.getCell(`A${rowNum}`);
  countCell.value = `Total Payments: ${payments.length}`;
  countCell.font = { size: 11, bold: true };
  countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Receipts
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const receiptsCell = worksheet.getCell(`A${rowNum}`);
  receiptsCell.value = `Total Receipts (قبض): ${formatNumber(totalReceipts, 2)} JOD`;
  receiptsCell.font = { size: 11, bold: true, color: { argb: 'FF16A34A' } };
  receiptsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Disbursements
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const disbCell = worksheet.getCell(`A${rowNum}`);
  disbCell.value = `Total Disbursements (صرف): ${formatNumber(totalDisbursements, 2)} JOD`;
  disbCell.font = { size: 11, bold: true, color: { argb: 'FFDC2626' } };
  disbCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Empty row
  rowNum++;

  // === TABLE HEADER ===
  const headerRow = worksheet.getRow(rowNum);
  headerRow.values = ['Date', 'Client Name', 'Type', 'Amount', 'Method', 'Reference', 'Notes'];
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
  payments.forEach((payment, index) => {
    const row = worksheet.getRow(rowNum);
    const isReceipt = payment.type === 'قبض' || payment.type === 'receipt';

    row.values = [
      payment.date instanceof Date ? formatShortDate(payment.date) : '-',
      payment.clientName || '-',
      payment.type || '-',
      formatNumber(payment.amount || 0, 2),
      payment.paymentMethod || '-',
      payment.linkedTransactionId || '-',
      payment.notes || '-'
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

        // Align amount to right with color
        if (colNumber === 4) {
          cell.alignment = { horizontal: 'right' };
          cell.font = {
            bold: true,
            color: { argb: isReceipt ? 'FF16A34A' : 'FFDC2626' }
          };
        }

        // Center type and method
        if (colNumber === 3 || colNumber === 5) {
          cell.alignment = { horizontal: 'center' };
        }
      }
    });
    rowNum++;
  });

  // === TOTALS ROW ===
  const totalsRow = worksheet.getRow(rowNum);
  const netAmount = roundCurrency(totalReceipts - totalDisbursements);
  totalsRow.values = ['TOTALS', '', '', formatNumber(netAmount, 2), '', '', ''];
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
      if (colNumber === 4) {
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
  a.download = `Payments_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
