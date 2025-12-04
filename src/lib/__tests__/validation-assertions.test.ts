/**
 * Unit Tests for Data Integrity Assertions
 */

// Mock Firebase to avoid fetch issues in test environment
jest.mock('@/firebase/config', () => ({
  firestore: {},
  storage: {},
}));

import { assertNonNegative, DataIntegrityError } from '../errors';

describe('assertNonNegative', () => {
  const defaultContext = {
    operation: 'testOperation',
    entityId: 'test-123',
    entityType: 'testEntity',
  };

  describe('valid values', () => {
    it('should return positive values unchanged', () => {
      expect(assertNonNegative(100, defaultContext)).toBe(100);
      expect(assertNonNegative(0.01, defaultContext)).toBe(0.01);
      expect(assertNonNegative(999999, defaultContext)).toBe(999999);
    });

    it('should return zero unchanged', () => {
      expect(assertNonNegative(0, defaultContext)).toBe(0);
    });

    it('should handle floating point values', () => {
      expect(assertNonNegative(0.001, defaultContext)).toBe(0.001);
      expect(assertNonNegative(100.50, defaultContext)).toBe(100.50);
    });
  });

  describe('invalid values', () => {
    it('should throw DataIntegrityError for negative values', () => {
      expect(() => assertNonNegative(-1, defaultContext)).toThrow(DataIntegrityError);
      expect(() => assertNonNegative(-0.01, defaultContext)).toThrow(DataIntegrityError);
      expect(() => assertNonNegative(-1000, defaultContext)).toThrow(DataIntegrityError);
    });

    it('should include operation in error message', () => {
      try {
        assertNonNegative(-5, { operation: 'revertInventory' });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DataIntegrityError);
        expect((error as DataIntegrityError).message).toContain('revertInventory');
      }
    });

    it('should include entity info in error message', () => {
      try {
        assertNonNegative(-5, {
          operation: 'updatePayment',
          entityId: 'payment-456',
          entityType: 'payment',
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DataIntegrityError);
        expect((error as DataIntegrityError).message).toContain('payment-456');
        expect((error as DataIntegrityError).message).toContain('payment');
      }
    });

    it('should include actual negative value in error message', () => {
      try {
        assertNonNegative(-42.5, defaultContext);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DataIntegrityError);
        expect((error as DataIntegrityError).message).toContain('-42.5');
      }
    });

    it('should set correct context in error', () => {
      try {
        assertNonNegative(-10, {
          operation: 'deleteItem',
          entityId: 'item-789',
          entityType: 'inventory',
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DataIntegrityError);
        const dataError = error as DataIntegrityError;
        expect(dataError.context.operation).toBe('deleteItem');
        expect(dataError.context.expectedValue).toBe(0);
        expect(dataError.context.actualValue).toBe(-10);
        expect(dataError.context.entityId).toBe('item-789');
        expect(dataError.context.entityType).toBe('inventory');
      }
    });
  });

  describe('minimal context', () => {
    it('should work with only operation specified', () => {
      expect(assertNonNegative(5, { operation: 'simple' })).toBe(5);

      try {
        assertNonNegative(-1, { operation: 'simple' });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DataIntegrityError);
        expect((error as DataIntegrityError).context.operation).toBe('simple');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very small negative numbers', () => {
      expect(() => assertNonNegative(-0.0001, defaultContext)).toThrow(DataIntegrityError);
    });

    it('should handle Number.MIN_VALUE (smallest positive)', () => {
      expect(assertNonNegative(Number.MIN_VALUE, defaultContext)).toBe(Number.MIN_VALUE);
    });

    it('should handle large positive numbers', () => {
      expect(assertNonNegative(Number.MAX_SAFE_INTEGER, defaultContext)).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
