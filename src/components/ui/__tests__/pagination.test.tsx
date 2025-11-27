/**
 * Unit Tests for Pagination Components
 * Tests all pagination components and their accessibility
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '../pagination';

describe('Pagination Components', () => {
  describe('Pagination', () => {
    it('should render nav element', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have correct aria-label', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'pagination');
    });

    it('should apply default styles', () => {
      render(
        <Pagination data-testid="pagination">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      const nav = screen.getByTestId('pagination');
      expect(nav).toHaveClass('mx-auto');
      expect(nav).toHaveClass('flex');
      expect(nav).toHaveClass('w-full');
      expect(nav).toHaveClass('justify-center');
    });

    it('should accept custom className', () => {
      render(
        <Pagination className="custom-pagination">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('navigation')).toHaveClass('custom-pagination');
    });
  });

  describe('PaginationContent', () => {
    it('should render ul element', () => {
      render(
        <Pagination>
          <PaginationContent data-testid="content">
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByTestId('content').tagName).toBe('UL');
    });

    it('should apply flex styles', () => {
      render(
        <Pagination>
          <PaginationContent data-testid="content">
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      const content = screen.getByTestId('content');
      expect(content).toHaveClass('flex');
      expect(content).toHaveClass('flex-row');
      expect(content).toHaveClass('items-center');
      expect(content).toHaveClass('gap-1');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLUListElement>();
      render(
        <Pagination>
          <PaginationContent ref={ref}>
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(ref.current).toBeInstanceOf(HTMLUListElement);
    });
  });

  describe('PaginationItem', () => {
    it('should render li element', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem data-testid="item">
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByTestId('item').tagName).toBe('LI');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLLIElement>();
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem ref={ref}>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(ref.current).toBeInstanceOf(HTMLLIElement);
    });
  });

  describe('PaginationLink', () => {
    it('should render anchor element', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink href="/page/1">1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should apply ghost variant by default', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink data-testid="link">1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByTestId('link')).toHaveClass('hover:bg-accent');
    });

    it('should apply outline variant when active', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink isActive data-testid="link">1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      const link = screen.getByTestId('link');
      expect(link).toHaveClass('border');
    });

    it('should set aria-current when active', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink isActive>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
    });

    it('should not set aria-current when not active', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
    });

    it('should use icon size by default', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink data-testid="link">1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByTestId('link')).toHaveClass('h-10');
      expect(screen.getByTestId('link')).toHaveClass('w-10');
    });
  });

  describe('PaginationPrevious', () => {
    it('should render with Arabic text', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="/prev" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByText('السابق')).toBeInTheDocument();
    });

    it('should have correct aria-label', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="/prev" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Go to previous page');
    });

    it('should render chevron icon', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="/prev" data-testid="prev" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      // ChevronRight is used for RTL
      expect(screen.getByTestId('prev').querySelector('svg')).toBeInTheDocument();
    });

    it('should use default size', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="/prev" data-testid="prev" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByTestId('prev')).toHaveClass('h-10');
    });
  });

  describe('PaginationNext', () => {
    it('should render with Arabic text', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationNext href="/next" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByText('التالي')).toBeInTheDocument();
    });

    it('should have correct aria-label', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationNext href="/next" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Go to next page');
    });

    it('should render chevron icon', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationNext href="/next" data-testid="next" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      // ChevronLeft is used for RTL
      expect(screen.getByTestId('next').querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('PaginationEllipsis', () => {
    it('should render ellipsis icon', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationEllipsis data-testid="ellipsis" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByTestId('ellipsis').querySelector('svg')).toBeInTheDocument();
    });

    it('should be hidden from screen readers with aria-hidden', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationEllipsis data-testid="ellipsis" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByTestId('ellipsis')).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have screen reader text', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByText('المزيد من الصفحات')).toHaveClass('sr-only');
    });

    it('should apply correct styles', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationEllipsis data-testid="ellipsis" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      const ellipsis = screen.getByTestId('ellipsis');
      expect(ellipsis).toHaveClass('flex');
      expect(ellipsis).toHaveClass('h-9');
      expect(ellipsis).toHaveClass('w-9');
      expect(ellipsis).toHaveClass('items-center');
      expect(ellipsis).toHaveClass('justify-center');
    });
  });

  describe('Complete Pagination', () => {
    it('should render full pagination correctly', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="/page/1" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="/page/1">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="/page/2" isActive>2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="/page/3">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="/page/10">10</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="/page/3" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getAllByRole('link')).toHaveLength(7);
      expect(screen.getByText('السابق')).toBeInTheDocument();
      expect(screen.getByText('التالي')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should highlight current page', () => {
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink href="/page/1">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="/page/2" isActive>2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="/page/3">3</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      const activeLink = screen.getByText('2').closest('a');
      expect(activeLink).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Click Handling', () => {
    it('should call onClick when link is clicked', () => {
      const handleClick = jest.fn();
      render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink onClick={handleClick}>1</PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );

      fireEvent.click(screen.getByRole('link'));
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Display Names', () => {
    it('should have correct display names', () => {
      expect(Pagination.displayName).toBe('Pagination');
      expect(PaginationContent.displayName).toBe('PaginationContent');
      expect(PaginationItem.displayName).toBe('PaginationItem');
      expect(PaginationLink.displayName).toBe('PaginationLink');
      expect(PaginationPrevious.displayName).toBe('PaginationPrevious');
      expect(PaginationNext.displayName).toBe('PaginationNext');
      expect(PaginationEllipsis.displayName).toBe('PaginationEllipsis');
    });
  });
});
