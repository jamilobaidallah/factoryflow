/**
 * Unit Tests for Table Components
 * Tests Table, TableHeader, TableBody, TableRow, TableHead, TableCell, etc.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '../table';

describe('Table Components', () => {
  describe('Table', () => {
    it('should render table element', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should wrap table in scrollable container', () => {
      render(
        <Table data-testid="table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const table = screen.getByRole('table');
      expect(table.parentElement).toHaveClass('relative');
      expect(table.parentElement).toHaveClass('w-full');
      expect(table.parentElement).toHaveClass('overflow-auto');
    });

    it('should apply default styles', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const table = screen.getByRole('table');
      expect(table).toHaveClass('w-full');
      expect(table).toHaveClass('caption-bottom');
      expect(table).toHaveClass('text-sm');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLTableElement>();
      render(
        <Table ref={ref}>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(ref.current).toBeInstanceOf(HTMLTableElement);
    });

    it('should accept custom className', () => {
      render(
        <Table className="custom-table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByRole('table')).toHaveClass('custom-table');
    });
  });

  describe('TableHeader', () => {
    it('should render thead element', () => {
      render(
        <Table>
          <TableHeader data-testid="header">
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      );

      expect(screen.getByTestId('header').tagName).toBe('THEAD');
    });

    it('should apply border styles to rows', () => {
      render(
        <Table>
          <TableHeader data-testid="header">
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      );

      expect(screen.getByTestId('header')).toHaveClass('[&_tr]:border-b');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLTableSectionElement>();
      render(
        <Table>
          <TableHeader ref={ref}>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      );

      expect(ref.current).toBeInstanceOf(HTMLTableSectionElement);
    });
  });

  describe('TableBody', () => {
    it('should render tbody element', () => {
      render(
        <Table>
          <TableBody data-testid="body">
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByTestId('body').tagName).toBe('TBODY');
    });

    it('should remove border from last row', () => {
      render(
        <Table>
          <TableBody data-testid="body">
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByTestId('body')).toHaveClass('[&_tr:last-child]:border-0');
    });
  });

  describe('TableFooter', () => {
    it('should render tfoot element', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter data-testid="footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );

      expect(screen.getByTestId('footer').tagName).toBe('TFOOT');
    });

    it('should apply footer styles', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter data-testid="footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );

      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('border-t');
      expect(footer).toHaveClass('bg-muted/50');
      expect(footer).toHaveClass('font-medium');
    });
  });

  describe('TableRow', () => {
    it('should render tr element', () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="row">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByTestId('row').tagName).toBe('TR');
    });

    it('should apply hover styles', () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="row">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByTestId('row')).toHaveClass('hover:bg-muted/50');
    });

    it('should apply border styles', () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="row">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByTestId('row')).toHaveClass('border-b');
      expect(screen.getByTestId('row')).toHaveClass('transition-colors');
    });

    it('should support selected state via data attribute', () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="row" data-state="selected">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByTestId('row')).toHaveClass('data-[state=selected]:bg-muted');
    });
  });

  describe('TableHead', () => {
    it('should render th element', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      );

      expect(screen.getByRole('columnheader')).toBeInTheDocument();
    });

    it('should apply header styles', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-testid="head">Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      );

      const head = screen.getByTestId('head');
      expect(head).toHaveClass('h-12');
      expect(head).toHaveClass('px-4');
      expect(head).toHaveClass('text-right'); // RTL support
      expect(head).toHaveClass('font-medium');
      expect(head).toHaveClass('text-muted-foreground');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLTableCellElement>();
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead ref={ref}>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      );

      expect(ref.current).toBeInstanceOf(HTMLTableCellElement);
    });
  });

  describe('TableCell', () => {
    it('should render td element', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByRole('cell')).toBeInTheDocument();
    });

    it('should apply cell styles', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell data-testid="cell">Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const cell = screen.getByTestId('cell');
      expect(cell).toHaveClass('p-4');
      expect(cell).toHaveClass('align-middle');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLTableCellElement>();
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell ref={ref}>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(ref.current).toBeInstanceOf(HTMLTableCellElement);
    });

    it('should support colSpan', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3} data-testid="cell">Spanned</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByTestId('cell')).toHaveAttribute('colspan', '3');
    });
  });

  describe('TableCaption', () => {
    it('should render caption element', () => {
      render(
        <Table>
          <TableCaption>Table Caption</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(screen.getByText('Table Caption')).toBeInTheDocument();
    });

    it('should apply caption styles', () => {
      render(
        <Table>
          <TableCaption data-testid="caption">Caption</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const caption = screen.getByTestId('caption');
      expect(caption).toHaveClass('mt-4');
      expect(caption).toHaveClass('text-sm');
      expect(caption).toHaveClass('text-muted-foreground');
    });
  });

  describe('Complete Table', () => {
    it('should render full table structure correctly', () => {
      render(
        <Table>
          <TableCaption>قائمة العملاء</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الهاتف</TableHead>
              <TableHead>الرصيد</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>محمد أحمد</TableCell>
              <TableCell>0791234567</TableCell>
              <TableCell>1,000 دينار</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>علي حسن</TableCell>
              <TableCell>0799876543</TableCell>
              <TableCell>2,500 دينار</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>الإجمالي</TableCell>
              <TableCell>3,500 دينار</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      );

      // Verify structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(3);
      expect(screen.getAllByRole('row')).toHaveLength(4); // 1 header + 2 body + 1 footer
      expect(screen.getByText('قائمة العملاء')).toBeInTheDocument();
      expect(screen.getByText('محمد أحمد')).toBeInTheDocument();
      expect(screen.getByText('الإجمالي')).toBeInTheDocument();
    });
  });

  describe('Display Names', () => {
    it('should have correct display names', () => {
      expect(Table.displayName).toBe('Table');
      expect(TableHeader.displayName).toBe('TableHeader');
      expect(TableBody.displayName).toBe('TableBody');
      expect(TableFooter.displayName).toBe('TableFooter');
      expect(TableRow.displayName).toBe('TableRow');
      expect(TableHead.displayName).toBe('TableHead');
      expect(TableCell.displayName).toBe('TableCell');
      expect(TableCaption.displayName).toBe('TableCaption');
    });
  });
});
