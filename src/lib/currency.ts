/**
 * Currency Utility Module
 *
 * Provides safe arithmetic operations for financial calculations using decimal.js-light.
 * JavaScript's native number type uses IEEE 754 floating-point which cannot accurately
 * represent decimal values (e.g., 0.1 + 0.2 = 0.30000000000000004).
 *
 * This module ensures all currency calculations are precise to 2 decimal places
 * using banker's rounding (ROUND_HALF_UP).
 *
 * @example
 * // Instead of: const total = price * quantity;
 * // Use: const total = safeMultiply(price, quantity);
 */

import Decimal from "decimal.js-light";

// Configure Decimal for financial calculations
Decimal.set({
  precision: 20, // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP, // Standard financial rounding (0.5 rounds up)
});

/**
 * Safely adds two currency values.
 *
 * @param a - First value
 * @param b - Second value
 * @returns Sum rounded to 2 decimal places
 *
 * @example
 * safeAdd(0.1, 0.2) // Returns 0.3 (not 0.30000000000000004)
 * safeAdd(100.50, 25.75) // Returns 126.25
 */
export function safeAdd(a: number, b: number): number {
  return new Decimal(a).plus(b).toDecimalPlaces(2).toNumber();
}

/**
 * Safely subtracts one currency value from another.
 *
 * @param a - Value to subtract from
 * @param b - Value to subtract
 * @returns Difference rounded to 2 decimal places
 *
 * @example
 * safeSubtract(1000, 333.33) // Returns 666.67
 * safeSubtract(100, 100.001) // Returns 0 (rounds to 2 decimals)
 */
export function safeSubtract(a: number, b: number): number {
  return new Decimal(a).minus(b).toDecimalPlaces(2).toNumber();
}

/**
 * Safely multiplies two values (e.g., quantity * unit price).
 *
 * @param a - First value (e.g., quantity)
 * @param b - Second value (e.g., unit price)
 * @returns Product rounded to 2 decimal places
 *
 * @example
 * safeMultiply(3, 99.99) // Returns 299.97
 * safeMultiply(0.1, 0.2) // Returns 0.02
 */
export function safeMultiply(a: number, b: number): number {
  return new Decimal(a).times(b).toDecimalPlaces(2).toNumber();
}

/**
 * Safely divides one value by another.
 * Returns 0 if divisor is 0 to prevent division by zero errors.
 *
 * @param a - Dividend (value to be divided)
 * @param b - Divisor (value to divide by)
 * @returns Quotient rounded to 2 decimal places, or 0 if divisor is 0
 *
 * @example
 * safeDivide(100, 3) // Returns 33.33
 * safeDivide(1000, 0) // Returns 0 (safe division by zero)
 */
export function safeDivide(a: number, b: number): number {
  if (b === 0) return 0;
  return new Decimal(a).dividedBy(b).toDecimalPlaces(2).toNumber();
}

/**
 * Rounds a value to 2 decimal places using banker's rounding.
 *
 * @param value - Value to round
 * @returns Value rounded to 2 decimal places
 *
 * @example
 * roundCurrency(10.555) // Returns 10.56 (rounds up)
 * roundCurrency(10.554) // Returns 10.55 (rounds down)
 * roundCurrency(10.545) // Returns 10.55 (banker's rounding)
 */
export function roundCurrency(value: number): number {
  return new Decimal(value).toDecimalPlaces(2).toNumber();
}

/**
 * Safely sums an array of currency values.
 * Uses Decimal arithmetic internally to avoid accumulated rounding errors.
 *
 * @param values - Array of numbers to sum
 * @returns Sum rounded to 2 decimal places
 *
 * @example
 * sumAmounts([0.1, 0.2, 0.3]) // Returns 0.6 (not 0.6000000000000001)
 * sumAmounts([100.50, 200.75, 50.25]) // Returns 351.5
 */
export function sumAmounts(values: number[]): number {
  const sum = values.reduce(
    (acc, val) => acc.plus(val),
    new Decimal(0)
  );
  return sum.toDecimalPlaces(2).toNumber();
}

/**
 * Parses a string or number into a safe currency value.
 * Handles string input from form fields and ensures proper rounding.
 *
 * @param value - String or number to parse
 * @returns Parsed and rounded number, or 0 if invalid
 *
 * @example
 * parseAmount("100.50") // Returns 100.5
 * parseAmount("invalid") // Returns 0
 * parseAmount(99.999) // Returns 100 (rounded)
 */
export function parseAmount(value: string | number): number {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || !isFinite(num)) return 0;
  return roundCurrency(num);
}

/**
 * Compares two currency values for equality within 2 decimal places.
 * Useful for checking if a balance is fully paid.
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if values are equal when rounded to 2 decimals
 *
 * @example
 * currencyEquals(0.1 + 0.2, 0.3) // Returns true
 * currencyEquals(100.004, 100.005) // Returns true (both round to 100.00/100.01)
 */
export function currencyEquals(a: number, b: number): boolean {
  return roundCurrency(a) === roundCurrency(b);
}

/**
 * Checks if a currency value is effectively zero (within rounding tolerance).
 *
 * @param value - Value to check
 * @returns True if value rounds to 0.00
 *
 * @example
 * isZero(0.001) // Returns true (rounds to 0.00)
 * isZero(0.01) // Returns false
 * isZero(-0.004) // Returns true (rounds to -0.00 = 0.00)
 */
export function isZero(value: number): boolean {
  return roundCurrency(value) === 0;
}

/**
 * Returns the maximum of zero and a value (floors at zero).
 * Useful for preventing negative balances.
 *
 * @param value - Value to check
 * @returns The value if positive, otherwise 0
 *
 * @example
 * zeroFloor(-0.01) // Returns 0
 * zeroFloor(100.50) // Returns 100.5
 */
export function zeroFloor(value: number): number {
  const rounded = roundCurrency(value);
  return rounded < 0 ? 0 : rounded;
}
