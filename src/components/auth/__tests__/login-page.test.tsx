import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../login-page';

// Mock Firebase auth
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
}));

jest.mock('@/firebase/config', () => ({
  auth: { currentUser: null },
}));

// Mock useToast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders login form by default', () => {
      render(<LoginPage />);

      expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
      expect(screen.getByLabelText('البريد الإلكتروني')).toBeInTheDocument();
      expect(screen.getByLabelText('كلمة المرور')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    });

    it('renders FactoryFlow branding', () => {
      render(<LoginPage />);

      expect(screen.getByText(/FactoryFlow/)).toBeInTheDocument();
      expect(screen.getByText('نظام إدارة المصنع - FactoryFlow')).toBeInTheDocument();
    });

    it('renders toggle link to create account', () => {
      render(<LoginPage />);

      expect(screen.getByText(/ليس لديك حساب/)).toBeInTheDocument();
    });
  });

  describe('Mode Toggle', () => {
    it('switches to signup mode when toggle clicked', async () => {
      render(<LoginPage />);

      const toggleButton = screen.getByText(/ليس لديك حساب/);
      await userEvent.click(toggleButton);

      expect(screen.getByText('إنشاء حساب جديد')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'إنشاء حساب' })).toBeInTheDocument();
      expect(screen.getByText(/لديك حساب/)).toBeInTheDocument();
    });

    it('switches back to login mode', async () => {
      render(<LoginPage />);

      // Switch to signup
      await userEvent.click(screen.getByText(/ليس لديك حساب/));
      expect(screen.getByText('إنشاء حساب جديد')).toBeInTheDocument();

      // Switch back to login
      await userEvent.click(screen.getByText(/لديك حساب/));
      expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    });
  });

  describe('Form Inputs', () => {
    it('allows entering email', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('البريد الإلكتروني');
      await userEvent.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('allows entering password', async () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('كلمة المرور');
      await userEvent.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    it('has required email field', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('البريد الإلكتروني');
      expect(emailInput).toBeRequired();
    });

    it('has required password field', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('كلمة المرور');
      expect(passwordInput).toBeRequired();
    });

    it('password has minimum length of 6', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('كلمة المرور');
      expect(passwordInput).toHaveAttribute('minLength', '6');
    });
  });

  describe('Login Submission', () => {
    it('calls signInWithEmailAndPassword on login submit', async () => {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('البريد الإلكتروني');
      const passwordInput = screen.getByLabelText('كلمة المرور');
      const submitButton = screen.getByRole('button', { name: 'تسجيل الدخول' });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          'password123'
        );
      });
    });

    it('shows success toast on successful login', async () => {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'test@example.com');
      await userEvent.type(screen.getByLabelText('كلمة المرور'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'تم تسجيل الدخول بنجاح',
          })
        );
      });
    });

    it('shows error toast on login failure', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(new Error('Invalid credentials'));
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'test@example.com');
      await userEvent.type(screen.getByLabelText('كلمة المرور'), 'wrongpassword');
      await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'خطأ',
            variant: 'destructive',
          })
        );
      });
    });

    it('shows loading state during submission', async () => {
      let resolvePromise: (value: unknown) => void;
      mockSignInWithEmailAndPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'test@example.com');
      await userEvent.type(screen.getByLabelText('كلمة المرور'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));

      expect(screen.getByText('جاري التحميل...')).toBeInTheDocument();

      // Resolve to clean up
      resolvePromise!({ user: { uid: '123' } });
    });

    it('disables inputs during loading', async () => {
      let resolvePromise: (value: unknown) => void;
      mockSignInWithEmailAndPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );
      render(<LoginPage />);

      await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'test@example.com');
      await userEvent.type(screen.getByLabelText('كلمة المرور'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));

      expect(screen.getByLabelText('البريد الإلكتروني')).toBeDisabled();
      expect(screen.getByLabelText('كلمة المرور')).toBeDisabled();

      resolvePromise!({ user: { uid: '123' } });
    });
  });

  describe('Signup Submission', () => {
    it('calls createUserWithEmailAndPassword on signup submit', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });
      render(<LoginPage />);

      // Switch to signup mode
      await userEvent.click(screen.getByText(/ليس لديك حساب/));

      await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'new@example.com');
      await userEvent.type(screen.getByLabelText('كلمة المرور'), 'newpassword');
      await userEvent.click(screen.getByRole('button', { name: 'إنشاء حساب' }));

      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'new@example.com',
          'newpassword'
        );
      });
    });

    it('shows success toast on successful signup', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });
      render(<LoginPage />);

      await userEvent.click(screen.getByText(/ليس لديك حساب/));
      await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'new@example.com');
      await userEvent.type(screen.getByLabelText('كلمة المرور'), 'newpassword');
      await userEvent.click(screen.getByRole('button', { name: 'إنشاء حساب' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'تم إنشاء الحساب بنجاح',
          })
        );
      });
    });

    it('shows error toast on signup failure', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(new Error('Email already exists'));
      render(<LoginPage />);

      await userEvent.click(screen.getByText(/ليس لديك حساب/));
      await userEvent.type(screen.getByLabelText('البريد الإلكتروني'), 'existing@example.com');
      await userEvent.type(screen.getByLabelText('كلمة المرور'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: 'إنشاء حساب' }));

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

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<LoginPage />);

      expect(screen.getByLabelText('البريد الإلكتروني')).toBeInTheDocument();
      expect(screen.getByLabelText('كلمة المرور')).toBeInTheDocument();
    });

    it('email input has correct type', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('البريد الإلكتروني');
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('password input has correct type', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText('كلمة المرور');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});
