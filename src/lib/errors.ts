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
