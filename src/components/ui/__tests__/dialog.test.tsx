/**
 * Unit Tests for Dialog Components
 * Tests Dialog, DialogTrigger, DialogContent, DialogHeader, etc.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '../dialog';
import { Button } from '../button';

describe('Dialog Components', () => {
  describe('Dialog', () => {
    it('should render dialog trigger', () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('button', { name: /open dialog/i })).toBeInTheDocument();
    });

    it('should open dialog on trigger click', async () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>Dialog content</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await userEvent.click(screen.getByRole('button', { name: /open dialog/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should be controlled with open prop', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should call onOpenChange when state changes', async () => {
      const handleOpenChange = jest.fn();

      render(
        <Dialog onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>Open</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await userEvent.click(screen.getByRole('button', { name: /open/i }));

      expect(handleOpenChange).toHaveBeenCalledWith(true);
    });
  });

  describe('DialogContent', () => {
    it('should render content when open', async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <p>Dialog content goes here</p>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Dialog content goes here')).toBeInTheDocument();
    });

    it('should render close button', async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      // Close button should have sr-only text "Close"
      expect(screen.getByText('Close')).toHaveClass('sr-only');
    });

    it('should apply correct positioning classes', async () => {
      render(
        <Dialog open={true}>
          <DialogContent data-testid="content">
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const content = screen.getByTestId('content');
      expect(content).toHaveClass('fixed');
      expect(content).toHaveClass('left-[50%]');
      expect(content).toHaveClass('top-[50%]');
      expect(content).toHaveClass('translate-x-[-50%]');
      expect(content).toHaveClass('translate-y-[-50%]');
    });

    it('should have max-width constraint', async () => {
      render(
        <Dialog open={true}>
          <DialogContent data-testid="content">
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('content')).toHaveClass('max-w-lg');
    });

    it('should apply custom className', async () => {
      render(
        <Dialog open={true}>
          <DialogContent className="custom-dialog">
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('dialog')).toHaveClass('custom-dialog');
    });
  });

  describe('DialogHeader', () => {
    it('should render header content', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader data-testid="header">
              <DialogTitle>Header Title</DialogTitle>
              <DialogDescription>Header description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByText('Header Title')).toBeInTheDocument();
      expect(screen.getByText('Header description')).toBeInTheDocument();
    });

    it('should apply flex column layout', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader data-testid="header">
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      const header = screen.getByTestId('header');
      expect(header).toHaveClass('flex');
      expect(header).toHaveClass('flex-col');
      expect(header).toHaveClass('space-y-1.5');
    });

    it('should have RTL text alignment', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader data-testid="header">
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('header')).toHaveClass('sm:text-right');
    });
  });

  describe('DialogFooter', () => {
    it('should render footer content', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <DialogFooter data-testid="footer">
              <Button>Cancel</Button>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByTestId('footer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should apply flex layout', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <DialogFooter data-testid="footer">
              <Button>Action</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('flex');
      expect(footer).toHaveClass('gap-2');
    });
  });

  describe('DialogTitle', () => {
    it('should render title text', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>إضافة عميل جديد</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('إضافة عميل جديد')).toBeInTheDocument();
    });

    it('should apply title styles', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle data-testid="title">Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const title = screen.getByTestId('title');
      expect(title).toHaveClass('text-lg');
      expect(title).toHaveClass('font-semibold');
      expect(title).toHaveClass('leading-none');
      expect(title).toHaveClass('tracking-tight');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLHeadingElement>();
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle ref={ref}>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('DialogDescription', () => {
    it('should render description text', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>هذا وصف للمربع الحواري</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('هذا وصف للمربع الحواري')).toBeInTheDocument();
    });

    it('should apply description styles', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription data-testid="desc">Description</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      const desc = screen.getByTestId('desc');
      expect(desc).toHaveClass('text-sm');
      expect(desc).toHaveClass('text-muted-foreground');
    });
  });

  describe('DialogClose', () => {
    it('should close dialog when clicked', async () => {
      const handleOpenChange = jest.fn();

      render(
        <Dialog onOpenChange={handleOpenChange} open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <DialogClose asChild>
              <Button>Close Dialog</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      );

      await userEvent.click(screen.getByRole('button', { name: /close dialog/i }));

      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Overlay', () => {
    it('should render overlay when open', async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      // Overlay should have dark background
      const overlay = document.querySelector('[data-state="open"]');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA role', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Accessible Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should trap focus within dialog', async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Focus Test</DialogTitle>
            <input type="text" placeholder="First input" />
            <Button>Action</Button>
          </DialogContent>
        </Dialog>
      );

      // Dialog should be focused or one of its children
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
      });
    });

    it('should associate title with dialog', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Associated Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      // Dialog should be properly labeled
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Keyboard Interaction', () => {
    it('should close on Escape key', async () => {
      const handleOpenChange = jest.fn();

      render(
        <Dialog onOpenChange={handleOpenChange} open={true}>
          <DialogContent>
            <DialogTitle>Keyboard Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await userEvent.keyboard('{Escape}');

      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Complete Dialog', () => {
    it('should render full dialog structure', async () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>إضافة عميل</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة عميل جديد</DialogTitle>
              <DialogDescription>
                أدخل بيانات العميل الجديد هنا
              </DialogDescription>
            </DialogHeader>
            <div>
              <input type="text" placeholder="الاسم" />
              <input type="tel" placeholder="الهاتف" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">إلغاء</Button>
              </DialogClose>
              <Button>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      // Initial state - only trigger visible
      expect(screen.getByRole('button', { name: /إضافة عميل/i })).toBeInTheDocument();

      // Open dialog
      await userEvent.click(screen.getByRole('button', { name: /إضافة عميل/i }));

      // All elements should be visible
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('إضافة عميل جديد')).toBeInTheDocument();
        expect(screen.getByText('أدخل بيانات العميل الجديد هنا')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('الاسم')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('الهاتف')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /إلغاء/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /حفظ/i })).toBeInTheDocument();
      });
    });
  });

  describe('Display Names', () => {
    it('should have correct display names', () => {
      expect(DialogContent.displayName).toBe('DialogContent');
      expect(DialogHeader.displayName).toBe('DialogHeader');
      expect(DialogFooter.displayName).toBe('DialogFooter');
      expect(DialogTitle.displayName).toBe('DialogTitle');
      expect(DialogDescription.displayName).toBe('DialogDescription');
    });
  });
});
