import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '../header';

// Mock Next.js navigation (required for GlobalSearch component)
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock Firebase auth
const mockSignOut = jest.fn();
jest.mock('firebase/auth', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('@/firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
}));

// Mock Firestore functions (required for useGlobalSearch)
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ forEach: jest.fn() })),
}));

// Mock useUser
const mockUser = { email: 'test@example.com', uid: '123' };
jest.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: mockUser }),
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders title', () => {
      render(<Header />);

      expect(screen.getByText('نظام إدارة المصنع')).toBeInTheDocument();
    });

    it('displays user email on desktop', () => {
      render(<Header />);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('renders logout button on desktop', () => {
      render(<Header />);

      expect(screen.getByRole('button', { name: /تسجيل الخروج/ })).toBeInTheDocument();
    });
  });

  describe('Logout', () => {
    it('calls signOut when logout clicked', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);
      render(<Header />);

      const logoutButton = screen.getByRole('button', { name: /تسجيل الخروج/ });
      await userEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });

    it('shows success toast on logout', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);
      render(<Header />);

      await userEvent.click(screen.getByRole('button', { name: /تسجيل الخروج/ }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'تم تسجيل الخروج',
          })
        );
      });
    });

    it('shows error toast on logout failure', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Logout failed'));
      render(<Header />);

      await userEvent.click(screen.getByRole('button', { name: /تسجيل الخروج/ }));

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

  describe('Styling', () => {
    it('has correct header structure', () => {
      render(<Header />);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-white');
    });
  });
});
