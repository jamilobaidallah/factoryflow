/**
 * Comprehensive Validation System
 *
 * Provides Zod schemas, validators, duplicate detection,
 * and data consistency checks for the entire application.
 */

import { z } from 'zod';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import Decimal from 'decimal.js-light';

// ======================
// Arabic Error Messages
// ======================

export const arabicErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === 'string') {
        return { message: 'يجب إدخال نص' };
      }
      if (issue.expected === 'number') {
        return { message: 'يجب إدخال رقم صحيح' };
      }
      return { message: 'نوع البيانات غير صحيح' };

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: `يجب أن يحتوي على ${issue.minimum} أحرف على الأقل` };
      }
      if (issue.type === 'number') {
        return { message: `يجب أن يكون أكبر من أو يساوي ${issue.minimum}` };
      }
      return { message: 'القيمة صغيرة جداً' };

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `يجب ألا يتجاوز ${issue.maximum} حرف` };
      }
      if (issue.type === 'number') {
        return { message: `يجب أن يكون أقل من أو يساوي ${issue.maximum}` };
      }
      return { message: 'القيمة كبيرة جداً' };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: 'البريد الإلكتروني غير صحيح' };
      }
      if (issue.validation === 'url') {
        return { message: 'الرابط غير صحيح' };
      }
      return { message: 'النص غير صحيح' };

    case z.ZodIssueCode.custom:
      return { message: issue.message || 'خطأ في التحقق من البيانات' };

    default:
      return { message: ctx.defaultError };
  }
};

// Set default error map
z.setErrorMap(arabicErrorMap);

// ======================
// Common Validation Schemas
// ======================

export const phoneSchema = z
  .string()
  .regex(/^[0-9]{7,20}$/, 'رقم الهاتف غير صحيح (7-20 رقم)')
  .optional()
  .or(z.literal(''));

export const emailSchema = z
  .string()
  .email('البريد الإلكتروني غير صحيح')
  .optional()
  .or(z.literal(''));

export const positiveNumberSchema = z
  .number()
  .positive('يجب أن يكون الرقم أكبر من صفر');

export const nonNegativeNumberSchema = z
  .number()
  .nonnegative('يجب أن يكون الرقم صفر أو أكبر');

export const requiredStringSchema = z
  .string()
  .trim()
  .min(1, 'هذا الحقل مطلوب');

// ======================
// Entity Schemas
// ======================

// Client Schema
export const clientSchema = z.object({
  name: requiredStringSchema.max(100, 'الاسم طويل جداً'),
  phone: phoneSchema,
  email: emailSchema,
  address: z.string().max(200, 'العنوان طويل جداً').optional(),
  balance: z.number().default(0),
});

export type ClientInput = z.infer<typeof clientSchema>;

// Partner Schema
export const partnerSchema = z.object({
  name: requiredStringSchema.max(100, 'الاسم طويل جداً'),
  phone: phoneSchema,
  email: emailSchema,
  address: z.string().max(200, 'العنوان طويل جداً').optional(),
  equityBalance: z.number().default(0),
});

export type PartnerInput = z.infer<typeof partnerSchema>;

// Employee/Supplier Schema
export const supplierSchema = z.object({
  name: requiredStringSchema.max(100, 'الاسم طويل جداً'),
  phone: phoneSchema,
  email: emailSchema,
  address: z.string().max(200, 'العنوان طويل جداً').optional(),
  balance: z.number().default(0),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

// Ledger Entry Schema
export const ledgerEntrySchema = z.object({
  date: z.date(),
  category: requiredStringSchema,
  subcategory: z.string().optional(),
  amount: positiveNumberSchema,
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: 'نوع الحركة غير صحيح' }),
  }),
  description: requiredStringSchema.max(500, 'الوصف طويل جداً'),
  relatedEntity: z.string().optional(),
  relatedEntityType: z.enum(['client', 'partner', 'supplier', 'none']).optional(),
  paymentMethod: z.enum(['cash', 'bank', 'cheque']).optional(),
});

export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;

// Payment Schema
export const paymentSchema = z.object({
  date: z.date(),
  amount: positiveNumberSchema,
  type: z.enum(['income', 'expense']),
  category: requiredStringSchema,
  description: requiredStringSchema.max(500, 'الوصف طويل جداً'),
  paymentMethod: z.enum(['cash', 'bank', 'cheque']),
  relatedEntity: z.string().optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// Cheque Schema
export const chequeSchema = z.object({
  chequeNumber: requiredStringSchema.max(50, 'رقم الشيك طويل جداً'),
  amount: positiveNumberSchema,
  date: z.date(),
  dueDate: z.date(),
  type: z.enum(['incoming', 'outgoing']),
  status: z.enum(['pending', 'cashed', 'bounced', 'cancelled']).default('pending'),
  bank: requiredStringSchema.max(100, 'اسم البنك طويل جداً'),
  relatedEntity: z.string().optional(),
  notes: z.string().max(500, 'الملاحظات طويلة جداً').optional(),
}).refine(
  (data) => data.dueDate >= data.date,
  {
    message: 'تاريخ الاستحقاق يجب أن يكون بعد تاريخ الإصدار',
    path: ['dueDate'],
  }
);

export type ChequeInput = z.infer<typeof chequeSchema>;

// Inventory Item Schema
export const inventoryItemSchema = z.object({
  name: requiredStringSchema.max(100, 'الاسم طويل جداً'),
  sku: z.string().max(50, 'رمز المنتج طويل جداً').optional(),
  category: requiredStringSchema,
  quantity: nonNegativeNumberSchema,
  unit: requiredStringSchema.max(20, 'الوحدة طويلة جداً'),
  costPrice: positiveNumberSchema,
  sellingPrice: positiveNumberSchema,
  minStock: nonNegativeNumberSchema.default(0),
  description: z.string().max(500, 'الوصف طويل جداً').optional(),
}).refine(
  (data) => data.sellingPrice >= data.costPrice,
  {
    message: 'سعر البيع يجب أن يكون أكبر من أو يساوي سعر التكلفة',
    path: ['sellingPrice'],
  }
);

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

// Fixed Asset Schema
export const fixedAssetSchema = z.object({
  name: requiredStringSchema.max(100, 'الاسم طويل جداً'),
  category: requiredStringSchema,
  purchaseDate: z.date(),
  purchasePrice: positiveNumberSchema,
  currentValue: positiveNumberSchema,
  depreciationRate: z.number().min(0).max(100, 'نسبة الإهلاك يجب أن تكون بين 0 و 100'),
  notes: z.string().max(500, 'الملاحظات طويلة جداً').optional(),
});

export type FixedAssetInput = z.infer<typeof fixedAssetSchema>;

// ======================
// Duplicate Detection
// ======================

export interface DuplicateCheckOptions {
  collection: string;
  field: string;
  value: string;
  userId: string;
  excludeId?: string; // For updates, exclude current document
}

/**
 * Check if a value already exists in a collection
 * @returns true if duplicate found, false otherwise
 */
export async function checkDuplicate(
  options: DuplicateCheckOptions
): Promise<boolean> {
  const { collection: collectionName, field, value, userId, excludeId } = options;

  try {
    const collectionRef = collection(firestore, `users/${userId}/${collectionName}`);
    const q = query(collectionRef, where(field, '==', value));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return false;
    }

    // If we're updating, check if the only match is the current document
    if (excludeId && snapshot.size === 1) {
      const doc = snapshot.docs[0];
      return doc.id !== excludeId;
    }

    return true;
  } catch (error) {
    console.error('Error checking for duplicate:', error);
    return false; // Fail gracefully
  }
}

/**
 * Check for duplicate client name
 */
export async function checkDuplicateClient(
  name: string,
  userId: string,
  excludeId?: string
): Promise<boolean> {
  return checkDuplicate({
    collection: 'clients',
    field: 'name',
    value: name.trim(),
    userId,
    excludeId,
  });
}

/**
 * Check for duplicate cheque number
 */
export async function checkDuplicateCheque(
  chequeNumber: string,
  userId: string,
  excludeId?: string
): Promise<boolean> {
  return checkDuplicate({
    collection: 'cheques',
    field: 'chequeNumber',
    value: chequeNumber.trim(),
    userId,
    excludeId,
  });
}

/**
 * Check for duplicate inventory SKU
 */
export async function checkDuplicateSKU(
  sku: string,
  userId: string,
  excludeId?: string
): Promise<boolean> {
  if (!sku) { return false; } // SKU is optional

  return checkDuplicate({
    collection: 'inventory',
    field: 'sku',
    value: sku.trim(),
    userId,
    excludeId,
  });
}

// ======================
// Data Consistency Checks
// ======================

/**
 * Validate that a date is not in the far future (more than 1 year)
 */
export function validateReasonableDate(date: Date): boolean {
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  return date <= oneYearFromNow;
}

/**
 * Validate that a numeric value is within reasonable bounds
 */
export function validateReasonableAmount(amount: number, max: number = 1000000000): boolean {
  return amount >= 0 && amount <= max;
}

/**
 * Sanitize string input (remove excess whitespace, trim)
 */
export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Validate and parse number from string
 */
export function parseNumericInput(value: string): number | null {
  if (!value || value.trim() === '') {
    return null;
  }

  const cleaned = value.trim().replace(/,/g, '');

  try {
    const decimal = new Decimal(cleaned);
    return decimal.toNumber();
  } catch {
    return null;
  }
}

// ======================
// Enhanced Error Formatting
// ======================

/**
 * Format Zod validation errors into user-friendly Arabic messages
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const field = err.path.join('.');
    return err.message;
  });
}

/**
 * Get the first validation error message
 */
export function getFirstValidationError(error: z.ZodError): string {
  return error.errors[0]?.message || 'خطأ في التحقق من البيانات';
}

/**
 * Validate data and return formatted errors
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: formatValidationErrors(error) };
    }
    return { success: false, errors: ['حدث خطأ غير متوقع في التحقق من البيانات'] };
  }
}

// ======================
// Form Helper Functions
// ======================

/**
 * Validate form data before submission
 */
export async function validateFormWithDuplicateCheck<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  duplicateChecks?: Array<() => Promise<boolean>>
): Promise<{ success: true; data: T } | { success: false; errors: string[] }> {
  // First validate with schema
  const validation = validateData(schema, data);
  if (!validation.success) {
    return validation;
  }

  // Then check for duplicates
  if (duplicateChecks) {
    for (const check of duplicateChecks) {
      const isDuplicate = await check();
      if (isDuplicate) {
        return {
          success: false,
          errors: ['هذه البيانات موجودة مسبقاً. يرجى التحقق من عدم التكرار.'],
        };
      }
    }
  }

  return { success: true, data: validation.data };
}

/**
 * Safe form data extractor with validation
 */
export function extractFormData<T>(
  formData: Record<string, unknown>,
  schema: z.ZodSchema<T>
): { success: boolean; data?: T; errors?: string[] } {
  try {
    const validated = schema.parse(formData);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: formatValidationErrors(error) };
    }
    return { success: false, errors: ['خطأ في معالجة البيانات'] };
  }
}

// Re-export data integrity utilities from errors.ts for backwards compatibility
export { assertNonNegative, type AssertNonNegativeContext } from './errors';
