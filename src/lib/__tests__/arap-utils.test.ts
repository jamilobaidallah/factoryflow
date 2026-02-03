/**
 * Unit Tests for AR/AP Utilities
 */

// Mock Firebase to avoid fetch issues in test environment
jest.mock('@/firebase/config', () => ({
  firestore: {},
  storage: {},
}));

import {
  calculatePaymentStatus,
  formatCurrency,
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

  describe('calculatePaymentStatus - additional edge cases', () => {
    it('should handle negative transaction amounts', () => {
      const status = calculatePaymentStatus(100, -100);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle both amounts as zero', () => {
      const status = calculatePaymentStatus(0, 0);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle negative total paid', () => {
      const status = calculatePaymentStatus(-50, 1000);
      expect(status).toBe(PAYMENT_STATUSES.UNPAID);
    });

    it('should handle exact remaining of zero', () => {
      const status = calculatePaymentStatus(500.00, 500.00);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle floating point precision issues', () => {
      // 0.1 + 0.2 in JavaScript is 0.30000000000000004
      const status = calculatePaymentStatus(0.1 + 0.2, 0.3);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle very large amounts', () => {
      const status = calculatePaymentStatus(500000000, 1000000000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });
  });

  describe('formatCurrency - additional edge cases', () => {
    it('should handle very large numbers', () => {
      expect(formatCurrency(1000000000)).toBe('1000000000.00 دينار');
    });

    it('should handle very small decimals', () => {
      expect(formatCurrency(0.001)).toBe('0.00 دينار');
    });

    it('should handle empty currency string', () => {
      expect(formatCurrency(100, '')).toBe('100.00 ');
    });

    it('should handle special characters in currency', () => {
      expect(formatCurrency(100, '€')).toBe('100.00 €');
    });
  });

});
