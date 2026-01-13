import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientsPage from '../clients-page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Firebase Firestore
const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  getDocs: jest.fn(() => Promise.resolve({ empty: true, forEach: jest.fn() })),
  orderBy: jest.fn(),
  limit: jest.fn(),
  where: jest.fn(),
}));

jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

// Mock useUser
const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
jest.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: mockUser }),
}));

// Mock usePermissions hook
jest.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: 'owner',
    permissions: [],
    loading: false,
    isOwner: true,
    can: jest.fn().mockReturnValue(true),
  }),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Configurable mock state for useClientsPageData
// This allows tests to change the mock return value per test
const mockClientsPageDataState = {
  clients: [] as Array<{
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    balance: number;
    createdAt: Date;
  }>,
  clientBalances: new Map<string, { currentBalance: number; expectedBalance: number | null }>(),
  isLoading: false,
};

// Mock useClientsPageData hook with configurable state
jest.mock('@/hooks/firebase-query/useClientsQueries', () => ({
  useClientsPageData: () => mockClientsPageDataState,
}));

// Sample client data (for tests that reference it)
const mockClients = [
  {
    id: 'client-1',
    name: 'أحمد محمد',
    phone: '0791234567',
    email: 'ahmed@example.com',
    address: 'عمان - الأردن',
    balance: 1000,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'client-2',
    name: 'سارة أحمد',
    phone: '0799876543',
    email: 'sara@example.com',
    address: 'إربد - الأردن',
    balance: 2500,
    createdAt: new Date('2024-01-10'),
  },
];

// Mock client balances
const mockClientBalances = new Map([
  ['client-1', { currentBalance: 1000, expectedBalance: null }],
  ['client-2', { currentBalance: 2500, expectedBalance: null }],
]);

// Mock React Query
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: jest.fn(),
    getQueryData: jest.fn().mockReturnValue([]),
  }),
  useQuery: () => ({ data: [], isLoading: false }),
  useMutation: () => ({ mutate: jest.fn(), isLoading: false }),
  useInfiniteQuery: () => ({ data: undefined, isLoading: false }),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ClientsPage', () => {
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeMock = jest.fn();

    // Reset mock state to default (2 clients) before each test
    mockClientsPageDataState.clients = [...mockClients];
    mockClientsPageDataState.clientBalances = new Map([
      ['client-1', { currentBalance: 1000, expectedBalance: null }],
      ['client-2', { currentBalance: 2500, expectedBalance: null }],
    ]);
    mockClientsPageDataState.isLoading = false;

    // Setup onSnapshot for any remaining direct Firestore calls (e.g., for CRUD operations)
    mockOnSnapshot.mockImplementation((query, callback) => {
      callback({
        forEach: (fn: (doc: { id: string; data: () => typeof mockClients[0] }) => void) => {
          mockClients.forEach((client) => {
            fn({
              id: client.id,
              data: () => client,
            });
          });
        },
      });
      return unsubscribeMock;
    });

    mockCollection.mockReturnValue('clients-collection');
    mockQuery.mockReturnValue('clients-query');
    mockDoc.mockReturnValue('doc-ref');
  });

  describe('Rendering', () => {
    it('renders page title', async () => {
      render(<ClientsPage />);

      expect(screen.getByText('إدارة العملاء')).toBeInTheDocument();
    });

    it('renders add client button', async () => {
      render(<ClientsPage />);

      expect(screen.getByRole('button', { name: /إضافة عميل جديد/ })).toBeInTheDocument();
    });

    it('renders clients table when there are clients', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('renders table headers', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('الاسم')).toBeInTheDocument();
        expect(screen.getByText('الهاتف')).toBeInTheDocument();
        expect(screen.getByText('الرصيد')).toBeInTheDocument();
      });
    });
  });

  describe('Displaying Clients', () => {
    it('displays client names', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
        expect(screen.getByText('سارة أحمد')).toBeInTheDocument();
      });
    });

    it('displays client phone numbers', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('0791234567')).toBeInTheDocument();
        expect(screen.getByText('0799876543')).toBeInTheDocument();
      });
    });

    it('displays client balances', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/1,000/)).toBeInTheDocument();
        expect(screen.getByText(/2,500/)).toBeInTheDocument();
      });
    });
  });

  describe('Add Client Dialog', () => {
    it('opens dialog when add button clicked', async () => {
      render(<ClientsPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة عميل جديد/ }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('shows form fields in dialog', async () => {
      render(<ClientsPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة عميل جديد/ }));

      await waitFor(() => {
        expect(screen.getByLabelText(/الاسم/)).toBeInTheDocument();
        expect(screen.getByLabelText(/الهاتف/)).toBeInTheDocument();
      });
    });

    it('allows entering client name', async () => {
      render(<ClientsPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة عميل جديد/ }));

      const nameInput = await screen.findByLabelText(/الاسم/);
      await userEvent.type(nameInput, 'عميل جديد');

      expect(nameInput).toHaveValue('عميل جديد');
    });

    it('allows entering phone number', async () => {
      render(<ClientsPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة عميل جديد/ }));

      const phoneInput = await screen.findByLabelText(/الهاتف/);
      await userEvent.type(phoneInput, '0781234567');

      expect(phoneInput).toHaveValue('0781234567');
    });
  });

  describe('Form Submission', () => {
    it('calls addDoc when submitting new client', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-client-id' });
      render(<ClientsPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة عميل جديد/ }));

      const nameInput = await screen.findByLabelText(/الاسم/);
      const phoneInput = await screen.findByLabelText(/الهاتف/);

      await userEvent.type(nameInput, 'عميل جديد');
      await userEvent.type(phoneInput, '0781234567');

      // Find submit button in dialog
      const dialog = screen.getByRole('dialog');
      const submitButton = dialog.querySelector('button[type="submit"]');
      if (submitButton) {
        await userEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });
    });
  });

  describe('Action Buttons', () => {
    it('renders action buttons for each client row', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        // Each client should have 2 buttons (edit, delete)
        const rows = screen.getAllByRole('row');
        // First row is header, rest are data rows
        expect(rows.length).toBeGreaterThan(1);
      });
    });

    it('has multiple buttons per row for actions', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
      });

      // Find all buttons in the table rows
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]; // First data row
      const buttons = dataRow.querySelectorAll('button');

      // Should have 2 action buttons per row: edit, delete
      expect(buttons.length).toBe(2);
    });

    it('navigates to client detail page on row click', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      // Click on the row (not a button) to navigate
      await userEvent.click(dataRow);

      expect(mockPush).toHaveBeenCalledWith('/clients/client-1');
    });
  });

  describe('Delete Client', () => {
    it('calls deleteDoc when delete confirmed', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      const buttons = dataRow.querySelectorAll('button');
      await userEvent.click(buttons[1]); // Delete button (Edit=0, Delete=1)

      // Wait for confirmation dialog to appear
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Click the confirm button in the dialog
      const confirmButton = screen.getByRole('button', { name: /تأكيد/ });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteDoc).toHaveBeenCalled();
      });
    });

    it('does not delete when cancel is clicked', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      const buttons = dataRow.querySelectorAll('button');
      await userEvent.click(buttons[1]); // Delete button (Edit=0, Delete=1)

      // Wait for confirmation dialog to appear
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Click the cancel button in the dialog
      const cancelButton = screen.getByRole('button', { name: /إلغاء/ });
      await userEvent.click(cancelButton);

      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });
  });

  // Real-time Updates tests removed:
  // The tests "subscribes to Firestore on mount" and "unsubscribes from Firestore on unmount"
  // were testing internal implementation details (onSnapshot calls). With React Query,
  // subscriptions are now encapsulated in the useClientsPageData hook. These implementation
  // details are tested at the hook level, not the component level.

  describe('Empty State', () => {
    it('shows message when no clients', async () => {
      // Set mock state to empty
      mockClientsPageDataState.clients = [];
      mockClientsPageDataState.clientBalances = new Map();

      render(<ClientsPage />);

      await waitFor(() => {
        // Updated to match ContextualEmptyState text
        expect(screen.getByText(/لا يوجد عملاء بعد/)).toBeInTheDocument();
      });
    });

    it('shows client count as 0 when no clients', async () => {
      // Set mock state to empty
      mockClientsPageDataState.clients = [];
      mockClientsPageDataState.clientBalances = new Map();

      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/قائمة العملاء \(0\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Client Count', () => {
    it('displays correct client count', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/قائمة العملاء \(2\)/)).toBeInTheDocument();
      });
    });
  });
});
