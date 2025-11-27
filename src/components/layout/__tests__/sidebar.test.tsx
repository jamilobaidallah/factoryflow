import React from 'react';
import { render, screen } from '@testing-library/react';
import Sidebar from '../sidebar';

// Mock Next.js router
const mockPathname = jest.fn().mockReturnValue('/dashboard');
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/dashboard');
  });

  describe('Branding', () => {
    it('renders FactoryFlow logo and name', () => {
      render(<Sidebar />);

      expect(screen.getByText('FactoryFlow')).toBeInTheDocument();
      expect(screen.getByText('نظام إدارة المصنع')).toBeInTheDocument();
    });
  });

  describe('Navigation Items', () => {
    it('renders dashboard link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /لوحة التحكم/ })).toBeInTheDocument();
    });

    it('renders clients link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /العملاء/ })).toBeInTheDocument();
    });

    it('renders ledger link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /دفتر الأستاذ/ })).toBeInTheDocument();
    });

    it('renders payments link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /المدفوعات/ })).toBeInTheDocument();
    });

    it('renders inventory link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /المخزون/ })).toBeInTheDocument();
    });

    it('renders reports link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /التقارير/ })).toBeInTheDocument();
    });

    it('renders backup link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /النسخ الاحتياطي/ })).toBeInTheDocument();
    });

    it('renders search link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /البحث عن معاملة/ })).toBeInTheDocument();
    });

    it('renders partners link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الشركاء/ })).toBeInTheDocument();
    });

    it('renders incoming cheques link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الشيكات الواردة/ })).toBeInTheDocument();
    });

    it('renders outgoing cheques link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الشيكات الصادرة/ })).toBeInTheDocument();
    });

    it('renders production link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الإنتاج/ })).toBeInTheDocument();
    });

    it('renders fixed assets link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الأصول الثابتة/ })).toBeInTheDocument();
    });

    it('renders employees link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الموظفين/ })).toBeInTheDocument();
    });

    it('renders invoices link', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الفواتير/ })).toBeInTheDocument();
    });
  });

  describe('Link URLs', () => {
    it('dashboard links to /dashboard', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /لوحة التحكم/ })).toHaveAttribute('href', '/dashboard');
    });

    it('clients links to /clients', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /العملاء/ })).toHaveAttribute('href', '/clients');
    });

    it('ledger links to /ledger', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /دفتر الأستاذ/ })).toHaveAttribute('href', '/ledger');
    });

    it('reports links to /reports', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /التقارير/ })).toHaveAttribute('href', '/reports');
    });
  });

  describe('Active State', () => {
    it('highlights dashboard when on /dashboard', () => {
      mockPathname.mockReturnValue('/dashboard');
      render(<Sidebar />);

      const dashboardLink = screen.getByRole('link', { name: /لوحة التحكم/ });
      expect(dashboardLink).toHaveClass('bg-primary', 'text-white');
    });

    it('highlights clients when on /clients', () => {
      mockPathname.mockReturnValue('/clients');
      render(<Sidebar />);

      const clientsLink = screen.getByRole('link', { name: /العملاء/ });
      expect(clientsLink).toHaveClass('bg-primary', 'text-white');
    });

    it('highlights ledger when on /ledger', () => {
      mockPathname.mockReturnValue('/ledger');
      render(<Sidebar />);

      const ledgerLink = screen.getByRole('link', { name: /دفتر الأستاذ/ });
      expect(ledgerLink).toHaveClass('bg-primary', 'text-white');
    });

    it('does not highlight inactive links', () => {
      mockPathname.mockReturnValue('/dashboard');
      render(<Sidebar />);

      const clientsLink = screen.getByRole('link', { name: /العملاء/ });
      expect(clientsLink).not.toHaveClass('bg-primary');
      expect(clientsLink).toHaveClass('text-gray-700');
    });
  });

  describe('Accessibility', () => {
    it('has navigation landmark', () => {
      render(<Sidebar />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has list structure for menu items', () => {
      render(<Sidebar />);

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(10);
    });
  });
});
