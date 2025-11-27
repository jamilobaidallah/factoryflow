import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentsPage from '../payments-page';

// Mock Firebase Firestore
const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockGetDocs = jest.fn();
const mockGetCountFromServer = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
  orderBy: jest.fn(),
  limit: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

// Mock useUser
const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
jest.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: mockUser }),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Sample payment data
const mockPayments = [
  {
    id: 'payment-1',
    type: 'income',
    amount: 5000,
    description: 'دفعة من عميل',
    date: { toDate: () => new Date('2024-01-15') },
    category: 'مبيعات',
    clientId: 'client-1',
    clientName: 'أحمد محمد',
    createdAt: { toDate: () => new Date('2024-01-15') },
  },
  {
    id: 'payment-2',
    type: 'expense',
    amount: 2000,
    description: 'مصاريف مكتبية',
    date: { toDate: () => new Date('2024-01-10') },
    category: 'مصاريف',
    createdAt: { toDate: () => new Date('2024-01-10') },
  },
];

describe('PaymentsPage', () => {
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeMock = jest.fn();

    // Setup onSnapshot to return mock data
    mockOnSnapshot.mockImplementation((query, callback) => {
      callback({
        forEach: (fn: (doc: { id: string; data: () => typeof mockPayments[0] }) => void) => {
          mockPayments.forEach((payment) => {
            fn({
              id: payment.id,
              data: () => payment,
            });
          });
        },
      });
      return unsubscribeMock;
    });

    mockCollection.mockReturnValue('payments-collection');
    mockQuery.mockReturnValue('payments-query');
    mockDoc.mockReturnValue('doc-ref');
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: [],
    });
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 2 }) });
  });

  describe('Rendering', () => {
    it('renders page title', () => {
      render(<PaymentsPage />);
      expect(screen.getByText('المدفوعات')).toBeInTheDocument();
    });

    it('renders add payment button', () => {
      render(<PaymentsPage />);
      expect(screen.getByRole('button', { name: /إضافة مدفوعة/ })).toBeInTheDocument();
    });

    it('renders payments table when there are payments', async () => {
      render(<PaymentsPage />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });
  });

  describe('Table Content', () => {
    it('displays table when payments exist', async () => {
      render(<PaymentsPage />);
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });
  });

  describe('Stats Cards', () => {
    it('displays total income card', () => {
      render(<PaymentsPage />);
      expect(screen.getByText('إجمالي المقبوضات')).toBeInTheDocument();
    });

    it('displays total expenses card', () => {
      render(<PaymentsPage />);
      expect(screen.getByText('إجمالي المصروفات')).toBeInTheDocument();
    });
  });

  describe('Add Payment Dialog', () => {
    it('opens dialog when add button clicked', async () => {
      render(<PaymentsPage />);
      await userEvent.click(screen.getByRole('button', { name: /إضافة مدفوعة/ }));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('subscribes to Firestore on mount', () => {
      render(<PaymentsPage />);
      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('unsubscribes from Firestore on unmount', () => {
      const { unmount } = render(<PaymentsPage />);
      unmount();
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no payments', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          forEach: () => {},
        });
        return unsubscribeMock;
      });

      render(<PaymentsPage />);
      await waitFor(() => {
        expect(screen.getByText(/لا توجد مدفوعات مسجلة/)).toBeInTheDocument();
      });
    });
  });
});
