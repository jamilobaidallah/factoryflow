import ExcelJS from 'exceljs';
import type { ExportStatementData } from './statement-types';
import { formatCurrency, formatBalanceWithSuffix, formatStatementDate } from './statement-format';

// Alias for backward compatibility
const formatDate = formatStatementDate;

export async function exportStatementToExcel(data: ExportStatementData): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactoryFlow';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Account Statement', {
    views: [{ rightToLeft: false }],
    properties: { defaultColWidth: 15 }
  });

  // Set column widths
  worksheet.columns = [
    { key: 'date', width: 14 },
    { key: 'description', width: 45 },
    { key: 'debit', width: 16 },
    { key: 'credit', width: 16 },
    { key: 'balance', width: 22 },
    { key: 'indicator', width: 8 },
  ];

  let rowNum = 1;

  // === HEADER SECTION ===
  // Title row with blue background
  worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
  const titleCell = worksheet.getCell(`A${rowNum}`);
  titleCell.value = 'Account Statement - كشف حساب';
  titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' } // blue-600
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 30;
  rowNum++;

  // Subtitle
  worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
  const subtitleCell = worksheet.getCell(`A${rowNum}`);
  subtitleCell.value = 'Client Financial Report';
  subtitleCell.font = { size: 11, color: { argb: 'FFFFFFFF' } };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' }
  };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  rowNum += 2;

  // Client Info Section
  worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
  const clientInfoBg = worksheet.getCell(`A${rowNum}`);
  clientInfoBg.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFB' } // gray-50
  };

  // Client name
  worksheet.getCell(`A${rowNum}`).value = `Client: ${data.clientName}`;
  worksheet.getCell(`A${rowNum}`).font = { size: 12, bold: true };
  worksheet.getCell(`A${rowNum}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFB' }
  };
  rowNum++;

  // Phone
  if (data.clientPhone) {
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = `Phone: ${data.clientPhone}`;
    worksheet.getCell(`A${rowNum}`).font = { size: 11 };
    worksheet.getCell(`A${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' }
    };
    rowNum++;
  }

  // Period
  const fromDate = data.dateFrom ? formatDate(data.dateFrom) : 'Start';
  const toDate = data.dateTo ? formatDate(data.dateTo) : formatDate(new Date());
  worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
  worksheet.getCell(`A${rowNum}`).value = `Period: ${fromDate} - ${toDate}`;
  worksheet.getCell(`A${rowNum}`).font = { size: 11 };
  worksheet.getCell(`A${rowNum}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFB' }
  };
  rowNum++;

  // Generated date
  worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
  worksheet.getCell(`A${rowNum}`).value = `Generated: ${formatDate(new Date())}`;
  worksheet.getCell(`A${rowNum}`).font = { size: 10, color: { argb: 'FF6B7280' } };
  worksheet.getCell(`A${rowNum}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFB' }
  };
  rowNum += 2;

  // === TABLE HEADER ===
  const headerRow = worksheet.getRow(rowNum);
  headerRow.values = ['Date', 'Description', 'Debit', 'Credit', 'Balance', ''];
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= 6) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' } // blue-600
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1E40AF' } },
        bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
        left: { style: 'thin', color: { argb: 'FF1E40AF' } },
        right: { style: 'thin', color: { argb: 'FF1E40AF' } }
      };
    }
  });
  headerRow.height = 22;
  rowNum++;

  // === OPENING BALANCE ROW ===
  const openingRow = worksheet.getRow(rowNum);
  const openingIndicator = data.openingBalance > 0 ? 'JD' : data.openingBalance < 0 ? 'CR' : '-';
  openingRow.values = ['', 'Opening Balance', '', '', formatCurrency(data.openingBalance), openingIndicator];
  openingRow.eachCell((cell, colNumber) => {
    if (colNumber <= 6) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' } // gray-100
      };
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    }
    // Align numbers
    if (colNumber >= 3 && colNumber <= 5) {
      cell.alignment = { horizontal: 'right' };
    }
    if (colNumber === 6) {
      cell.alignment = { horizontal: 'center' };
    }
  });
  rowNum++;

  // === TRANSACTION ROWS ===
  data.transactions.forEach((item, index) => {
    const row = worksheet.getRow(rowNum);
    const balanceIndicator = item.balance > 0 ? 'JD' : item.balance < 0 ? 'CR' : '-';
    row.values = [
      formatDate(item.date),
      item.description || '-',
      item.debit > 0 ? formatCurrency(item.debit) : '',
      item.credit > 0 ? formatCurrency(item.credit) : '',
      formatCurrency(Math.abs(item.balance)),
      balanceIndicator
    ];

    // Alternate row colors
    const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
    row.eachCell((cell, colNumber) => {
      if (colNumber <= 6) {
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

        // Align numbers
        if (colNumber >= 3 && colNumber <= 5) {
          cell.alignment = { horizontal: 'right' };
        }
        if (colNumber === 6) {
          cell.alignment = { horizontal: 'center' };
        }

        // Color for debit (red)
        if (colNumber === 3 && cell.value) {
          cell.font = { color: { argb: 'FFDC2626' } };
        }
        // Color for credit (green)
        if (colNumber === 4 && cell.value) {
          cell.font = { color: { argb: 'FF16A34A' } };
        }
        // Color for balance
        if (colNumber === 5 || colNumber === 6) {
          cell.font = {
            color: { argb: item.balance >= 0 ? 'FFDC2626' : 'FF16A34A' },
            bold: colNumber === 5
          };
        }
      }
    });
    rowNum++;
  });

  // === TOTALS ROW ===
  const totalsRow = worksheet.getRow(rowNum);
  totalsRow.values = ['', 'TOTALS', formatCurrency(data.totalDebit), formatCurrency(data.totalCredit), '', ''];
  totalsRow.eachCell((cell, colNumber) => {
    if (colNumber <= 6) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' } // blue-800
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
        right: { style: 'thin', color: { argb: 'FF1E3A8A' } }
      };
      if (colNumber >= 3 && colNumber <= 5) {
        cell.alignment = { horizontal: 'right' };
      }
    }
  });
  totalsRow.height = 22;
  rowNum++;

  // === FINAL BALANCE ROW ===
  const finalRow = worksheet.getRow(rowNum);
  const finalLabel = data.finalBalance > 0 ? 'Amount Due (Client Owes)' : data.finalBalance < 0 ? 'Credit Balance (We Owe)' : 'Account Settled';
  finalRow.values = ['', finalLabel, '', '', `${formatCurrency(data.finalBalance)} JOD`, ''];

  const balanceColor = data.finalBalance > 0 ? 'FFDC2626' : data.finalBalance < 0 ? 'FF16A34A' : 'FF6B7280';
  finalRow.eachCell((cell, colNumber) => {
    if (colNumber <= 6) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: balanceColor }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'medium', color: { argb: balanceColor } },
        bottom: { style: 'medium', color: { argb: balanceColor } },
        left: { style: 'medium', color: { argb: balanceColor } },
        right: { style: 'medium', color: { argb: balanceColor } }
      };
      if (colNumber === 5) {
        cell.alignment = { horizontal: 'right' };
      }
    }
  });
  finalRow.height = 24;
  rowNum += 2;

  // === PENDING CHEQUES SECTION ===
  if (data.pendingCheques && data.pendingCheques.length > 0) {
    // Section title
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    const chequeTitleCell = worksheet.getCell(`A${rowNum}`);
    chequeTitleCell.value = `Pending Cheques (${data.pendingCheques.length})`;
    chequeTitleCell.font = { size: 12, bold: true, color: { argb: 'FFA16207' } };
    chequeTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' } // yellow-100
    };
    rowNum++;

    // Cheque header
    const chequeHeaderRow = worksheet.getRow(rowNum);
    chequeHeaderRow.values = ['Cheque No.', 'Bank', 'Due Date', 'Amount', '', ''];
    chequeHeaderRow.eachCell((cell, colNumber) => {
      if (colNumber <= 4) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' } // yellow-100
        };
        cell.font = { bold: true, color: { argb: 'FFA16207' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFDE68A' } },
          bottom: { style: 'thin', color: { argb: 'FFFDE68A' } },
          left: { style: 'thin', color: { argb: 'FFFDE68A' } },
          right: { style: 'thin', color: { argb: 'FFFDE68A' } }
        };
      }
    });
    rowNum++;

    // Cheque rows
    let totalCheques = 0;
    data.pendingCheques.forEach((cheque, index) => {
      const chequeRow = worksheet.getRow(rowNum);
      chequeRow.values = [
        cheque.chequeNumber,
        cheque.bankName || '-',
        formatDate(cheque.dueDate),
        formatCurrency(cheque.amount),
        '',
        ''
      ];
      totalCheques += cheque.amount;

      const chequeBg = index % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF';
      chequeRow.eachCell((cell, colNumber) => {
        if (colNumber <= 4) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: chequeBg }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFFDE68A' } },
            bottom: { style: 'thin', color: { argb: 'FFFDE68A' } },
            left: { style: 'thin', color: { argb: 'FFFDE68A' } },
            right: { style: 'thin', color: { argb: 'FFFDE68A' } }
          };
          if (colNumber === 4) {
            cell.alignment = { horizontal: 'right' };
          }
        }
      });
      rowNum++;
    });

    // Cheque total row
    const chequeTotalRow = worksheet.getRow(rowNum);
    chequeTotalRow.values = ['', '', 'Total:', formatCurrency(totalCheques), '', ''];
    chequeTotalRow.eachCell((cell, colNumber) => {
      if (colNumber >= 3 && colNumber <= 4) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFDE68A' } // yellow-200
        };
        cell.font = { bold: true };
        if (colNumber === 4) {
          cell.alignment = { horizontal: 'right' };
        }
      }
    });
    rowNum++;

    // Expected balance after cheques
    if (data.expectedBalanceAfterCheques !== undefined) {
      rowNum++;
      worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
      const expectedCell = worksheet.getCell(`A${rowNum}`);
      expectedCell.value = `Expected Balance After Cheques Clear: ${formatBalanceWithSuffix(data.expectedBalanceAfterCheques)}`;
      expectedCell.font = { bold: true };
      expectedCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      };
    }
  }

  // === FOOTER ===
  rowNum += 2;
  worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
  const footerCell = worksheet.getCell(`A${rowNum}`);
  footerCell.value = 'Generated by FactoryFlow - Factory Management System';
  footerCell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
  footerCell.alignment = { horizontal: 'center' };

  // === SAVE FILE ===
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sanitizedName = data.clientName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  a.download = `Statement_${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
