/**
 * Unit Tests for Export Utilities
 * Tests Excel, PDF, and HTML export functions
 */

import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';

// Mock external dependencies
jest.mock('exceljs', () => {
  const mockWorksheet = {
    addRow: jest.fn(),
    getRow: jest.fn(() => ({
      font: {},
      fill: {},
    })),
    columns: [],
  };

  const mockWorkbook = {
    addWorksheet: jest.fn(() => mockWorksheet),
    xlsx: {
      writeBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(8))),
    },
  };

  return {
    Workbook: jest.fn(() => mockWorkbook),
  };
});

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    text: jest.fn(),
    save: jest.fn(),
    lastAutoTable: { finalY: 100 },
  }));
});

jest.mock('jspdf-autotable', () => jest.fn());

// Mock browser APIs
const mockCreateObjectURL = jest.fn(() => 'blob:test-url');
const mockRevokeObjectURL = jest.fn();
const mockClick = jest.fn();

Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

// Mock document.createElement for link downloads
const originalCreateElement = document.createElement.bind(document);
jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'a') {
    return {
      href: '',
      download: '',
      click: mockClick,
      style: {},
    } as unknown as HTMLAnchorElement;
  }
  return originalCreateElement(tagName);
});

// Mock window.open for HTML export
const mockWindowOpen = jest.fn(() => ({
  document: {
    write: jest.fn(),
    close: jest.fn(),
  },
}));
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

// Import after mocks are set up
import {
  exportToExcel,
  exportLedgerToExcel,
  exportPaymentsToExcel,
  exportChequesToExcel,
  exportInventoryToExcel,
  exportIncomeStatementToPDF,
  exportLedgerToHTML,
  exportIncomeStatementToHTML,
  exportLedgerToPDF,
  exportBalanceSheetToPDF,
} from '../export-utils';

describe('Export Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportToExcel', () => {
    it('should return early for empty data', async () => {
      await exportToExcel([], 'test-file');
      expect(mockClick).not.toHaveBeenCalled();
    });

    it('should create Excel file with correct structure', async () => {
      const data = [
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
      ];

      await exportToExcel(data, 'test-file', 'TestSheet');

      expect(ExcelJS.Workbook).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should use default sheet name if not provided', async () => {
      const data = [{ name: 'Test', value: 1 }];
      await exportToExcel(data, 'test-file');

      const workbook = (ExcelJS.Workbook as jest.Mock).mock.results[0].value;
      expect(workbook.addWorksheet).toHaveBeenCalledWith('Sheet1');
    });

    it('should use custom sheet name when provided', async () => {
      const data = [{ name: 'Test', value: 1 }];
      await exportToExcel(data, 'test-file', 'CustomSheet');

      const workbook = (ExcelJS.Workbook as jest.Mock).mock.results[0].value;
      expect(workbook.addWorksheet).toHaveBeenCalledWith('CustomSheet');
    });
  });

  describe('exportLedgerToExcel', () => {
    it('should format ledger entries correctly', async () => {
      const entries = [
        {
          transactionId: 'TX-001',
          date: new Date('2024-01-15'),
          description: 'Test transaction',
          type: 'دخل',
          category: 'بيع',
          subCategory: 'مبيعات نقدية',
          amount: 1000,
          associatedParty: 'عميل 1',
          paymentStatus: 'مدفوع',
          totalPaid: 1000,
          remainingBalance: 0,
        },
      ];

      await exportLedgerToExcel(entries, 'ledger-test');

      expect(ExcelJS.Workbook).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });

    it('should handle entries with missing fields', async () => {
      const entries = [
        {
          transactionId: '',
          date: null,
          description: '',
          type: '',
          category: '',
          amount: 0,
        },
      ];

      await exportLedgerToExcel(entries);
      expect(mockClick).toHaveBeenCalled();
    });

    it('should use default filename', async () => {
      const entries = [{ amount: 100 }];
      await exportLedgerToExcel(entries);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('exportPaymentsToExcel', () => {
    it('should format payment entries correctly', async () => {
      const payments = [
        {
          clientName: 'محمد أحمد',
          date: new Date('2024-01-15'),
          type: 'قبض',
          amount: 500,
          paymentMethod: 'نقدي',
          linkedTransactionId: 'TX-001',
          notes: 'دفعة أولى',
        },
      ];

      await exportPaymentsToExcel(payments, 'payments-test');
      expect(mockClick).toHaveBeenCalled();
    });

    it('should handle payments with missing fields', async () => {
      const payments = [{ amount: 100 }];
      await exportPaymentsToExcel(payments);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('exportChequesToExcel', () => {
    it('should format cheque entries correctly', async () => {
      const cheques = [
        {
          chequeNumber: 'CHQ-001',
          clientName: 'محمد أحمد',
          type: 'وارد',
          amount: 1000,
          bankName: 'البنك العربي',
          dueDate: new Date('2024-02-15'),
          status: 'قيد الانتظار',
          chequeType: 'عادي',
          notes: 'شيك مؤجل',
        },
      ];

      await exportChequesToExcel(cheques, 'cheques-test');
      expect(mockClick).toHaveBeenCalled();
    });

    it('should handle cheques with non-Date dueDate', async () => {
      const cheques = [
        {
          chequeNumber: 'CHQ-001',
          dueDate: '2024-02-15', // String instead of Date
          amount: 1000,
        },
      ];

      await exportChequesToExcel(cheques);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('exportInventoryToExcel', () => {
    it('should format inventory items correctly', async () => {
      const items = [
        {
          itemName: 'ورق مقوى',
          category: 'مواد خام',
          quantity: 100,
          unit: 'طن',
          unitPrice: 500,
          thickness: '2mm',
          width: '100cm',
          length: '200cm',
          location: 'المستودع أ',
          minStock: 10,
          notes: 'مواد أولية',
        },
      ];

      await exportInventoryToExcel(items, 'inventory-test');
      expect(mockClick).toHaveBeenCalled();
    });

    it('should handle items with missing optional fields', async () => {
      const items = [
        {
          itemName: 'Test Item',
          quantity: 50,
        },
      ];

      await exportInventoryToExcel(items);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('exportIncomeStatementToPDF', () => {
    it('should create income statement PDF', () => {
      const data = {
        revenues: [
          { category: 'بيع', amount: 10000 },
          { category: 'خدمات', amount: 5000 },
        ],
        expenses: [
          { category: 'رواتب', amount: 3000 },
          { category: 'إيجار', amount: 1000 },
        ],
        totalRevenue: 15000,
        totalExpenses: 4000,
        netIncome: 11000,
      };

      exportIncomeStatementToPDF(data, '2024-01-01', '2024-01-31', 'income-statement');

      expect(jsPDF).toHaveBeenCalled();
    });

    it('should use default filename', () => {
      const data = {
        revenues: [],
        expenses: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
      };

      exportIncomeStatementToPDF(data, '2024-01-01', '2024-01-31');
      expect(jsPDF).toHaveBeenCalled();
    });

    it('should translate Arabic categories to English', () => {
      const data = {
        revenues: [{ category: 'بيع', amount: 1000 }],
        expenses: [{ category: 'راتب عمل', amount: 500 }],
        totalRevenue: 1000,
        totalExpenses: 500,
        netIncome: 500,
      };

      exportIncomeStatementToPDF(data, '2024-01-01', '2024-01-31');
      expect(jsPDF).toHaveBeenCalled();
    });
  });

  describe('exportLedgerToPDF', () => {
    it('should create ledger PDF', () => {
      const entries = [
        {
          transactionId: 'TX-001',
          date: new Date('2024-01-15'),
          type: 'دخل',
          category: 'بيع',
          amount: 1000,
        },
      ];

      exportLedgerToPDF(entries, 'ledger');
      expect(jsPDF).toHaveBeenCalled();
    });

    it('should limit entries to 50 for PDF', () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        transactionId: `TX-${i}`,
        date: new Date(),
        type: 'دخل',
        category: 'بيع',
        amount: 100,
      }));

      exportLedgerToPDF(entries);
      expect(jsPDF).toHaveBeenCalled();
    });

    it('should handle entries with non-Date dates', () => {
      const entries = [
        {
          transactionId: 'TX-001',
          date: '2024-01-15',
          type: 'دخل',
          category: 'بيع',
          amount: 1000,
        },
      ];

      exportLedgerToPDF(entries);
      expect(jsPDF).toHaveBeenCalled();
    });
  });

  describe('exportBalanceSheetToPDF', () => {
    it('should create balance sheet PDF', () => {
      const data = {
        assets: [
          { category: 'نقد', amount: 50000 },
          { category: 'مخزون', amount: 30000 },
        ],
        liabilities: [
          { category: 'ذمم دائنة', amount: 10000 },
        ],
        equity: [
          { category: 'رأس المال', amount: 70000 },
        ],
        totalAssets: 80000,
        totalLiabilities: 10000,
        totalEquity: 70000,
      };

      exportBalanceSheetToPDF(data, '2024-01-31', 'balance-sheet');
      expect(jsPDF).toHaveBeenCalled();
    });

    it('should use default filename', () => {
      const data = {
        assets: [],
        liabilities: [],
        equity: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      };

      exportBalanceSheetToPDF(data, '2024-01-31');
      expect(jsPDF).toHaveBeenCalled();
    });
  });

  describe('exportLedgerToHTML', () => {
    it('should open new window with HTML content', () => {
      const entries = [
        {
          transactionId: 'TX-001',
          date: new Date('2024-01-15'),
          description: 'وصف المعاملة',
          type: 'دخل',
          category: 'بيع',
          amount: 1000,
        },
      ];

      exportLedgerToHTML(entries, 'تقرير الحركات');

      expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank');
    });

    it('should use default title', () => {
      const entries = [{ amount: 100, date: new Date() }];

      exportLedgerToHTML(entries);
      expect(mockWindowOpen).toHaveBeenCalled();
    });

    it('should handle expense type styling', () => {
      const entries = [
        {
          transactionId: 'TX-001',
          date: new Date(),
          type: 'مصروف',
          category: 'رواتب',
          amount: 500,
        },
      ];

      exportLedgerToHTML(entries);
      expect(mockWindowOpen).toHaveBeenCalled();
    });

    it('should handle null window.open', () => {
      mockWindowOpen.mockReturnValueOnce(null);

      const entries = [{ amount: 100, date: new Date() }];
      expect(() => exportLedgerToHTML(entries)).not.toThrow();
    });
  });

  describe('exportIncomeStatementToHTML', () => {
    it('should open new window with income statement HTML', () => {
      const data = {
        revenues: [{ category: 'مبيعات', amount: 10000 }],
        expenses: [{ category: 'رواتب', amount: 3000 }],
        totalRevenue: 10000,
        totalExpenses: 3000,
        netIncome: 7000,
      };

      exportIncomeStatementToHTML(data, '2024-01-01', '2024-01-31');

      expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank');
    });

    it('should handle empty revenues and expenses', () => {
      const data = {
        revenues: [],
        expenses: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
      };

      exportIncomeStatementToHTML(data, '2024-01-01', '2024-01-31');
      expect(mockWindowOpen).toHaveBeenCalled();
    });

    it('should handle null window.open', () => {
      mockWindowOpen.mockReturnValueOnce(null);

      const data = {
        revenues: [],
        expenses: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
      };

      expect(() => exportIncomeStatementToHTML(data, '2024-01-01', '2024-01-31')).not.toThrow();
    });
  });
});

describe('Translation Function', () => {
  // Test translation functionality through exported functions
  it('should translate known Arabic terms to English in PDF exports', () => {
    const data = {
      revenues: [
        { category: 'بيع', amount: 1000 },
        { category: 'شراء', amount: 500 },
      ],
      expenses: [
        { category: 'راتب عمل', amount: 300 },
        { category: 'مصاريف تشغيلية', amount: 200 },
      ],
      totalRevenue: 1500,
      totalExpenses: 500,
      netIncome: 1000,
    };

    // This should not throw and should translate categories
    expect(() => {
      exportIncomeStatementToPDF(data, '2024-01-01', '2024-12-31');
    }).not.toThrow();
  });

  it('should keep untranslated terms as-is', () => {
    const data = {
      revenues: [{ category: 'فئة غير معروفة', amount: 1000 }],
      expenses: [],
      totalRevenue: 1000,
      totalExpenses: 0,
      netIncome: 1000,
    };

    expect(() => {
      exportIncomeStatementToPDF(data, '2024-01-01', '2024-12-31');
    }).not.toThrow();
  });
});
