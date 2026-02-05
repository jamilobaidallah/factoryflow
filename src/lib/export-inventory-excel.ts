import { ExcelReportBuilder, EXCEL_COLORS } from './excel';
import { formatNumber } from './date-utils';
import { safeMultiply, safeAdd, roundCurrency } from './currency';

// Stock status colors
const STOCK_STATUS_COLORS = {
  LOW_BG: 'FFFEE2E2',         // Red-100
  LOW_TEXT: 'FFDC2626',       // Red-600
  AVAILABLE_BG: 'FFDCFCE7',   // Green-100
  AVAILABLE_TEXT: 'FF16A34A', // Green-600
} as const;

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
  // Calculate totals
  const totalValue = items.reduce((sum, item) => {
    const itemValue = safeMultiply(item.quantity || 0, item.unitPrice || 0);
    return safeAdd(sum, itemValue);
  }, 0);
  const lowStockCount = items.filter(item => {
    const minStock = item.minStock || 0;
    return minStock > 0 && item.quantity <= minStock;
  }).length;

  // Build report
  const builder = new ExcelReportBuilder('Inventory Report', 7);

  builder
    .setColumns([
      { key: 'itemName', width: 40 },
      { key: 'category', width: 40 },
      { key: 'quantity', width: 14 },
      { key: 'unit', width: 12 },
      { key: 'unitPrice', width: 16 },
      { key: 'totalValue', width: 18 },
      { key: 'status', width: 16 },
    ])
    .setTitle('Inventory Report - تقرير المخزون', 'Factory Inventory Report')
    .addInfoRow(`Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
    .addInfoRow(`Total Items: ${items.length}`, { bold: true })
    .addInfoRow(`Total Value: ${formatNumber(roundCurrency(totalValue), 2)} JOD`, { bold: true, color: EXCEL_COLORS.SUCCESS });

  // Add low stock warning if any
  if (lowStockCount > 0) {
    builder.addInfoRow(`Low Stock Items: ${lowStockCount}`, { bold: true, color: EXCEL_COLORS.DANGER });
  }

  builder
    .addEmptyRow()
    .addTableHeader(['Item Name', 'Category', 'Quantity', 'Unit', 'Unit Price', 'Total Value', 'Status'])
    .addDataRows(items, (row, item, _index, isEven) => {
      const itemValue = safeMultiply(item.quantity || 0, item.unitPrice || 0);
      const isLowStock = (item.minStock || 0) > 0 && item.quantity <= (item.minStock || 0);
      const status = isLowStock ? 'Low Stock' : 'Available';
      const categoryDisplay = item.subCategory ? `${item.category} / ${item.subCategory}` : item.category;
      const bgColor = isEven ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;

      row.values = [
        item.itemName || '-',
        categoryDisplay || '-',
        item.quantity || 0,
        item.unit || '-',
        formatNumber(item.unitPrice || 0, 2),
        formatNumber(roundCurrency(itemValue), 2),
        status,
      ];

      // Apply cell-specific styling
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 7) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };

          // Align numbers to right
          if (colNumber >= 3 && colNumber <= 6) {
            cell.alignment = { horizontal: 'right' };
          }

          // Bold total value
          if (colNumber === 6) {
            cell.font = { bold: true };
          }

          // Center and color status column
          if (colNumber === 7) {
            cell.alignment = { horizontal: 'center' };
            if (isLowStock) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STOCK_STATUS_COLORS.LOW_BG } };
              cell.font = { color: { argb: STOCK_STATUS_COLORS.LOW_TEXT }, bold: true };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STOCK_STATUS_COLORS.AVAILABLE_BG } };
              cell.font = { color: { argb: STOCK_STATUS_COLORS.AVAILABLE_TEXT } };
            }
          }
        }
      });
    })
    .addTotalsRow(
      ['TOTAL', '', '', '', '', formatNumber(roundCurrency(totalValue), 2), ''],
      { rightAlignColumns: [6] }
    )
    .addFooter();

  await builder.download(`Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
