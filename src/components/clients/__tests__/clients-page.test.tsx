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
  orderBy: jest.fn(),
  limit: jest.fn(),
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

// Sample client data
const mockClients = [
  {
    id: 'client-1',
    name: 'أحمد محمد',
    phone: '0791234567',
    email: 'ahmed@example.com',
    address: 'عمان - الأردن',
    balance: 1000,
    createdAt: { toDate: () => new Date('2024-01-15') },
  },
  {
    id: 'client-2',
    name: 'سارة أحمد',
    phone: '0799876543',
    email: 'sara@example.com',
    address: 'إربد - الأردن',
    balance: 2500,
    createdAt: { toDate: () => new Date('2024-01-10') },
  },
];

describe('ClientsPage', () => {
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeMock = jest.fn();

    // Setup onSnapshot to return mock data
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
        // Each client should have 3 buttons (view, edit, delete)
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

      // Should have 3 action buttons per row: view, edit, delete
      expect(buttons.length).toBe(3);
    });

    it('navigates to client detail page on view button click', async () => {
      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText('أحمد محمد')).toBeInTheDocument();
      });

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      const buttons = dataRow.querySelectorAll('button');
      await userEvent.click(buttons[0]); // View button

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
      await userEvent.click(buttons[2]); // Delete button

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
      await userEvent.click(buttons[2]); // Delete button

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

  describe('Real-time Updates', () => {
    it('subscribes to Firestore on mount', () => {
      render(<ClientsPage />);

      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('unsubscribes from Firestore on unmount', () => {
      const { unmount } = render(<ClientsPage />);

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('shows message when no clients', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          forEach: () => {},
        });
        return unsubscribeMock;
      });

      render(<ClientsPage />);

      await waitFor(() => {
        expect(screen.getByText(/لا يوجد عملاء حالياً/)).toBeInTheDocument();
      });
    });

    it('shows client count as 0 when no clients', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          forEach: () => {},
        });
        return unsubscribeMock;
      });

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
