/**
 * Unit Tests for DataIntegrityError
 */

import { DataIntegrityError, isDataIntegrityError } from '../errors';

describe('DataIntegrityError', () => {
  describe('constructor', () => {
    it('should create error with message and context', () => {
      const error = new DataIntegrityError('Test error message', {
        operation: 'testOperation',
        expectedValue: 0,
        actualValue: -5,
        entityId: 'item-123',
        entityType: 'inventory',
      });

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('DataIntegrityError');
      expect(error.context.operation).toBe('testOperation');
      expect(error.context.expectedValue).toBe(0);
      expect(error.context.actualValue).toBe(-5);
      expect(error.context.entityId).toBe('item-123');
      expect(error.context.entityType).toBe('inventory');
    });

    it('should create error without optional fields', () => {
      const error = new DataIntegrityError('Minimal error', {
        operation: 'minimalOp',
        expectedValue: 0,
        actualValue: -10,
      });

      expect(error.message).toBe('Minimal error');
      expect(error.context.entityId).toBeUndefined();
      expect(error.context.entityType).toBeUndefined();
    });

    it('should be an instance of Error', () => {
      const error = new DataIntegrityError('Test', {
        operation: 'test',
        expectedValue: 0,
        actualValue: -1,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DataIntegrityError);
    });
  });

  describe('toDetailedString', () => {
    it('should return detailed string with entity info', () => {
      const error = new DataIntegrityError('Negative quantity', {
        operation: 'revertInventory',
        expectedValue: 0,
        actualValue: -3,
        entityId: 'item-456',
        entityType: 'inventory',
      });

      const detailedString = error.toDetailedString();

      expect(detailedString).toContain('DataIntegrityError');
      expect(detailedString).toContain('Negative quantity');
      expect(detailedString).toContain('inventory: item-456');
      expect(detailedString).toContain('operation: revertInventory');
      expect(detailedString).toContain('expected: >= 0');
      expect(detailedString).toContain('actual: -3');
    });

    it('should return detailed string without entity info', () => {
      const error = new DataIntegrityError('No entity', {
        operation: 'genericOp',
        expectedValue: 0,
        actualValue: -1,
      });

      const detailedString = error.toDetailedString();

      expect(detailedString).toContain('No entity');
      expect(detailedString).not.toContain('entity:');
    });

    it('should use default entity type when entityType is missing', () => {
      const error = new DataIntegrityError('Partial info', {
        operation: 'test',
        expectedValue: 0,
        actualValue: -2,
        entityId: 'abc-123',
      });

      const detailedString = error.toDetailedString();

      expect(detailedString).toContain('entity: abc-123');
    });
  });
});

describe('isDataIntegrityError', () => {
  it('should return true for DataIntegrityError instances', () => {
    const error = new DataIntegrityError('Test', {
      operation: 'test',
      expectedValue: 0,
      actualValue: -1,
    });

    expect(isDataIntegrityError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    const error = new Error('Regular error');

    expect(isDataIntegrityError(error)).toBe(false);
  });

  it('should return false for non-error objects', () => {
    expect(isDataIntegrityError({ message: 'Not an error' })).toBe(false);
    expect(isDataIntegrityError('string error')).toBe(false);
    expect(isDataIntegrityError(null)).toBe(false);
    expect(isDataIntegrityError(undefined)).toBe(false);
  });
});
