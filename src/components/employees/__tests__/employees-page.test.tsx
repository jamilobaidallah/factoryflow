import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeesPage from '../employees-page';

// Mock Firebase Firestore
const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockGetDocs = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn(() => ({
  delete: mockBatchDelete,
  set: jest.fn(),
  update: jest.fn(),
  commit: mockBatchCommit.mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  writeBatch: () => mockWriteBatch(),
}));

jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/employees',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock useUser
const mockUser = { uid: 'test-user-123', dataOwnerId: 'test-user-123', email: 'test@example.com' };
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

// Sample employee data
const mockEmployees = [
  {
    id: 'emp-1',
    name: 'محمد علي',
    currentSalary: 500,
    overtimeEligible: true,
    hireDate: { toDate: () => new Date('2023-01-15') },
    position: 'مهندس',
    createdAt: { toDate: () => new Date('2023-01-15') },
  },
  {
    id: 'emp-2',
    name: 'أحمد حسن',
    currentSalary: 450,
    overtimeEligible: false,
    hireDate: { toDate: () => new Date('2023-06-01') },
    position: 'فني',
    createdAt: { toDate: () => new Date('2023-06-01') },
  },
];

describe('EmployeesPage', () => {
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeMock = jest.fn();

    // Track which collection is being subscribed to
    let collectionIndex = 0;

    // Setup onSnapshot to return mock data based on collection
    mockOnSnapshot.mockImplementation((query, callback) => {
      const currentIndex = collectionIndex++;

      // First call is employees, second is salary_history, third is payroll
      if (currentIndex === 0) {
        // Employees collection
        callback({
          forEach: (fn: (doc: { id: string; data: () => typeof mockEmployees[0] }) => void) => {
            mockEmployees.forEach((emp) => {
              fn({
                id: emp.id,
                data: () => emp,
              });
            });
          },
        });
      } else {
        // salary_history and payroll collections - return empty
        callback({
          forEach: () => {},
        });
      }
      return unsubscribeMock;
    });

    mockCollection.mockReturnValue('employees-collection');
    mockQuery.mockReturnValue('employees-query');
    mockDoc.mockReturnValue('doc-ref');

    // Mock getDocs to return empty results for related records queries
    mockGetDocs.mockResolvedValue({
      forEach: () => {},
      size: 0,
    });
  });

  describe('Rendering', () => {
    it('renders page title', async () => {
      render(<EmployeesPage />);

      expect(screen.getByText('الموظفين والرواتب')).toBeInTheDocument();
    });

    it('renders add employee button', async () => {
      render(<EmployeesPage />);

      expect(screen.getByRole('button', { name: /إضافة موظف/ })).toBeInTheDocument();
    });

    it('renders employees table', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('renders table headers', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('الاسم')).toBeInTheDocument();
        // Use getAllByText since الراتب appears in multiple places (table header and employee cards)
        expect(screen.getAllByText(/الراتب/).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Displaying Employees', () => {
    it('displays employee names', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        // Names appear in both mobile and desktop views
        expect(screen.getAllByText('محمد علي').length).toBeGreaterThan(0);
        expect(screen.getAllByText('أحمد حسن').length).toBeGreaterThan(0);
      });
    });

    it('displays employee salaries', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        // Salaries appear multiple times - use getAllByText
        expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/450/).length).toBeGreaterThan(0);
      });
    });

    it('displays employee positions', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        // Positions may appear in multiple views
        expect(screen.getAllByText(/مهندس/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/فني/).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tab Navigation', () => {
    it('shows employees tab by default', () => {
      render(<EmployeesPage />);

      expect(screen.getByRole('button', { name: /إضافة موظف/ })).toBeInTheDocument();
    });

    it('has payroll tab button', () => {
      render(<EmployeesPage />);

      // Find the tab button (no emoji prefix in current UI)
      expect(screen.getByRole('tab', { name: /الرواتب الشهرية/ })).toBeInTheDocument();
    });

    it('can switch to payroll tab', async () => {
      render(<EmployeesPage />);

      // Find the tab button using role
      const payrollTab = screen.getByRole('tab', { name: /الرواتب الشهرية/ });
      await userEvent.click(payrollTab);

      await waitFor(() => {
        // Look for the card description that appears in the payroll tab
        expect(screen.getByText(/معالجة ودفع الرواتب/)).toBeInTheDocument();
      });
    });
  });

  describe('Add Employee Dialog', () => {
    it('opens dialog when add button clicked', async () => {
      render(<EmployeesPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة موظف/ }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('shows form fields in dialog', async () => {
      render(<EmployeesPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة موظف/ }));

      await waitFor(() => {
        expect(screen.getByLabelText(/الاسم/)).toBeInTheDocument();
        expect(screen.getByLabelText(/الراتب/)).toBeInTheDocument();
      });
    });

    it('allows entering employee name', async () => {
      render(<EmployeesPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة موظف/ }));

      const nameInput = await screen.findByLabelText(/الاسم/);
      await userEvent.type(nameInput, 'موظف جديد');

      expect(nameInput).toHaveValue('موظف جديد');
    });

    it('allows entering salary', async () => {
      render(<EmployeesPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة موظف/ }));

      const salaryInput = await screen.findByLabelText(/الراتب/);
      await userEvent.clear(salaryInput);
      await userEvent.type(salaryInput, '600');

      expect(salaryInput).toHaveValue(600);
    });
  });

  describe('Form Submission', () => {
    it('calls addDoc when submitting new employee', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-emp-id' });
      render(<EmployeesPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة موظف/ }));

      const nameInput = await screen.findByLabelText(/الاسم/);
      const salaryInput = await screen.findByLabelText(/الراتب/);

      await userEvent.type(nameInput, 'موظف جديد');
      await userEvent.clear(salaryInput);
      await userEvent.type(salaryInput, '600');

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

    it('shows success toast after adding employee', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-emp-id' });
      render(<EmployeesPage />);

      await userEvent.click(screen.getByRole('button', { name: /إضافة موظف/ }));

      const nameInput = await screen.findByLabelText(/الاسم/);
      const salaryInput = await screen.findByLabelText(/الراتب/);

      await userEvent.type(nameInput, 'موظف جديد');
      await userEvent.clear(salaryInput);
      await userEvent.type(salaryInput, '600');

      const dialog = screen.getByRole('dialog');
      const submitButton = dialog.querySelector('button[type="submit"]');
      if (submitButton) {
        await userEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
    });
  });

  describe('Action Buttons', () => {
    it('renders action buttons for each employee', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // First row is header, rest are data rows
        expect(rows.length).toBeGreaterThan(1);
      });
    });

    it('opens edit dialog when edit button is clicked', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getAllByText('محمد علي').length).toBeGreaterThan(0);
      });

      // Find edit buttons using aria-label (there may be multiple due to mobile/desktop views)
      const editButtons = screen.getAllByLabelText('تعديل محمد علي');
      await userEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Employee', () => {
    it('calls batch commit when delete confirmed', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getAllByText('محمد علي').length).toBeGreaterThan(0);
      });

      // Find delete buttons using aria-label (there may be multiple due to mobile/desktop views)
      const deleteButtons = screen.getAllByLabelText('حذف محمد علي');
      await userEvent.click(deleteButtons[0]);

      // Wait for confirmation dialog to appear
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Click the confirm button in the dialog
      const confirmButton = screen.getByRole('button', { name: /تأكيد/ });
      await userEvent.click(confirmButton);

      // The delete now uses batch writes
      await waitFor(() => {
        expect(mockBatchCommit).toHaveBeenCalled();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('subscribes to Firestore on mount', () => {
      render(<EmployeesPage />);

      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('unsubscribes from Firestore on unmount', () => {
      const { unmount } = render(<EmployeesPage />);

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('shows zero employee count when no employees', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        // Return empty data for all collections
        callback({
          forEach: () => {},
        });
        return unsubscribeMock;
      });

      render(<EmployeesPage />);

      await waitFor(() => {
        // Current UI shows "X موظف مسجل" in the header
        expect(screen.getByText(/0 موظف مسجل/)).toBeInTheDocument();
      });
    });

    it('shows empty message when no employees', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        // Return empty data for all collections
        callback({
          forEach: () => {},
        });
        return unsubscribeMock;
      });

      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText(/لا يوجد موظفين/)).toBeInTheDocument();
      });
    });
  });

  describe('Stats Cards', () => {
    it('displays employee count card', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('عدد الموظفين')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('displays total salary card', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('إجمالي الرواتب الشهرية')).toBeInTheDocument();
        expect(screen.getByText(/950/)).toBeInTheDocument();
      });
    });
  });
});
