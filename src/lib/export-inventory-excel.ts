import ExcelJS from 'exceljs';
import { formatNumber } from './date-utils';
import { safeMultiply, safeAdd, roundCurrency } from './currency';

interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  subCategory?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  thickness?: number | null;
  width?: number | null;
  length?: number | null;
  location?: string;
  minStock?: number;
  notes?: string;
}

/**
 * Export inventory items to a professional Excel file with styled headers,
 * stock status coloring (available=green, low stock=red), and value totals.
 * @param items - Array of inventory items to export
 */
export async function exportInventoryToExcelProfessional(items: InventoryItem[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactoryFlow';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Inventory Report', {
    views: [{ rightToLeft: false }],
    properties: { defaultColWidth: 15 }
  });

  // Set column widths
  worksheet.columns = [
    { key: 'itemName', width: 40 },
    { key: 'category', width: 40 },
    { key: 'quantity', width: 14 },
    { key: 'unit', width: 12 },
    { key: 'unitPrice', width: 16 },
    { key: 'totalValue', width: 18 },
    { key: 'status', width: 16 },
  ];

  let rowNum = 1;

  // === TITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const titleCell = worksheet.getCell(`A${rowNum}`);
  titleCell.value = 'Inventory Report - تقرير المخزون';
  titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' } // Dark blue
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 32;
  rowNum++;

  // === SUBTITLE ROW ===
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const subtitleCell = worksheet.getCell(`A${rowNum}`);
  subtitleCell.value = 'Factory Inventory Report';
  subtitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB8860B' } // Gold
  };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(rowNum).height = 24;
  rowNum++;

  // Empty row
  rowNum++;

  // === INFO SECTION ===
  // Calculate totals
  const totalItems = items.length;
  const totalValue = items.reduce((sum, item) => {
    const itemValue = safeMultiply(item.quantity || 0, item.unitPrice || 0);
    return safeAdd(sum, itemValue);
  }, 0);
  const lowStockCount = items.filter(item => {
    const minStock = item.minStock || 0;
    return minStock > 0 && item.quantity <= minStock;
  }).length;

  // Generated date
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const genCell = worksheet.getCell(`A${rowNum}`);
  genCell.value = `Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  genCell.font = { size: 11 };
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Total items
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const itemsCell = worksheet.getCell(`A${rowNum}`);
  itemsCell.value = `Total Items: ${totalItems}`;
  itemsCell.font = { size: 11, bold: true };
  itemsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Total value
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  const valueCell = worksheet.getCell(`A${rowNum}`);
  valueCell.value = `Total Value: ${formatNumber(roundCurrency(totalValue), 2)} JOD`;
  valueCell.font = { size: 11, bold: true, color: { argb: 'FF16A34A' } };
  valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  rowNum++;

  // Low stock warning if any
  if (lowStockCount > 0) {
    worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
    const lowStockCell = worksheet.getCell(`A${rowNum}`);
    lowStockCell.value = `Low Stock Items: ${lowStockCount}`;
    lowStockCell.font = { size: 11, bold: true, color: { argb: 'FFDC2626' } };
    lowStockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    rowNum++;
  }

  // Empty row
  rowNum++;

  // === TABLE HEADER ===
  const headerRow = worksheet.getRow(rowNum);
  headerRow.values = ['Item Name', 'Category', 'Quantity', 'Unit', 'Unit Price', 'Total Value', 'Status'];
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= 7) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' } // Dark blue
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
  items.forEach((item, index) => {
    const row = worksheet.getRow(rowNum);
    const itemValue = safeMultiply(item.quantity || 0, item.unitPrice || 0);
    const isLowStock = (item.minStock || 0) > 0 && item.quantity <= (item.minStock || 0);
    const status = isLowStock ? 'Low Stock' : 'Available';
    const categoryDisplay = item.subCategory ? `${item.category} / ${item.subCategory}` : item.category;

    row.values = [
      item.itemName || '-',
      categoryDisplay || '-',
      item.quantity || 0,
      item.unit || '-',
      formatNumber(item.unitPrice || 0, 2),
      formatNumber(roundCurrency(itemValue), 2),
      status
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

        // Align numbers to right
        if (colNumber >= 3 && colNumber <= 6) {
          cell.alignment = { horizontal: 'right' };
        }

        // Center status column
        if (colNumber === 7) {
          cell.alignment = { horizontal: 'center' };
          // Color status based on stock level
          if (isLowStock) {
            cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFEE2E2' } // red-100
            };
          } else {
            cell.font = { color: { argb: 'FF16A34A' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFDCFCE7' } // green-100
            };
          }
        }

        // Bold total value
        if (colNumber === 6) {
          cell.font = { bold: true };
        }
      }
    });
    rowNum++;
  });

  // === TOTALS ROW ===
  const totalsRow = worksheet.getRow(rowNum);
  totalsRow.values = ['TOTAL', '', '', '', '', formatNumber(roundCurrency(totalValue), 2), ''];
  totalsRow.eachCell((cell, colNumber) => {
    if (colNumber <= 7) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC0392B' } // Red
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF922B21' } },
        bottom: { style: 'medium', color: { argb: 'FF922B21' } },
        left: { style: 'medium', color: { argb: 'FF922B21' } },
        right: { style: 'medium', color: { argb: 'FF922B21' } }
      };
      if (colNumber === 6) {
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
  a.download = `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
