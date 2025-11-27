/**
 * Unit Tests for Input Component
 * Tests input rendering, types, and behaviors
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input placeholder="Enter text" />);

      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should render with correct default type', () => {
      render(<Input type="text" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('should apply default styling classes', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('flex');
      expect(input).toHaveClass('h-10');
      expect(input).toHaveClass('w-full');
      expect(input).toHaveClass('rounded-md');
      expect(input).toHaveClass('border');
    });
  });

  describe('Input Types', () => {
    it('should render text input', () => {
      render(<Input type="text" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'text');
    });

    it('should render password input', () => {
      render(<Input type="password" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');
    });

    it('should render email input', () => {
      render(<Input type="email" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
    });

    it('should render number input', () => {
      render(<Input type="number" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'number');
    });

    it('should render tel input', () => {
      render(<Input type="tel" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'tel');
    });

    it('should render date input', () => {
      render(<Input type="date" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'date');
    });

    it('should render file input', () => {
      render(<Input type="file" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('type', 'file');
      expect(input).toHaveClass('file:border-0');
      expect(input).toHaveClass('file:bg-transparent');
    });
  });

  describe('Value Handling', () => {
    it('should accept value prop', () => {
      render(<Input value="test value" onChange={() => {}} data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveValue('test value');
    });

    it('should accept defaultValue prop', () => {
      render(<Input defaultValue="default" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveValue('default');
    });

    it('should call onChange when value changes', async () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} data-testid="input" />);

      const input = screen.getByTestId('input');
      await userEvent.type(input, 'hello');

      expect(handleChange).toHaveBeenCalled();
    });

    it('should update value on user input', async () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      await userEvent.type(input, 'typed text');

      expect(input).toHaveValue('typed text');
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled styles', () => {
      render(<Input disabled data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:cursor-not-allowed');
      expect(input).toHaveClass('disabled:opacity-50');
    });

    it('should not allow input when disabled', async () => {
      render(<Input disabled data-testid="input" />);

      const input = screen.getByTestId('input');
      await userEvent.type(input, 'test');

      expect(input).toHaveValue('');
    });
  });

  describe('Read-only State', () => {
    it('should respect readOnly prop', () => {
      render(<Input readOnly data-testid="input" defaultValue="readonly" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Placeholder', () => {
    it('should show placeholder text', () => {
      render(<Input placeholder="أدخل النص هنا" />);

      expect(screen.getByPlaceholderText('أدخل النص هنا')).toBeInTheDocument();
    });

    it('should have placeholder styling', () => {
      render(<Input placeholder="placeholder" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveClass('placeholder:text-muted-foreground');
    });
  });

  describe('Focus Styles', () => {
    it('should have focus-visible ring styles', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('focus-visible:outline-none');
      expect(input).toHaveClass('focus-visible:ring-2');
      expect(input).toHaveClass('focus-visible:ring-ring');
      expect(input).toHaveClass('focus-visible:ring-offset-2');
    });

    it('should be focusable', () => {
      render(<Input data-testid="input" />);

      const input = screen.getByTestId('input');
      input.focus();

      expect(input).toHaveFocus();
    });
  });

  describe('Custom className', () => {
    it('should merge custom className with default classes', () => {
      render(<Input className="custom-class" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('custom-class');
      expect(input).toHaveClass('flex'); // Default class
    });

    it('should allow overriding default styles', () => {
      render(<Input className="h-12" data-testid="input" />);

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('h-12');
    });
  });

  describe('Events', () => {
    it('should call onFocus handler', () => {
      const handleFocus = jest.fn();
      render(<Input onFocus={handleFocus} data-testid="input" />);

      fireEvent.focus(screen.getByTestId('input'));
      expect(handleFocus).toHaveBeenCalled();
    });

    it('should call onBlur handler', () => {
      const handleBlur = jest.fn();
      render(<Input onBlur={handleBlur} data-testid="input" />);

      const input = screen.getByTestId('input');
      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalled();
    });

    it('should call onKeyDown handler', async () => {
      const handleKeyDown = jest.fn();
      render(<Input onKeyDown={handleKeyDown} data-testid="input" />);

      const input = screen.getByTestId('input');
      await userEvent.type(input, '{enter}');

      expect(handleKeyDown).toHaveBeenCalled();
    });
  });

  describe('Validation Attributes', () => {
    it('should support required attribute', () => {
      render(<Input required data-testid="input" />);

      expect(screen.getByTestId('input')).toBeRequired();
    });

    it('should support min attribute for number', () => {
      render(<Input type="number" min={0} data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('min', '0');
    });

    it('should support max attribute for number', () => {
      render(<Input type="number" max={100} data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('max', '100');
    });

    it('should support minLength attribute', () => {
      render(<Input minLength={3} data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('minlength', '3');
    });

    it('should support maxLength attribute', () => {
      render(<Input maxLength={50} data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('maxlength', '50');
    });

    it('should support pattern attribute', () => {
      render(<Input pattern="[0-9]+" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('pattern', '[0-9]+');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Input aria-label="اسم المستخدم" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('aria-label', 'اسم المستخدم');
    });

    it('should support aria-describedby', () => {
      render(<Input aria-describedby="help-text" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should support aria-invalid', () => {
      render(<Input aria-invalid="true" data-testid="input" />);

      expect(screen.getByTestId('input')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Display Name', () => {
    it('should have correct display name', () => {
      expect(Input.displayName).toBe('Input');
    });
  });
});
