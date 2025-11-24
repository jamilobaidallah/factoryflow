/**
 * Unit Tests for Form Validators
 */

import { validators } from '../form-field-with-validation';

describe('Form Validators', () => {
  describe('validators.required', () => {
    it('should pass for non-empty strings', () => {
      expect(validators.required('test')).toBeNull();
      expect(validators.required('  test  ')).toBeNull();
    });

    it('should fail for empty strings', () => {
      expect(validators.required('')).toBe('هذا الحقل مطلوب');
      expect(validators.required('   ')).toBe('هذا الحقل مطلوب');
    });
  });

  describe('validators.number', () => {
    it('should pass for valid numbers', () => {
      expect(validators.number('123')).toBeNull();
      expect(validators.number('123.45')).toBeNull();
      expect(validators.number('-50')).toBeNull();
      expect(validators.number('0')).toBeNull();
    });

    it('should fail for non-numbers', () => {
      expect(validators.number('abc')).toBe('يجب إدخال رقم صحيح');
      expect(validators.number('12abc')).toBe('يجب إدخال رقم صحيح');
    });

    it('should pass for empty strings (optional number)', () => {
      expect(validators.number('')).toBeNull();
    });
  });

  describe('validators.positiveNumber', () => {
    it('should pass for positive numbers', () => {
      expect(validators.positiveNumber('1')).toBeNull();
      expect(validators.positiveNumber('100.50')).toBeNull();
      expect(validators.positiveNumber('0.01')).toBeNull();
    });

    it('should fail for zero', () => {
      expect(validators.positiveNumber('0')).toBe('يجب أن يكون الرقم أكبر من صفر');
    });

    it('should fail for negative numbers', () => {
      expect(validators.positiveNumber('-5')).toBe('يجب أن يكون الرقم أكبر من صفر');
    });

    it('should pass for empty strings', () => {
      expect(validators.positiveNumber('')).toBeNull();
    });
  });

  describe('validators.phone', () => {
    it('should pass for valid phone numbers', () => {
      expect(validators.phone('1234567')).toBeNull();
      expect(validators.phone('12345678901234567890')).toBeNull();
      expect(validators.phone('0791234567')).toBeNull();
    });

    it('should fail for invalid phone numbers', () => {
      expect(validators.phone('123')).toBe('رقم الهاتف غير صحيح'); // Too short
      expect(validators.phone('123456789012345678901')).toBe('رقم الهاتف غير صحيح'); // Too long
      expect(validators.phone('12abc67')).toBe('رقم الهاتف غير صحيح'); // Contains letters
      expect(validators.phone('123-456-7890')).toBe('رقم الهاتف غير صحيح'); // Contains dashes
    });

    it('should pass for empty strings', () => {
      expect(validators.phone('')).toBeNull();
    });
  });

  describe('validators.email', () => {
    it('should pass for valid emails', () => {
      expect(validators.email('test@example.com')).toBeNull();
      expect(validators.email('user.name@domain.co.uk')).toBeNull();
      expect(validators.email('test+tag@email.com')).toBeNull();
    });

    it('should fail for invalid emails', () => {
      expect(validators.email('invalid')).toBe('البريد الإلكتروني غير صحيح');
      expect(validators.email('test@')).toBe('البريد الإلكتروني غير صحيح');
      expect(validators.email('@example.com')).toBe('البريد الإلكتروني غير صحيح');
      expect(validators.email('test@.com')).toBe('البريد الإلكتروني غير صحيح');
    });

    it('should pass for empty strings', () => {
      expect(validators.email('')).toBeNull();
    });
  });

  describe('validators.minLength', () => {
    it('should pass for strings meeting minimum length', () => {
      const validator = validators.minLength(5);
      expect(validator('12345')).toBeNull();
      expect(validator('123456')).toBeNull();
    });

    it('should fail for strings below minimum length', () => {
      const validator = validators.minLength(5);
      expect(validator('1234')).toBe('يجب أن يحتوي على 5 أحرف على الأقل');
    });

    it('should pass for empty strings', () => {
      const validator = validators.minLength(5);
      expect(validator('')).toBeNull();
    });
  });

  describe('validators.maxLength', () => {
    it('should pass for strings within maximum length', () => {
      const validator = validators.maxLength(10);
      expect(validator('12345')).toBeNull();
      expect(validator('1234567890')).toBeNull();
    });

    it('should fail for strings exceeding maximum length', () => {
      const validator = validators.maxLength(10);
      expect(validator('12345678901')).toBe('يجب ألا يتجاوز 10 حرف');
    });

    it('should pass for empty strings', () => {
      const validator = validators.maxLength(10);
      expect(validator('')).toBeNull();
    });
  });

  describe('validators.transactionId', () => {
    it('should pass for valid transaction IDs', () => {
      expect(validators.transactionId('TXN-20251122-123456-789')).toBeNull();
      expect(validators.transactionId('  TXN-12345678-123456-123  ')).toBeNull();
    });

    it('should fail for invalid transaction IDs', () => {
      expect(validators.transactionId('TXN-123')).toBe('رقم المعاملة غير صحيح');
      expect(validators.transactionId('INVALID')).toBe('رقم المعاملة غير صحيح');
      expect(validators.transactionId('TXN-2025-12-34')).toBe('رقم المعاملة غير صحيح');
    });

    it('should pass for empty strings', () => {
      expect(validators.transactionId('')).toBeNull();
    });
  });

  describe('validators.combine', () => {
    it('should pass when all validators pass', () => {
      const validator = validators.combine(
        validators.required,
        validators.number,
        validators.positiveNumber
      );

      expect(validator('100')).toBeNull();
    });

    it('should fail when any validator fails', () => {
      const validator = validators.combine(
        validators.required,
        validators.number,
        validators.positiveNumber
      );

      expect(validator('')).toBe('هذا الحقل مطلوب');
      expect(validator('abc')).toBe('يجب إدخال رقم صحيح');
      expect(validator('-5')).toBe('يجب أن يكون الرقم أكبر من صفر');
    });

    it('should return first error encountered', () => {
      const validator = validators.combine(
        validators.required,
        validators.minLength(5)
      );

      const result = validator('');
      expect(result).toBe('هذا الحقل مطلوب'); // First error
    });

    it('should work with empty validator list', () => {
      const validator = validators.combine();
      expect(validator('test')).toBeNull();
    });
  });
});
