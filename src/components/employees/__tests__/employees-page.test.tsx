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
const mockWriteBatch = jest.fn();

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
  writeBatch: () => mockWriteBatch,
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

    // Setup onSnapshot to return mock data
    mockOnSnapshot.mockImplementation((query, callback) => {
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
      return unsubscribeMock;
    });

    mockCollection.mockReturnValue('employees-collection');
    mockQuery.mockReturnValue('employees-query');
    mockDoc.mockReturnValue('doc-ref');
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
        expect(screen.getByText(/الراتب/)).toBeInTheDocument();
      });
    });
  });

  describe('Displaying Employees', () => {
    it('displays employee names', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('محمد علي')).toBeInTheDocument();
        expect(screen.getByText('أحمد حسن')).toBeInTheDocument();
      });
    });

    it('displays employee salaries', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText(/500/)).toBeInTheDocument();
        expect(screen.getByText(/450/)).toBeInTheDocument();
      });
    });

    it('displays employee positions', async () => {
      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('مهندس')).toBeInTheDocument();
        expect(screen.getByText('فني')).toBeInTheDocument();
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

      // Find the tab button specifically (💰 emoji prefix)
      expect(screen.getByText('💰 الرواتب الشهرية')).toBeInTheDocument();
    });

    it('can switch to payroll tab', async () => {
      render(<EmployeesPage />);

      // Find the tab button specifically (💰 emoji prefix)
      const payrollTab = screen.getByText('💰 الرواتب الشهرية');
      await userEvent.click(payrollTab);

      await waitFor(() => {
        expect(screen.getByText(/معالجة الرواتب الشهرية/)).toBeInTheDocument();
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
        expect(screen.getByText('محمد علي')).toBeInTheDocument();
      });

      // Find all buttons and click the edit one
      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]; // First data row
      const buttons = dataRow.querySelectorAll('button');
      // Button 0: history, Button 1: edit, Button 2: delete
      await userEvent.click(buttons[1]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Employee', () => {
    it('calls deleteDoc when delete confirmed', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('محمد علي')).toBeInTheDocument();
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
        callback({
          forEach: () => {},
        });
        return unsubscribeMock;
      });

      render(<EmployeesPage />);

      await waitFor(() => {
        expect(screen.getByText('قائمة الموظفين (0)')).toBeInTheDocument();
      });
    });

    it('shows empty message when no employees', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
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
