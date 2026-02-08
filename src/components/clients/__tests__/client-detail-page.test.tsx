import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientDetailPage from '../client-detail-page';

// ============================================================================
// MOCKS SETUP
// ============================================================================

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Firebase Firestore
const mockOnSnapshot = jest.fn();
const mockGetDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
}));

jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

// Mock useUser
const mockUser = { uid: 'test-user-123', dataOwnerId: 'test-user-123', email: 'test@example.com' };
jest.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: mockUser }),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock export functions
const mockExportStatementToExcel = jest.fn().mockResolvedValue(undefined);
const mockExportStatementToHTML = jest.fn();

jest.mock('@/lib/export-statement-excel', () => ({
  exportStatementToExcel: (...args: unknown[]) => mockExportStatementToExcel(...args),
}));

jest.mock('@/lib/export-utils', () => ({
  ...jest.requireActual('@/lib/export-utils'),
  exportStatementToHTML: (...args: unknown[]) => mockExportStatementToHTML(...args),
}));

// Mock date-fns format
jest.mock('date-fns', () => ({
  format: (date: Date, _formatStr: string) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockClient = {
  id: 'client-123',
  name: 'أحمد محمد',
  phone: '0791234567',
  email: 'ahmed@example.com',
  address: 'عمان، الأردن',
  balance: 1000,
  createdAt: new Date('2024-01-01'),
};

const mockLedgerEntries = [
  {
    id: 'entry-1',
    transactionId: 'TXN-001',
    date: new Date('2024-01-15'),
    type: 'دخل',
    category: 'مبيعات',
    subCategory: 'مبيعات نقدية',
    amount: 5000,
    description: 'فاتورة مبيعات #1',
    associatedParty: 'أحمد محمد',
    remainingBalance: 5000,
  },
  {
    id: 'entry-2',
    transactionId: 'TXN-002',
    date: new Date('2024-01-20'),
    type: 'مصروف',
    category: 'مشتريات',
    subCategory: 'مواد خام',
    amount: 2000,
    description: 'فاتورة مشتريات #1',
    associatedParty: 'أحمد محمد',
    remainingBalance: 2000,
  },
];

const mockPayments = [
  {
    id: 'payment-1',
    date: new Date('2024-01-25'),
    type: 'قبض',
    amount: 3000,
    description: 'دفعة من العميل',
    paymentMethod: 'نقدي',
    notes: 'نقدي - دفعة #1',
    associatedParty: 'أحمد محمد',
    clientName: 'أحمد محمد',
  },
];

const mockCheques = [
  {
    id: 'cheque-1',
    chequeNumber: 'CHQ-001',
    amount: 2000,
    issueDate: new Date('2024-01-10'),
    dueDate: new Date('2024-02-15'),
    bankName: 'البنك العربي',
    status: 'قيد الانتظار',
    type: 'وارد',
    associatedParty: 'أحمد محمد',
    clientName: 'أحمد محمد',
  },
  {
    id: 'cheque-2',
    chequeNumber: 'CHQ-002',
    amount: 1500,
    issueDate: new Date('2024-01-20'),
    dueDate: new Date('2024-03-01'),
    bankName: 'البنك الأهلي',
    status: 'تم الصرف',
    type: 'وارد',
    associatedParty: 'أحمد محمد',
    clientName: 'أحمد محمد',
  },
];

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Setup Firestore mocks with configurable data
 *
 * Key insight: The component creates 3 onSnapshot listeners (ledger, payments, cheques)
 * that fire simultaneously after client loads. We can't rely on call order.
 * Instead, we track which collection is being subscribed to via mockCollection.
 */
function setupFirestoreMocks(options: {
  clientExists?: boolean;
  client?: typeof mockClient;
  ledgerEntries?: typeof mockLedgerEntries;
  payments?: typeof mockPayments;
  cheques?: typeof mockCheques;
} = {}) {
  const {
    clientExists = true,
    client = mockClient,
    ledgerEntries = mockLedgerEntries,
    payments = mockPayments,
    cheques = mockCheques,
  } = options;

  // Mock getDoc for client data
  mockGetDoc.mockImplementation(() => {
    if (clientExists) {
      return Promise.resolve({
        exists: () => true,
        id: client.id,
        data: () => ({
          ...client,
          createdAt: { toDate: () => client.createdAt },
        }),
      });
    } else {
      return Promise.resolve({
        exists: () => false,
      });
    }
  });

  // Track unsubscribe functions
  const unsubscribeFns: jest.Mock[] = [];

  // Track which collection path was last requested
  // This is the key to determining which data to return from onSnapshot
  let lastCollectionPath = '';

  // Mock collection to track the path being queried
  mockCollection.mockImplementation((_firestore, path: string) => {
    lastCollectionPath = path;
    return `collection-ref-${path}`;
  });

  // Mock onSnapshot - determine data based on collection path
  mockOnSnapshot.mockImplementation((_query, callback, _errorCallback) => {
    const unsubscribe = jest.fn();
    unsubscribeFns.push(unsubscribe);

    // Capture the collection path at the time onSnapshot is called
    const collectionPath = lastCollectionPath;

    // Use setTimeout to simulate async Firestore behavior
    setTimeout(() => {
      if (collectionPath.endsWith('/ledger')) {
        // Return ledger entries
        callback({
          forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
            ledgerEntries.forEach((entry) => {
              fn({
                id: entry.id,
                data: () => ({
                  ...entry,
                  date: { toDate: () => entry.date },
                }),
              });
            });
          },
        });
      } else if (collectionPath.endsWith('/payments')) {
        // Return payments
        callback({
          forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
            payments.forEach((payment) => {
              fn({
                id: payment.id,
                data: () => ({
                  ...payment,
                  date: { toDate: () => payment.date },
                }),
              });
            });
          },
        });
      } else if (collectionPath.endsWith('/cheques')) {
        // Return cheques
        callback({
          forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
            cheques.forEach((cheque) => {
              fn({
                id: cheque.id,
                data: () => ({
                  ...cheque,
                  issueDate: { toDate: () => cheque.issueDate },
                  dueDate: { toDate: () => cheque.dueDate },
                }),
              });
            });
          },
        });
      }
    }, 0);

    return unsubscribe;
  });

  mockDoc.mockReturnValue('doc-ref');
  mockQuery.mockReturnValue('query-ref');
  mockWhere.mockReturnValue('where-ref');

  return { unsubscribeFns };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ClientDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // RENDERING TESTS
  // ==========================================================================

  describe('Rendering', () => {
    it('should display loading state initially', () => {
      // Don't resolve getDoc immediately
      mockGetDoc.mockImplementation(() => new Promise(() => {}));

      render(<ClientDetailPage clientId="client-123" />);

      expect(screen.getByText('جاري التحميل...')).toBeInTheDocument();
    });

    it('should render client name after loading', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
      });
    });

    it('should display client phone number', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        // Phone number appears in header and info card, so use getAllByText
        expect(screen.getAllByText('0791234567').length).toBeGreaterThan(0);
      });
    });

    it('should display financial overview cards', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByText('إجمالي المبيعات')).toBeInTheDocument();
        expect(screen.getByText('إجمالي المشتريات')).toBeInTheDocument();
      });
    });

    it('should display client info card', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByText('معلومات العميل')).toBeInTheDocument();
        expect(screen.getByText('ahmed@example.com')).toBeInTheDocument();
        expect(screen.getByText('عمان، الأردن')).toBeInTheDocument();
      });
    });

    it('should display back button', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Arrow icon button
      });
    });
  });

  // ==========================================================================
  // TABS NAVIGATION TESTS
  // ==========================================================================

  describe('Tabs Navigation', () => {
    it('should render all 4 tab triggers', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'المعاملات المالية' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'الدفعات' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'الشيكات' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });
    });

    it('should show transactions tab content by default', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        // The transactions tab content should be visible
        const transactionsTab = screen.getByRole('tab', { name: 'المعاملات المالية' });
        expect(transactionsTab).toHaveAttribute('data-state', 'active');
      });
    });

    it('should switch to payments tab when clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'الدفعات' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'الدفعات' }));

      expect(screen.getByRole('tab', { name: 'الدفعات' })).toHaveAttribute('data-state', 'active');
    });

    it('should switch to cheques tab when clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'الشيكات' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'الشيكات' }));

      expect(screen.getByRole('tab', { name: 'الشيكات' })).toHaveAttribute('data-state', 'active');
    });

    it('should switch to statement tab when clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toHaveAttribute('data-state', 'active');
    });
  });

  // ==========================================================================
  // TRANSACTIONS TAB TESTS
  // ==========================================================================

  describe('Transactions Tab', () => {
    it('should display ledger entries', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByText('فاتورة مبيعات #1')).toBeInTheDocument();
        expect(screen.getByText('فاتورة مشتريات #1')).toBeInTheDocument();
      });
    });

    it('should display transaction amounts', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      // Wait for ledger entries to load and display in the transactions table
      // The amounts are formatted using .toFixed(2) and may be split across text nodes
      await waitFor(() => {
        // Look for the amount text that appears in table cells
        // Use a function matcher to handle text split across nodes
        expect(screen.getByText((_content, element) => {
          return element?.tagName === 'TD' &&
                 element?.textContent?.includes('5000.00') === true;
        })).toBeInTheDocument();
      });

      // Verify the second amount is also present
      expect(screen.getByText((_content, element) => {
        return element?.tagName === 'TD' &&
               element?.textContent?.includes('2000.00') === true;
      })).toBeInTheDocument();
    });

    it('should show empty state when no transactions', async () => {
      setupFirestoreMocks({ ledgerEntries: [] });

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByText('لا توجد معاملات مالية')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // PAYMENTS TAB TESTS
  // ==========================================================================

  describe('Payments Tab', () => {
    it('should display payments when tab is clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'الدفعات' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'الدفعات' }));

      await waitFor(() => {
        expect(screen.getByText('دفعة من العميل')).toBeInTheDocument();
      });
    });

    it('should show empty state when no payments', async () => {
      setupFirestoreMocks({ payments: [] });
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'الدفعات' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'الدفعات' }));

      await waitFor(() => {
        expect(screen.getByText('لا توجد دفعات')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // CHEQUES TAB TESTS
  // ==========================================================================

  describe('Cheques Tab', () => {
    it('should display cheques when tab is clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'الشيكات' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'الشيكات' }));

      await waitFor(() => {
        expect(screen.getByText('CHQ-001')).toBeInTheDocument();
        expect(screen.getByText('CHQ-002')).toBeInTheDocument();
      });
    });

    it('should display cheque bank names', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'الشيكات' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'الشيكات' }));

      await waitFor(() => {
        expect(screen.getByText('البنك العربي')).toBeInTheDocument();
        expect(screen.getByText('البنك الأهلي')).toBeInTheDocument();
      });
    });

    it('should show empty state when no cheques', async () => {
      setupFirestoreMocks({ cheques: [] });
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'الشيكات' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'الشيكات' }));

      await waitFor(() => {
        expect(screen.getByText('لا توجد شيكات')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // STATEMENT TAB TESTS
  // ==========================================================================

  describe('Statement Tab', () => {
    it('should display statement header with client name', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      await waitFor(() => {
        expect(screen.getByText('كشف حساب')).toBeInTheDocument();
      });
    });

    it('should display date filter inputs', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      await waitFor(() => {
        expect(screen.getByText('تصفية حسب التاريخ:')).toBeInTheDocument();
        expect(screen.getByText('من')).toBeInTheDocument();
        expect(screen.getByText('إلى')).toBeInTheDocument();
      });
    });

    it('should display opening balance row', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      await waitFor(() => {
        expect(screen.getByText('رصيد افتتاحي')).toBeInTheDocument();
      });
    });

    it('should display pending cheques section when pending cheques exist', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      await waitFor(() => {
        expect(screen.getByText('شيكات قيد الانتظار')).toBeInTheDocument();
        expect(screen.getByText('الرصيد المتوقع بعد صرف الشيكات:')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // EXPORT FUNCTIONALITY TESTS
  // ==========================================================================

  describe('Export Functionality', () => {
    it('should display Excel export button', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Excel/ })).toBeInTheDocument();
      });
    });

    it('should display PDF export button', async () => {
      setupFirestoreMocks();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /PDF/ })).toBeInTheDocument();
      });
    });

    it('should trigger Excel export when button clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Excel/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Excel/ }));

      await waitFor(() => {
        expect(mockExportStatementToExcel).toHaveBeenCalled();
      });
    });

    it('should trigger PDF export when button clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /PDF/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /PDF/ }));

      await waitFor(() => {
        expect(mockExportStatementToHTML).toHaveBeenCalled();
      });
    });

    it('should show success toast after export', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Excel/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Excel/ }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'تم التصدير',
          })
        );
      });
    });

    it('should show error toast when export fails', async () => {
      setupFirestoreMocks();
      mockExportStatementToExcel.mockRejectedValueOnce(new Error('Export failed'));
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Excel/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Excel/ }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'خطأ',
            variant: 'destructive',
          })
        );
      });
    });
  });

  // ==========================================================================
  // TRANSACTION DETAIL MODAL TESTS
  // ==========================================================================

  describe('Transaction Detail Modal', () => {
    it('should open modal when statement row is clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      // Switch to statement tab
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      // Wait for transactions to load and find a clickable row
      await waitFor(() => {
        // Look for the transaction description in the statement
        const rows = screen.getAllByRole('row');
        // Filter for clickable data rows (not header/opening balance)
        const dataRows = rows.filter(row => row.classList.contains('cursor-pointer'));
        expect(dataRows.length).toBeGreaterThan(0);
      });

      // Click on a transaction row
      const rows = screen.getAllByRole('row');
      const clickableRow = rows.find(row => row.classList.contains('cursor-pointer'));
      if (clickableRow) {
        await user.click(clickableRow);
      }

      // Check if modal opened
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('تفاصيل المعاملة')).toBeInTheDocument();
      });
    });

    it('should display transaction details in modal', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      // Switch to statement tab
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      // Wait for transactions to load
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const clickableRows = rows.filter(row => row.classList.contains('cursor-pointer'));
        expect(clickableRows.length).toBeGreaterThan(0);
      });

      // Click on a transaction row
      const rows = screen.getAllByRole('row');
      const clickableRow = rows.find(row => row.classList.contains('cursor-pointer'));
      if (clickableRow) {
        await user.click(clickableRow);
      }

      // Check modal content
      await waitFor(() => {
        expect(screen.getByText(':التاريخ')).toBeInTheDocument();
        expect(screen.getByText(':الوصف')).toBeInTheDocument();
        expect(screen.getByText(':المبلغ')).toBeInTheDocument();
      });
    });

    it('should close modal on dismiss', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      // Switch to statement tab
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'كشف الحساب' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: 'كشف الحساب' }));

      // Wait and click on a transaction row
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const clickableRows = rows.filter(row => row.classList.contains('cursor-pointer'));
        expect(clickableRows.length).toBeGreaterThan(0);
      });

      const rows = screen.getAllByRole('row');
      const clickableRow = rows.find(row => row.classList.contains('cursor-pointer'));
      if (clickableRow) {
        await user.click(clickableRow);
      }

      // Verify modal is open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close the modal using Escape key
      await user.keyboard('{Escape}');

      // Verify modal is closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // ERROR STATES TESTS
  // ==========================================================================

  describe('Error States', () => {
    it('should redirect to clients list if client not found', async () => {
      setupFirestoreMocks({ clientExists: false });

      render(<ClientDetailPage clientId="non-existent-client" />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'خطأ',
            description: 'العميل غير موجود',
            variant: 'destructive',
          })
        );
        expect(mockPush).toHaveBeenCalledWith('/clients');
      });
    });

    it('should show error toast on load failure', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Load failed'));

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'خطأ',
            description: 'حدث خطأ أثناء تحميل بيانات العميل',
            variant: 'destructive',
          })
        );
      });
    });
  });

  // ==========================================================================
  // NAVIGATION TESTS
  // ==========================================================================

  describe('Navigation', () => {
    it('should navigate back to clients list when back button clicked', async () => {
      setupFirestoreMocks();
      const user = userEvent.setup();

      render(<ClientDetailPage clientId="client-123" />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
      });

      // Find the back button - it's the first button in the header area
      const headerDiv = screen.getByText('أحمد محمد').closest('div')?.parentElement;
      if (headerDiv) {
        const firstButton = within(headerDiv).getAllByRole('button')[0];
        await user.click(firstButton);
        expect(mockPush).toHaveBeenCalledWith('/clients');
      }
    });
  });
});
