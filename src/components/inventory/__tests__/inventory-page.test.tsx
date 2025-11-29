import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '../inventory-page';

// Mock Firebase Firestore
const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockGetCountFromServer = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
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

// Mock export utils
jest.mock('@/lib/export-utils', () => ({
  exportInventoryToExcel: jest.fn(),
}));

// Sample inventory data
const mockInventoryItems = [
  {
    id: 'item-1',
    itemName: 'حديد مسلح',
    category: 'مواد بناء',
    quantity: 100,
    unit: 'طن',
    unitPrice: 500,
    minStock: 10,
    location: 'مستودع أ',
    notes: 'حديد عالي الجودة',
    createdAt: { toDate: () => new Date('2024-01-15') },
  },
  {
    id: 'item-2',
    itemName: 'اسمنت',
    category: 'مواد بناء',
    quantity: 50,
    unit: 'طن',
    unitPrice: 300,
    minStock: 20,
    location: 'مستودع ب',
    notes: 'اسمنت بورتلاندي',
    createdAt: { toDate: () => new Date('2024-01-10') },
  },
];

// Helper function to render and wait for async effects
const renderInventoryPage = async () => {
  const result = render(<InventoryPage />);
  // Wait for async state updates to complete
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
};

describe('InventoryPage', () => {
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeMock = jest.fn();

    // Setup onSnapshot to return mock data synchronously
    mockOnSnapshot.mockImplementation((query, callback) => {
      // Use setTimeout to ensure this runs after component mount
      setTimeout(() => {
        callback({
          forEach: (fn: (doc: { id: string; data: () => typeof mockInventoryItems[0] }) => void) => {
            mockInventoryItems.forEach((item) => {
              fn({
                id: item.id,
                data: () => item,
              });
            });
          },
        });
      }, 0);
      return unsubscribeMock;
    });

    mockCollection.mockReturnValue('inventory-collection');
    mockQuery.mockReturnValue('inventory-query');
    mockDoc.mockReturnValue('doc-ref');
    // Return immediately resolved promise
    mockGetCountFromServer.mockImplementation(() =>
      Promise.resolve({ data: () => ({ count: 2 }) })
    );
  });

  describe('Rendering', () => {
    it('renders page title', async () => {
      await renderInventoryPage();
      expect(screen.getByText('المخزون')).toBeInTheDocument();
    });

    it('renders add item button', async () => {
      await renderInventoryPage();
      expect(screen.getByRole('button', { name: /إضافة عنصر للمخزون/ })).toBeInTheDocument();
    });

    it('renders inventory table when there are items', async () => {
      await renderInventoryPage();
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });
  });

  describe('Displaying Inventory', () => {
    it('displays item names', async () => {
      await renderInventoryPage();
      await waitFor(() => {
        expect(screen.getByText('حديد مسلح')).toBeInTheDocument();
        expect(screen.getByText('اسمنت')).toBeInTheDocument();
      });
    });
  });

  describe('Stats Cards', () => {
    it('displays total items card', async () => {
      await renderInventoryPage();
      expect(screen.getByText('إجمالي العناصر')).toBeInTheDocument();
    });

    it('displays low stock card', async () => {
      await renderInventoryPage();
      expect(screen.getByText('عناصر منخفضة المخزون')).toBeInTheDocument();
    });

    it('displays total value card', async () => {
      await renderInventoryPage();
      expect(screen.getByText('القيمة الإجمالية')).toBeInTheDocument();
    });
  });

  describe('Add Item Dialog', () => {
    it('opens dialog when add button clicked', async () => {
      await renderInventoryPage();
      await userEvent.click(screen.getByRole('button', { name: /إضافة عنصر للمخزون/ }));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('subscribes to Firestore on mount', async () => {
      await renderInventoryPage();
      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('unsubscribes from Firestore on unmount', async () => {
      const { unmount } = await renderInventoryPage();
      unmount();
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no items', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          forEach: () => {},
        });
        return unsubscribeMock;
      });

      await renderInventoryPage();
      await waitFor(() => {
        expect(screen.getByText(/لا توجد عناصر في المخزون/)).toBeInTheDocument();
      });
    });
  });
});
