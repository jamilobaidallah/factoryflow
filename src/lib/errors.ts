/**
 * Custom Error Types for FactoryFlow
 *
 * Provides specific error classes for different failure scenarios,
 * enabling better error handling and debugging.
 */

export interface DataIntegrityContext {
  operation: string;
  expectedValue: number;
  actualValue: number;
  entityId?: string;
  entityType?: string;
}

/**
 * Error thrown when a data integrity violation is detected.
 *
 * Use this instead of silently clamping values (e.g., Math.max(0, value))
 * to surface bugs rather than hiding them.
 *
 * @example
 * if (quantity < 0) {
 *   throw new DataIntegrityError(
 *     'Inventory quantity cannot be negative',
 *     { operation: 'revertInventory', expectedValue: 0, actualValue: quantity, entityId: itemId }
 *   );
 * }
 */
export class DataIntegrityError extends Error {
  public readonly context: DataIntegrityContext;

  constructor(message: string, context: DataIntegrityContext) {
    super(message);
    this.name = 'DataIntegrityError';
    this.context = context;

    // Maintains proper stack trace in V8 environments (Node/Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DataIntegrityError);
    }
  }

  /**
   * Returns a detailed string representation for logging
   */
  toDetailedString(): string {
    const { operation, expectedValue, actualValue, entityId, entityType } = this.context;
    const entityInfo = entityId ? ` [${entityType || 'entity'}: ${entityId}]` : '';
    return `${this.name}: ${this.message}${entityInfo} | operation: ${operation}, expected: >= ${expectedValue}, actual: ${actualValue}`;
  }
}

/**
 * Type guard to check if an error is a DataIntegrityError
 */
export function isDataIntegrityError(error: unknown): error is DataIntegrityError {
  return error instanceof DataIntegrityError;
}

// ======================
// Data Integrity Assertions
// ======================

export interface AssertNonNegativeContext {
  operation: string;
  entityId?: string;
  entityType?: string;
}

/**
 * Assert that a value is non-negative, throw DataIntegrityError if not.
 *
 * Use this instead of Math.max(0, value) to catch bugs rather than hide them.
 * Negative values in quantities, balances, or payments indicate data corruption
 * that should be surfaced and fixed, not silently clamped.
 *
 * @param value - The value to check
 * @param context - Context for error reporting
 * @returns The original value if non-negative
 * @throws DataIntegrityError if value is negative
 *
 * @example
 * // Instead of: Math.max(0, revertedQuantity)
 * // Use:
 * const safeQuantity = assertNonNegative(revertedQuantity, {
 *   operation: 'revertInventory',
 *   entityId: itemId,
 *   entityType: 'inventory'
 * });
 */
export function assertNonNegative(
  value: number,
  context: AssertNonNegativeContext
): number {
  if (value < 0) {
    const entityInfo = context.entityId
      ? ` for ${context.entityType || 'entity'} ${context.entityId}`
      : '';
    throw new DataIntegrityError(
      `Data integrity violation: ${context.operation} resulted in negative value (${value})${entityInfo}`,
      {
        operation: context.operation,
        expectedValue: 0,
        actualValue: value,
        entityId: context.entityId,
        entityType: context.entityType,
      }
    );
  }
  return value;
}
