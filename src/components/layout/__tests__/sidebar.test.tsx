import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../sidebar';

// Mock Next.js router
const mockPathname = jest.fn().mockReturnValue('/dashboard');
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Sidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/dashboard');
    localStorageMock.clear();
  });

  describe('Branding', () => {
    it('renders FactoryFlow logo and name', () => {
      render(<Sidebar />);

      expect(screen.getByText('FactoryFlow')).toBeInTheDocument();
      expect(screen.getByText('نظام إدارة المصنع')).toBeInTheDocument();
    });
  });

  describe('Top-Level Navigation Items', () => {
    it('renders dashboard link always visible', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /لوحة التحكم/ })).toBeInTheDocument();
    });

    it('renders search link always visible', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /البحث عن معاملة/ })).toBeInTheDocument();
    });

    it('dashboard links to /dashboard', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /لوحة التحكم/ })).toHaveAttribute('href', '/dashboard');
    });

    it('search links to /search', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /البحث عن معاملة/ })).toHaveAttribute('href', '/search');
    });
  });

  describe('Navigation Groups', () => {
    it('renders all 5 navigation groups', () => {
      render(<Sidebar />);

      expect(screen.getByText('الحسابات')).toBeInTheDocument();
      expect(screen.getByText('الشيكات')).toBeInTheDocument();
      expect(screen.getByText('الأطراف')).toBeInTheDocument();
      expect(screen.getByText('المخزون والإنتاج')).toBeInTheDocument();
      expect(screen.getByText('التقارير والنسخ')).toBeInTheDocument();
    });

    it('accounts group is open by default', () => {
      render(<Sidebar />);

      // Accounts group items should be visible
      expect(screen.getByRole('link', { name: /دفتر الأستاذ/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /المدفوعات/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /الفواتير/ })).toBeInTheDocument();
    });

    it('can expand cheques group by clicking', () => {
      render(<Sidebar />);

      // Click the cheques group trigger
      const chequesGroup = screen.getByText('الشيكات');
      fireEvent.click(chequesGroup);

      // Cheques items should now be visible
      expect(screen.getByRole('link', { name: /الشيكات الواردة/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /الشيكات الصادرة/ })).toBeInTheDocument();
    });

    it('can expand parties group by clicking', () => {
      render(<Sidebar />);

      // Click the parties group trigger
      const partiesGroup = screen.getByText('الأطراف');
      fireEvent.click(partiesGroup);

      // Parties items should now be visible
      expect(screen.getByRole('link', { name: /العملاء/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /الشركاء/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /الموظفين/ })).toBeInTheDocument();
    });

    it('can expand inventory group by clicking', () => {
      render(<Sidebar />);

      // Click the inventory group trigger
      const inventoryGroup = screen.getByText('المخزون والإنتاج');
      fireEvent.click(inventoryGroup);

      // Inventory items should now be visible
      expect(screen.getByRole('link', { name: /المخزون/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /الإنتاج/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /الأصول الثابتة/ })).toBeInTheDocument();
    });

    it('can expand reports group by clicking', () => {
      render(<Sidebar />);

      // Click the reports group trigger
      const reportsGroup = screen.getByText('التقارير والنسخ');
      fireEvent.click(reportsGroup);

      // Reports items should now be visible
      expect(screen.getByRole('link', { name: /التقارير/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /النسخ الاحتياطي/ })).toBeInTheDocument();
    });
  });

  describe('Link URLs', () => {
    it('ledger links to /ledger', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /دفتر الأستاذ/ })).toHaveAttribute('href', '/ledger');
    });

    it('payments links to /payments', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /المدفوعات/ })).toHaveAttribute('href', '/payments');
    });

    it('invoices links to /invoices', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /الفواتير/ })).toHaveAttribute('href', '/invoices');
    });
  });

  describe('Active State', () => {
    it('highlights dashboard when on /dashboard', () => {
      mockPathname.mockReturnValue('/dashboard');
      render(<Sidebar />);

      const dashboardLink = screen.getByRole('link', { name: /لوحة التحكم/ });
      expect(dashboardLink).toHaveClass('bg-primary', 'text-white');
    });

    it('highlights search when on /search', () => {
      mockPathname.mockReturnValue('/search');
      render(<Sidebar />);

      const searchLink = screen.getByRole('link', { name: /البحث عن معاملة/ });
      expect(searchLink).toHaveClass('bg-primary', 'text-white');
    });

    it('highlights ledger when on /ledger', () => {
      mockPathname.mockReturnValue('/ledger');
      render(<Sidebar />);

      const ledgerLink = screen.getByRole('link', { name: /دفتر الأستاذ/ });
      expect(ledgerLink).toHaveClass('bg-primary', 'text-white');
    });

    it('highlights group trigger when sub-item is active', () => {
      mockPathname.mockReturnValue('/ledger');
      render(<Sidebar />);

      // The accounts group should be highlighted
      const accountsGroup = screen.getByText('الحسابات').closest('button');
      expect(accountsGroup).toHaveClass('bg-primary/10', 'text-primary');
    });

    it('does not highlight inactive links', () => {
      mockPathname.mockReturnValue('/dashboard');
      render(<Sidebar />);

      const searchLink = screen.getByRole('link', { name: /البحث عن معاملة/ });
      expect(searchLink).not.toHaveClass('bg-primary');
      expect(searchLink).toHaveClass('text-gray-700');
    });
  });

  describe('Auto-expand Active Group', () => {
    it('auto-expands group containing active item', () => {
      // Navigate to cheques page (cheques group is closed by default)
      mockPathname.mockReturnValue('/incoming-cheques');
      render(<Sidebar />);

      // Cheques items should be visible because the group auto-expanded
      expect(screen.getByRole('link', { name: /الشيكات الواردة/ })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has navigation landmark', () => {
      render(<Sidebar />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has list structure for top-level items', () => {
      render(<Sidebar />);

      // There are multiple lists (top-level items + sub-items in groups)
      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThan(0);
    });

    it('group triggers have aria-expanded attribute', () => {
      render(<Sidebar />);

      const accountsGroup = screen.getByText('الحسابات').closest('button');
      expect(accountsGroup).toHaveAttribute('aria-expanded');
    });
  });
});
