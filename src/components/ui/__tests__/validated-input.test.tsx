/**
 * Unit Tests for ValidatedInput Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ValidatedInput } from '../validated-input';

describe('ValidatedInput', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with label', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('الاسم')).toBeInTheDocument();
  });

  it('should show required indicator when required=true', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        required
      />
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should call onChange when value changes', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'محمد' } });

    expect(mockOnChange).toHaveBeenCalledWith('محمد');
  });

  it('should show error message when error prop is provided and touched', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        error="هذا الحقل مطلوب"
      />
    );

    const input = screen.getByRole('textbox');

    // Initially error should not be visible (not touched)
    expect(screen.queryByText('هذا الحقل مطلوب')).not.toBeInTheDocument();

    // After blur, error should appear
    fireEvent.blur(input);
    expect(screen.getByText('هذا الحقل مطلوب')).toBeInTheDocument();
  });

  it('should show success indicator when valid', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value="محمد أحمد"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.getByText('صحيح')).toBeInTheDocument();
  });

  it('should not show success indicator when showSuccessIndicator=false', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value="محمد أحمد"
        onChange={mockOnChange}
        showSuccessIndicator={false}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.queryByText('صحيح')).not.toBeInTheDocument();
  });

  it('should show hint text when provided and no error', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        hint="أدخل الاسم الكامل"
      />
    );

    expect(screen.getByText('أدخل الاسم الكامل')).toBeInTheDocument();
  });

  it('should hide hint text when error is shown', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        hint="أدخل الاسم الكامل"
        error="هذا الحقل مطلوب"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.queryByText('أدخل الاسم الكامل')).not.toBeInTheDocument();
    expect(screen.getByText('هذا الحقل مطلوب')).toBeInTheDocument();
  });

  it('should show character counter when maxLength is provided', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value="محمد"
        onChange={mockOnChange}
        maxLength={100}
      />
    );

    expect(screen.getByText('4/100')).toBeInTheDocument();
  });

  it('should update character counter as user types', () => {
    const { rerender } = render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        maxLength={100}
      />
    );

    expect(screen.getByText('0/100')).toBeInTheDocument();

    rerender(
      <ValidatedInput
        label="الاسم"
        name="name"
        value="محمد أحمد"
        onChange={mockOnChange}
        maxLength={100}
      />
    );

    expect(screen.getByText('9/100')).toBeInTheDocument();
  });

  it('should render with custom type', () => {
    render(
      <ValidatedInput
        label="البريد الإلكتروني"
        name="email"
        value=""
        onChange={mockOnChange}
        type="email"
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('should render with placeholder', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        placeholder="أدخل الاسم"
      />
    );

    expect(screen.getByPlaceholderText('أدخل الاسم')).toBeInTheDocument();
  });

  it('should be disabled when disabled=true', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        disabled
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        className="custom-class"
      />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should not show success indicator for empty value even when touched', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.queryByText('صحيح')).not.toBeInTheDocument();
  });

  it('should prioritize error display over success', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value="محمد"
        onChange={mockOnChange}
        error="اسم قصير جداً"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(screen.getByText('اسم قصير جداً')).toBeInTheDocument();
    expect(screen.queryByText('صحيح')).not.toBeInTheDocument();
  });

  it('should respect maxLength attribute', () => {
    render(
      <ValidatedInput
        label="الاسم"
        name="name"
        value=""
        onChange={mockOnChange}
        maxLength={10}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('maxLength', '10');
  });

  it('should handle number input type', () => {
    render(
      <ValidatedInput
        label="الرصيد"
        name="balance"
        value="1000"
        onChange={mockOnChange}
        type="number"
      />
    );

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('type', 'number');
  });
});
