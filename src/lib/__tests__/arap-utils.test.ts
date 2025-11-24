/**
 * Unit Tests for AR/AP Utilities
 */

import {
  calculatePaymentStatus,
  isValidTransactionId,
  formatCurrency,
  validatePaymentAmount,
} from '../arap-utils';
import { PAYMENT_STATUSES } from '../definitions';

describe('AR/AP Utilities', () => {
  describe('calculatePaymentStatus', () => {
    it('should return "paid" when fully paid', () => {
      const status = calculatePaymentStatus(1000, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should return "paid" when overpaid', () => {
      const status = calculatePaymentStatus(1500, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should return "unpaid" when nothing paid', () => {
      const status = calculatePaymentStatus(0, 1000);
      expect(status).toBe(PAYMENT_STATUSES.UNPAID);
    });

    it('should return "partial" when partially paid', () => {
      const status = calculatePaymentStatus(500, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });

    it('should handle decimal amounts correctly', () => {
      const status = calculatePaymentStatus(499.99, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });

    it('should handle very small amounts', () => {
      const status = calculatePaymentStatus(0.01, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });
  });

  describe('isValidTransactionId', () => {
    it('should validate correct transaction ID format', () => {
      expect(isValidTransactionId('TXN-20251122-123456-789')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidTransactionId('TXN-123')).toBe(false);
      expect(isValidTransactionId('INVALID')).toBe(false);
      expect(isValidTransactionId('TXN-2025-123456-789')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidTransactionId('')).toBe(false);
      expect(isValidTransactionId('   ')).toBe(false);
    });

    it('should handle transaction IDs with whitespace', () => {
      expect(isValidTransactionId('  TXN-20251122-123456-789  ')).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isValidTransactionId(null as any)).toBe(false);
      expect(isValidTransactionId(undefined as any)).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with default symbol', () => {
      expect(formatCurrency(1000)).toBe('1000.00 دينار');
    });

    it('should format currency with custom symbol', () => {
      expect(formatCurrency(1000, 'USD')).toBe('1000.00 USD');
    });

    it('should handle decimal places correctly', () => {
      expect(formatCurrency(1234.56)).toBe('1234.56 دينار');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(1234.567)).toBe('1234.57 دينار');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('0.00 دينار');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-500)).toBe('-500.00 دينار');
    });
  });

  describe('validatePaymentAmount', () => {
    it('should validate positive amounts', () => {
      const result = validatePaymentAmount(100);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject zero', () => {
      const result = validatePaymentAmount(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('المبلغ يجب أن يكون أكبر من صفر');
    });

    it('should reject negative amounts', () => {
      const result = validatePaymentAmount(-100);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('المبلغ يجب أن يكون أكبر من صفر');
    });

    it('should reject NaN', () => {
      const result = validatePaymentAmount(NaN);
      expect(result.isValid).toBe(false);
    });

    it('should reject amounts that are too large', () => {
      const result = validatePaymentAmount(1000000000);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('المبلغ كبير جداً');
    });

    it('should accept very small positive amounts', () => {
      const result = validatePaymentAmount(0.01);
      expect(result.isValid).toBe(true);
    });

    it('should accept decimal amounts', () => {
      const result = validatePaymentAmount(123.45);
      expect(result.isValid).toBe(true);
    });
  });
});
