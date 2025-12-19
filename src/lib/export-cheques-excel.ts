import ExcelJS from 'exceljs';
import { formatNumber, formatShortDate } from './date-utils';
import { safeAdd, roundCurrency } from './currency';

interface Cheque {
  id: string;
  chequeNumber?: string;
  clientName?: string;
  type?: string;
  amount: number;
  bankName?: string;
  dueDate: Date;
  issueDate?: Date;
  status?: string;
  chequeType?: string;
  notes?: string;
}

export async function exportChequesToExcelProfessional(cheques: Cheque[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactoryFlow';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Cheques Report', {
    views: [{ rightToLeft: false }],
    properties: { defaultColWidth: 15 }
  });

  // Set column widths
  worksheet.columns = [
    { key: 'chequeNumber', width: 18 },
    { key: 'clientName', width: 35 },
    { key: 'dueDate', width: 14 },
    { key: 'amount', width: 16 },
    { key: 'type', width: 14 },
    { key: 'status', width: 16 },
    { key: 'bank', width: 25 },
  ];

  let rowNum = 1;

  // === TITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const titleCell = worksheet.getCell(`A${rowNum}`);
  titleCell.value = 'Cheques Report - الشيكات';
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
  subtitleCell.value = 'Cheque Management Report';
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
  const totalIncoming = cheques
    .filter(c => c.type === 'صادر' || c.type === 'incoming' || c.chequeType === 'incoming')
    .reduce((sum, c) => safeAdd(sum, c.amount || 0), 0);
  const totalOutgoing = cheques
    .filter(c => c.type === 'وارد' || c.type === 'outgoing' || c.chequeType === 'outgoing')
    .reduce((sum, c) => safeAdd(sum, c.amount || 0), 0);
  const pendingCount = cheques.filter(c =>
    c.status === 'قيد الانتظار' || c.status === 'pending' || c.status === 'معلق'
  ).length;
  const clearedCount = cheques.filter(c =>
    c.status === 'مقبوض' || c.status === 'cleared' || c.status === 'تم التحصيل'
  ).length;

  // Generated date
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const genCell = worksheet.getCell(`A${rowNum}`);
  genCell.value = `Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  genCell.font = { size: 11 };
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Total cheques
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const countCell = worksheet.getCell(`A${rowNum}`);
  countCell.value = `Total Cheques: ${cheques.length} | Pending: ${pendingCount} | Cleared: ${clearedCount}`;
  countCell.font = { size: 11, bold: true };
  countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Incoming cheques
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const incomingCell = worksheet.getCell(`A${rowNum}`);
  incomingCell.value = `Total Incoming: ${formatNumber(totalIncoming, 2)} JOD`;
  incomingCell.font = { size: 11, bold: true, color: { argb: 'FF16A34A' } };
  incomingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Outgoing cheques
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const outgoingCell = worksheet.getCell(`A${rowNum}`);
  outgoingCell.value = `Total Outgoing: ${formatNumber(totalOutgoing, 2)} JOD`;
  outgoingCell.font = { size: 11, bold: true, color: { argb: 'FFDC2626' } };
  outgoingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Empty row
  rowNum++;

  // === TABLE HEADER ===
  const headerRow = worksheet.getRow(rowNum);
  headerRow.values = ['Cheque No.', 'Client Name', 'Due Date', 'Amount', 'Type', 'Status', 'Bank'];
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
  cheques.forEach((cheque, index) => {
    const row = worksheet.getRow(rowNum);
    const isPending = cheque.status === 'قيد الانتظار' || cheque.status === 'pending' || cheque.status === 'معلق';
    const isCleared = cheque.status === 'مقبوض' || cheque.status === 'cleared' || cheque.status === 'تم التحصيل';
    const isBounced = cheque.status === 'مرتجع' || cheque.status === 'bounced';

    row.values = [
      cheque.chequeNumber || '-',
      cheque.clientName || '-',
      cheque.dueDate instanceof Date ? formatShortDate(cheque.dueDate) : '-',
      formatNumber(cheque.amount || 0, 2),
      cheque.type || cheque.chequeType || '-',
      cheque.status || '-',
      cheque.bankName || '-'
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

        // Align amount to right
        if (colNumber === 4) {
          cell.alignment = { horizontal: 'right' };
          cell.font = { bold: true };
        }

        // Center type and status
        if (colNumber === 5 || colNumber === 6) {
          cell.alignment = { horizontal: 'center' };
        }

        // Color status based on state
        if (colNumber === 6) {
          if (isPending) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            cell.font = { color: { argb: 'FFA16207' }, bold: true };
          } else if (isCleared) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            cell.font = { color: { argb: 'FF16A34A' }, bold: true };
          } else if (isBounced) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { color: { argb: 'FFDC2626' }, bold: true };
          }
        }
      }
    });
    rowNum++;
  });

  // === TOTALS ROW ===
  const totalsRow = worksheet.getRow(rowNum);
  const netAmount = roundCurrency(totalIncoming - totalOutgoing);
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
  a.download = `Cheques_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
