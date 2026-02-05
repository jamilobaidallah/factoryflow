/**
 * ExcelReportBuilder - Shared utility for creating professional Excel reports
 *
 * This builder provides a fluent API for creating styled Excel reports with:
 * - Professional title and subtitle rows
 * - Info/summary sections
 * - Styled data tables with alternating row colors
 * - Totals rows
 * - Consistent branding footer
 *
 * @example
 * const builder = new ExcelReportBuilder('Report Name', 7);
 * builder
 *   .setTitle('Report Title', 'Subtitle')
 *   .addInfoRow('Generated: 1/1/2025')
 *   .addInfoRow('Total: 100 items', { bold: true })
 *   .addTableHeader(['Col1', 'Col2', 'Col3'])
 *   .addDataRows(data, (row, item, index) => {
 *     row.values = [item.name, item.value, item.status];
 *   })
 *   .addTotalsRow(['TOTAL', '', '1,000'])
 *   .download('Report_2025.xlsx');
 */

import ExcelJS from 'exceljs';

// Color constants for consistent branding
export const EXCEL_COLORS = {
  // Header colors
  TITLE_BG: 'FF1E3A5F',        // Dark blue
  SUBTITLE_BG: 'FFB8860B',     // Gold
  HEADER_BG: 'FF1E3A5F',       // Dark blue

  // Info section
  INFO_BG: 'FFF3F4F6',         // Gray-100

  // Data rows
  ROW_EVEN: 'FFFFFFFF',        // White
  ROW_ODD: 'FFF9FAFB',         // Gray-50

  // Totals row
  TOTALS_BG: 'FFC0392B',       // Red
  TOTALS_BORDER: 'FF922B21',   // Darker red

  // Text colors
  WHITE: 'FFFFFFFF',
  SUCCESS: 'FF16A34A',         // Green
  DANGER: 'FFDC2626',          // Red
  WARNING: 'FFA16207',         // Amber
  INFO: 'FF2563EB',            // Blue
  MUTED: 'FF9CA3AF',           // Gray

  // Border colors
  HEADER_BORDER: 'FF0F172A',
  DATA_BORDER: 'FFE5E7EB',

  // Section backgrounds (for income/expense reports)
  SUCCESS_BG_LIGHT: 'FFDCFCE7', // Light green background
  SUCCESS_BORDER: 'FF166534',   // Dark green border
  DANGER_BG_LIGHT: 'FFFEE2E2',  // Light red background
  DANGER_BORDER: 'FF991B1B',    // Dark red border
} as const;

// Cell styling options
export interface CellStyleOptions {
  bold?: boolean;
  color?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
}

// Column configuration
export interface ColumnConfig {
  key: string;
  width: number;
  header?: string;
}

// Row styling callback
export type RowStyleCallback<T> = (
  row: ExcelJS.Row,
  item: T,
  index: number,
  isEvenRow: boolean
) => void;

export class ExcelReportBuilder {
  private workbook: ExcelJS.Workbook;
  private worksheet: ExcelJS.Worksheet;
  private currentRow: number = 1;
  private columnCount: number;
  private isRTL: boolean;

  /**
   * Create a new Excel report builder
   * @param sheetName - Name of the worksheet
   * @param columnCount - Number of columns in the report
   * @param rtl - Whether to use right-to-left layout (default: false)
   */
  constructor(sheetName: string, columnCount: number, rtl: boolean = false) {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'FactoryFlow';
    this.workbook.created = new Date();

    this.worksheet = this.workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: rtl }],
      properties: { defaultColWidth: 15 },
    });

    this.columnCount = columnCount;
    this.isRTL = rtl;
  }

  /**
   * Set column configurations
   */
  setColumns(columns: ColumnConfig[]): this {
    this.worksheet.columns = columns.map(col => ({
      key: col.key,
      width: col.width,
    }));
    return this;
  }

  /**
   * Add title and optional subtitle rows
   */
  setTitle(title: string, subtitle?: string): this {
    // Title row
    this.mergeCellsAcross();
    const titleCell = this.worksheet.getCell(`A${this.currentRow}`);
    titleCell.value = title;
    titleCell.font = { size: 18, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.TITLE_BG },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    this.worksheet.getRow(this.currentRow).height = 32;
    this.currentRow++;

    // Subtitle row (optional)
    if (subtitle) {
      this.mergeCellsAcross();
      const subtitleCell = this.worksheet.getCell(`A${this.currentRow}`);
      subtitleCell.value = subtitle;
      subtitleCell.font = { size: 12, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
      subtitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.SUBTITLE_BG },
      };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      this.worksheet.getRow(this.currentRow).height = 24;
      this.currentRow++;
    }

    // Empty row after title
    this.currentRow++;

    return this;
  }

  /**
   * Add an info row (merged cells spanning all columns)
   */
  addInfoRow(text: string, options?: CellStyleOptions): this {
    this.mergeCellsAcross();
    const cell = this.worksheet.getCell(`A${this.currentRow}`);
    cell.value = text;
    cell.font = {
      size: 11,
      bold: options?.bold ?? false,
      color: options?.color ? { argb: options.color } : undefined,
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: options?.bgColor ?? EXCEL_COLORS.INFO_BG },
    };
    if (options?.align) {
      cell.alignment = { horizontal: options.align };
    }
    this.currentRow++;
    return this;
  }

  /**
   * Add empty row for spacing
   */
  addEmptyRow(): this {
    this.currentRow++;
    return this;
  }

  /**
   * Add table header row
   */
  addTableHeader(headers: string[]): this {
    const headerRow = this.worksheet.getRow(this.currentRow);
    headerRow.values = headers;
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber <= this.columnCount) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.HEADER_BG },
        };
        cell.font = { bold: true, color: { argb: EXCEL_COLORS.WHITE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
          bottom: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
          left: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
          right: { style: 'thin', color: { argb: EXCEL_COLORS.HEADER_BORDER } },
        };
      }
    });
    headerRow.height = 24;
    this.currentRow++;
    return this;
  }

  /**
   * Add data rows with alternating colors
   * @param data - Array of data items
   * @param rowMapper - Function to map data to row values and apply custom styling
   *
   * @example Basic usage - just set row values
   * ```typescript
   * builder.addDataRows(clients, (row, client) => {
   *   row.values = [client.name, client.balance, client.status];
   * });
   * ```
   *
   * @example Cell-level customization - highlight specific cells
   * ```typescript
   * builder.addDataRows(transactions, (row, tx, _index, isEven) => {
   *   row.values = [tx.date, tx.description, tx.amount, tx.status];
   *
   *   // Apply cell-specific styling after setting values
   *   row.eachCell((cell, colNumber) => {
   *     // Highlight amount column based on value
   *     if (colNumber === 3) {
   *       cell.font = {
   *         bold: true,
   *         color: { argb: tx.amount >= 0 ? EXCEL_COLORS.SUCCESS : EXCEL_COLORS.DANGER }
   *       };
   *     }
   *
   *     // Custom background for overdue items
   *     if (tx.isOverdue && colNumber === 4) {
   *       cell.fill = {
   *         type: 'pattern',
   *         pattern: 'solid',
   *         fgColor: { argb: 'FFFFFF00' } // Yellow highlight
   *       };
   *     }
   *   });
   * });
   * ```
   *
   * @example Conditional formatting with custom borders
   * ```typescript
   * builder.addDataRows(cheques, (row, cheque) => {
   *   row.values = [cheque.number, cheque.bank, cheque.amount, cheque.status];
   *
   *   // Highlight bounced cheques
   *   if (cheque.status === 'bounced') {
   *     row.eachCell((cell) => {
   *       cell.fill = {
   *         type: 'pattern',
   *         pattern: 'solid',
   *         fgColor: { argb: EXCEL_COLORS.DANGER_BG_LIGHT }
   *       };
   *       cell.border = {
   *         top: { style: 'thin', color: { argb: EXCEL_COLORS.DANGER } },
   *         bottom: { style: 'thin', color: { argb: EXCEL_COLORS.DANGER } },
   *         left: { style: 'thin', color: { argb: EXCEL_COLORS.DANGER } },
   *         right: { style: 'thin', color: { argb: EXCEL_COLORS.DANGER } }
   *       };
   *     });
   *   }
   * });
   * ```
   */
  addDataRows<T>(data: T[], rowMapper: RowStyleCallback<T>): this {
    data.forEach((item, index) => {
      const row = this.worksheet.getRow(this.currentRow);
      const isEven = index % 2 === 0;
      const bgColor = isEven ? EXCEL_COLORS.ROW_EVEN : EXCEL_COLORS.ROW_ODD;

      // Let the mapper set values and apply custom styling
      rowMapper(row, item, index, isEven);

      // Apply default styling to all cells
      row.eachCell((cell, colNumber) => {
        if (colNumber <= this.columnCount) {
          // Only set fill if not already set
          if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: bgColor },
            };
          }
          // Only set border if not already set
          if (!cell.border) {
            cell.border = {
              top: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
              bottom: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
              left: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
              right: { style: 'thin', color: { argb: EXCEL_COLORS.DATA_BORDER } },
            };
          }
        }
      });

      this.currentRow++;
    });
    return this;
  }

  /**
   * Add a single styled row (for custom layouts like revenue/expense sections)
   */
  addStyledRow(values: (string | number)[], styles?: {
    bgColor?: string;
    textColor?: string;
    bold?: boolean;
    height?: number;
    alignments?: ('left' | 'center' | 'right')[];
    borderColor?: string;
    borderStyle?: 'thin' | 'medium';
  }): this {
    const row = this.worksheet.getRow(this.currentRow);
    row.values = values;

    row.eachCell((cell, colNumber) => {
      if (colNumber <= this.columnCount) {
        if (styles?.bgColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: styles.bgColor },
          };
        }
        cell.font = {
          bold: styles?.bold ?? false,
          color: styles?.textColor ? { argb: styles.textColor } : undefined,
        };
        if (styles?.alignments && styles.alignments[colNumber - 1]) {
          cell.alignment = { horizontal: styles.alignments[colNumber - 1] };
        }
        if (styles?.borderColor) {
          const borderStyle = styles?.borderStyle ?? 'thin';
          cell.border = {
            top: { style: borderStyle, color: { argb: styles.borderColor } },
            bottom: { style: borderStyle, color: { argb: styles.borderColor } },
            left: { style: borderStyle, color: { argb: styles.borderColor } },
            right: { style: borderStyle, color: { argb: styles.borderColor } },
          };
        }
      }
    });

    if (styles?.height) {
      row.height = styles.height;
    }

    this.currentRow++;
    return this;
  }

  /**
   * Add totals row with distinctive styling
   */
  addTotalsRow(values: (string | number)[], options?: {
    bgColor?: string;
    borderColor?: string;
    rightAlignColumns?: number[];
    centerAlignColumns?: number[];
  }): this {
    const row = this.worksheet.getRow(this.currentRow);
    row.values = values;

    const bgColor = options?.bgColor ?? EXCEL_COLORS.TOTALS_BG;
    const borderColor = options?.borderColor ?? EXCEL_COLORS.TOTALS_BORDER;

    row.eachCell((cell, colNumber) => {
      if (colNumber <= this.columnCount) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.font = { bold: true, color: { argb: EXCEL_COLORS.WHITE }, size: 11 };
        cell.border = {
          top: { style: 'medium', color: { argb: borderColor } },
          bottom: { style: 'medium', color: { argb: borderColor } },
          left: { style: 'medium', color: { argb: borderColor } },
          right: { style: 'medium', color: { argb: borderColor } },
        };

        if (options?.rightAlignColumns?.includes(colNumber)) {
          cell.alignment = { horizontal: 'right' };
        } else if (options?.centerAlignColumns?.includes(colNumber)) {
          cell.alignment = { horizontal: 'center' };
        }
      }
    });

    row.height = 26;
    this.currentRow += 2; // Add spacing after totals
    return this;
  }

  /**
   * Add section title (merged, colored row for separating sections)
   */
  addSectionTitle(text: string, options?: {
    bgColor?: string;
    textColor?: string;
  }): this {
    this.mergeCellsAcross();
    const cell = this.worksheet.getCell(`A${this.currentRow}`);
    cell.value = text;
    cell.font = {
      size: 13,
      bold: true,
      color: { argb: options?.textColor ?? EXCEL_COLORS.WHITE },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: options?.bgColor ?? EXCEL_COLORS.HEADER_BG },
    };
    cell.alignment = { horizontal: 'center' };
    this.worksheet.getRow(this.currentRow).height = 26;
    this.currentRow++;
    return this;
  }

  /**
   * Add the standard FactoryFlow footer
   */
  addFooter(customText?: string): this {
    this.mergeCellsAcross();
    const cell = this.worksheet.getCell(`A${this.currentRow}`);
    cell.value = customText ?? 'Generated by FactoryFlow - Factory Management System';
    cell.font = { size: 9, color: { argb: EXCEL_COLORS.MUTED }, italic: true };
    cell.alignment = { horizontal: 'center' };
    return this;
  }

  /**
   * Download the Excel file
   */
  async download(filename: string): Promise<void> {
    const buffer = await this.workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get the underlying worksheet for advanced customization
   */
  getWorksheet(): ExcelJS.Worksheet {
    return this.worksheet;
  }

  /**
   * Get current row number
   */
  getCurrentRow(): number {
    return this.currentRow;
  }

  /**
   * Helper to merge cells across all columns
   */
  private mergeCellsAcross(): void {
    const lastCol = String.fromCharCode(64 + this.columnCount);
    this.worksheet.mergeCells(`A${this.currentRow}:${lastCol}${this.currentRow}`);
  }

  /**
   * Helper to get column letter from number
   */
  static getColumnLetter(colNum: number): string {
    let letter = '';
    while (colNum > 0) {
      const remainder = (colNum - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      colNum = Math.floor((colNum - 1) / 26);
    }
    return letter;
  }
}

// Re-export for convenience
export default ExcelReportBuilder;
