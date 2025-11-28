/**
 * Utilities for working with Firestore data types
 */

/**
 * Represents a Firestore Timestamp object
 */
export interface FirestoreTimestamp {
  toDate: () => Date;
}

/**
 * Type for values that could be a Firestore Timestamp, Date, or undefined
 */
export type FirestoreDateValue = FirestoreTimestamp | Date | undefined | null;

/**
 * Converts a Firestore Timestamp or Date-like value to a JavaScript Date
 * Falls back to current date if the value is invalid or undefined
 *
 * @param value - The value to convert (Firestore Timestamp, Date, or undefined)
 * @param fallback - Optional fallback date (defaults to new Date())
 * @returns A JavaScript Date object
 */
export function toDate(value: FirestoreDateValue, fallback?: Date): Date {
  if (!value) {
    return fallback ?? new Date();
  }

  // Check if it's a Firestore Timestamp with toDate method
  if (typeof (value as FirestoreTimestamp).toDate === 'function') {
    return (value as FirestoreTimestamp).toDate();
  }

  // If it's already a Date, return it
  if (value instanceof Date) {
    return value;
  }

  return fallback ?? new Date();
}

/**
 * Converts a Firestore Timestamp to a JavaScript Date, returning undefined if the value doesn't exist
 * Use this for optional date fields that should remain undefined when not present
 *
 * @param value - The value to convert (Firestore Timestamp, Date, or undefined)
 * @returns A JavaScript Date object or undefined
 */
export function toDateOptional(value: FirestoreDateValue): Date | undefined {
  if (!value) {
    return undefined;
  }

  // Check if it's a Firestore Timestamp with toDate method
  if (typeof (value as FirestoreTimestamp).toDate === 'function') {
    return (value as FirestoreTimestamp).toDate();
  }

  // If it's already a Date, return it
  if (value instanceof Date) {
    return value;
  }

  return undefined;
}

/**
 * Common date field names used in Firestore documents
 */
const COMMON_DATE_FIELDS = [
  'date',
  'createdAt',
  'updatedAt',
  'dueDate',
  'issueDate',
  'invoiceDate',
  'purchaseDate',
  'hireDate',
  'effectiveDate',
  'joinDate',
] as const;

type CommonDateField = typeof COMMON_DATE_FIELDS[number];

/**
 * Converts common Firestore Timestamp fields in a data object to JavaScript Dates
 * Only converts fields that exist in the data object
 *
 * @param data - The Firestore document data
 * @param additionalFields - Optional additional field names to convert
 * @returns The data object with Timestamp fields converted to Dates
 */
export function convertFirestoreDates<T extends Record<string, unknown>>(
  data: T,
  additionalFields: string[] = []
): T {
  const result = { ...data };
  const fieldsToConvert = [...COMMON_DATE_FIELDS, ...additionalFields];

  for (const field of fieldsToConvert) {
    if (field in data && data[field] !== undefined) {
      (result as Record<string, unknown>)[field] = toDate(data[field] as FirestoreDateValue);
    }
  }

  return result;
}
