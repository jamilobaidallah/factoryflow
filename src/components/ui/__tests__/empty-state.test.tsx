import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText } from 'lucide-react';
import {
  EmptyState,
  EmptyStateWithIllustration,
  EmptySearchResults,
  EmptyErrorState,
} from '../empty-state';

describe('EmptyState', () => {
  it('renders icon', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No Data"
        description="No data available"
      />
    );

    // Icon is rendered (svg element)
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <EmptyState
        icon={FileText}
        title="لا توجد بيانات"
        description="لا توجد بيانات متاحة"
      />
    );

    expect(screen.getByText('لا توجد بيانات')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No Data"
        description="Add your first item to get started"
      />
    );

    expect(screen.getByText('Add your first item to get started')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        icon={FileText}
        title="No Data"
        description="No data available"
        action={{ label: 'Add Item', onClick }}
      />
    );

    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('does not render action button when not provided', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No Data"
        description="No data available"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls action onClick when button clicked', async () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        icon={FileText}
        title="No Data"
        description="No data available"
        action={{ label: 'Add Item', onClick }}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState
        icon={FileText}
        title="No Data"
        description="No data available"
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('EmptyStateWithIllustration', () => {
  it('renders title', () => {
    render(
      <EmptyStateWithIllustration
        title="Welcome"
        description="Get started by adding your first item"
      />
    );

    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <EmptyStateWithIllustration
        title="Welcome"
        description="Get started by adding your first item"
      />
    );

    expect(screen.getByText('Get started by adding your first item')).toBeInTheDocument();
  });

  it('renders illustration when provided', () => {
    render(
      <EmptyStateWithIllustration
        title="Welcome"
        description="Description"
        illustration={<div data-testid="custom-illustration">Illustration</div>}
      />
    );

    expect(screen.getByTestId('custom-illustration')).toBeInTheDocument();
  });

  it('does not render illustration container when not provided', () => {
    const { container } = render(
      <EmptyStateWithIllustration
        title="Welcome"
        description="Description"
      />
    );

    expect(container.querySelector('.opacity-50')).not.toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const onClick = jest.fn();
    render(
      <EmptyStateWithIllustration
        title="Welcome"
        description="Description"
        action={{ label: 'Get Started', onClick }}
      />
    );

    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('calls action onClick when button clicked', async () => {
    const onClick = jest.fn();
    render(
      <EmptyStateWithIllustration
        title="Welcome"
        description="Description"
        action={{ label: 'Get Started', onClick }}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Get Started' }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('EmptySearchResults', () => {
  it('renders search icon', () => {
    render(<EmptySearchResults searchTerm="test" onClear={jest.fn()} />);

    expect(screen.getByText('🔍')).toBeInTheDocument();
  });

  it('renders no results message', () => {
    render(<EmptySearchResults searchTerm="test" onClear={jest.fn()} />);

    expect(screen.getByText('لم يتم العثور على نتائج')).toBeInTheDocument();
  });

  it('displays search term in description', () => {
    render(<EmptySearchResults searchTerm="my query" onClear={jest.fn()} />);

    expect(screen.getByText(/my query/)).toBeInTheDocument();
  });

  it('renders clear button', () => {
    render(<EmptySearchResults searchTerm="test" onClear={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'مسح البحث' })).toBeInTheDocument();
  });

  it('calls onClear when clear button clicked', async () => {
    const onClear = jest.fn();
    render(<EmptySearchResults searchTerm="test" onClear={onClear} />);

    await userEvent.click(screen.getByRole('button', { name: 'مسح البحث' }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('EmptyErrorState', () => {
  it('renders warning icon', () => {
    render(<EmptyErrorState />);

    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('renders default title', () => {
    render(<EmptyErrorState />);

    expect(screen.getByText('حدث خطأ')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<EmptyErrorState title="خطأ في الاتصال" />);

    expect(screen.getByText('خطأ في الاتصال')).toBeInTheDocument();
  });

  it('renders default description', () => {
    render(<EmptyErrorState />);

    expect(screen.getByText(/عذراً، حدث خطأ/)).toBeInTheDocument();
  });

  it('renders custom description', () => {
    render(<EmptyErrorState description="Custom error message" />);

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', () => {
    render(<EmptyErrorState onRetry={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry not provided', () => {
    render(<EmptyErrorState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', async () => {
    const onRetry = jest.fn();
    render(<EmptyErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
