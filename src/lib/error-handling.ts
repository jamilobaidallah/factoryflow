/**
 * Enhanced Error Handling System
 *
 * Provides comprehensive error handling, logging, and user-friendly error messages
 */

import { FirebaseError } from 'firebase/app';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { formatShortDate } from './date-utils';

// ======================
// Error Types
// ======================

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  FIREBASE = 'FIREBASE',
  NETWORK = 'NETWORK',
  DUPLICATE = 'DUPLICATE',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION = 'PERMISSION',
  RATE_LIMITED = 'RATE_LIMITED',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  field?: string;
  code?: string;
}

// ======================
// Firebase Error Messages
// ======================

const firebaseErrorMessages: Record<string, string> = {
  // Authentication errors
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
  'auth/user-disabled': 'تم تعطيل هذا الحساب',
  'auth/user-not-found': 'المستخدم غير موجود',
  'auth/wrong-password': 'كلمة المرور غير صحيحة',
  'auth/email-already-in-use': 'البريد الإلكتروني مستخدم مسبقاً',
  'auth/weak-password': 'كلمة المرور ضعيفة',
  'auth/network-request-failed': 'فشل الاتصال بالإنترنت',
  'auth/too-many-requests': 'تم إرسال طلبات كثيرة، يرجى المحاولة لاحقاً',
  'auth/invalid-action-code': 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية',
  'auth/expired-action-code': 'انتهت صلاحية رابط إعادة التعيين',
  'auth/missing-email': 'يرجى إدخال البريد الإلكتروني',

  // Firestore errors
  'permission-denied': 'ليس لديك صلاحية للقيام بهذا الإجراء',
  'not-found': 'البيانات المطلوبة غير موجودة',
  'already-exists': 'البيانات موجودة مسبقاً',
  'resource-exhausted': 'تم تجاوز حد العمليات المسموح به',
  'unauthenticated': 'يجب تسجيل الدخول أولاً',
  'unavailable': 'الخدمة غير متاحة حالياً',
  'deadline-exceeded': 'انتهت مهلة العملية',
  'cancelled': 'تم إلغاء العملية',
  'invalid-argument': 'البيانات المدخلة غير صحيحة',
  'failed-precondition': 'لا يمكن تنفيذ العملية في الوضع الحالي',
  'aborted': 'تم إيقاف العملية',
  'out-of-range': 'القيمة خارج النطاق المسموح',
  'unimplemented': 'هذه الميزة غير متوفرة',
  'internal': 'خطأ داخلي في الخادم',
  'data-loss': 'فقدان البيانات',

  // Storage errors
  'storage/unauthorized': 'ليس لديك صلاحية للوصول إلى هذا الملف',
  'storage/canceled': 'تم إلغاء عملية الرفع',
  'storage/unknown': 'حدث خطأ غير معروف',
};

// ======================
// Error Handlers
// ======================

/**
 * Handle Firebase errors with Arabic messages
 */
export function handleFirebaseError(error: FirebaseError): AppError {
  const code = error.code;
  const message = firebaseErrorMessages[code] || 'حدث خطأ في الاتصال بالخادم';

  // Determine error type based on code
  let type = ErrorType.FIREBASE;

  if (code.includes('permission') || code.includes('unauthenticated')) {
    type = ErrorType.PERMISSION;
  } else if (code.includes('not-found')) {
    type = ErrorType.NOT_FOUND;
  } else if (code.includes('network') || code.includes('unavailable')) {
    type = ErrorType.NETWORK;
  } else if (code.includes('already-exists')) {
    type = ErrorType.DUPLICATE;
  }

  return {
    type,
    message,
    details: error.message,
    code,
  };
}

/**
 * Handle Zod validation errors
 */
export function handleValidationError(error: z.ZodError): AppError {
  const firstError = error.errors[0];
  const field = firstError?.path.join('.') || '';

  return {
    type: ErrorType.VALIDATION,
    message: firstError?.message || 'خطأ في التحقق من البيانات',
    field,
    details: error.errors.map(e => e.message).join(', '),
  };
}

/**
 * Handle network errors
 */
export function handleNetworkError(error: Error): AppError {
  return {
    type: ErrorType.NETWORK,
    message: 'فشل الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى',
    details: error.message,
  };
}

/**
 * Handle unknown errors
 */
export function handleUnknownError(error: unknown): AppError {
  if (error instanceof Error) {
    return {
      type: ErrorType.UNKNOWN,
      message: 'حدث خطأ غير متوقع',
      details: error.message,
    };
  }

  return {
    type: ErrorType.UNKNOWN,
    message: 'حدث خطأ غير معروف',
    details: String(error),
  };
}

/**
 * Main error handler - determines error type and returns appropriate AppError
 */
export function handleError(error: unknown): AppError {
  // Firebase errors
  if (error instanceof FirebaseError) {
    return handleFirebaseError(error);
  }

  // Zod validation errors
  if (error instanceof z.ZodError) {
    return handleValidationError(error);
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return handleNetworkError(error as Error);
  }

  // Custom app errors
  if (typeof error === 'object' && error !== null && 'type' in error && 'message' in error) {
    return error as AppError;
  }

  // Unknown errors
  return handleUnknownError(error);
}

// ======================
// Error Logging
// ======================

export interface ErrorLog {
  timestamp: Date;
  error: AppError;
  context?: Record<string, any>;
  userId?: string;
}

/**
 * Log error for debugging and send to Sentry in production
 */
export function logError(error: AppError, context?: Record<string, any>, userId?: string): void {
  const errorLog: ErrorLog = {
    timestamp: new Date(),
    error,
    context,
    userId,
  };

  // In development, log to console only
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorLog);
    return;
  }

  // In production, send to Sentry for error tracking
  Sentry.captureException(error, {
    extra: {
      ...context,
      errorDetails: error.details,
      errorField: error.field,
    },
    tags: {
      errorType: error.type,
      errorCode: error.code || 'unknown',
    },
    user: userId ? { id: userId } : undefined,
  });
}

// ======================
// User-Friendly Error Messages
// ======================

/**
 * Get user-friendly title based on error type
 */
export function getErrorTitle(error: AppError): string {
  switch (error.type) {
    case ErrorType.VALIDATION:
      return 'خطأ في البيانات';
    case ErrorType.FIREBASE:
      return 'خطأ في النظام';
    case ErrorType.NETWORK:
      return 'خطأ في الاتصال';
    case ErrorType.DUPLICATE:
      return 'بيانات مكررة';
    case ErrorType.NOT_FOUND:
      return 'غير موجود';
    case ErrorType.PERMISSION:
      return 'غير مصرح';
    case ErrorType.RATE_LIMITED:
      return 'تم تجاوز عدد المحاولات';
    case ErrorType.UNKNOWN:
    default:
      return 'خطأ';
  }
}

/**
 * Get appropriate toast variant based on error type
 */
export function getErrorVariant(error: AppError): 'default' | 'destructive' {
  // Only validation errors might use default, others are destructive
  return error.type === ErrorType.VALIDATION ? 'default' : 'destructive';
}

// ======================
// Retry Logic
// ======================

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: boolean; // Exponential backoff
  retryableErrors?: ErrorType[];
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = true,
    retryableErrors = [ErrorType.NETWORK, ErrorType.FIREBASE],
  } = options;

  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const appError = handleError(error);
      lastError = appError;

      // Check if error is retryable
      const isRetryable = retryableErrors.includes(appError.type);
      const isLastAttempt = attempt === maxAttempts;

      if (!isRetryable || isLastAttempt) {
        throw appError;
      }

      // Calculate delay with optional exponential backoff
      const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Operation failed after retries');
}

// ======================
// Data Validation Helpers
// ======================

/**
 * Validate that required fields are not empty
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): AppError | null {
  for (const field of requiredFields) {
    const value = data[field];

    if (value === undefined || value === null || value === '') {
      return {
        type: ErrorType.VALIDATION,
        message: `الحقل "${field}" مطلوب`,
        field,
      };
    }

    // Check for whitespace-only strings
    if (typeof value === 'string' && value.trim() === '') {
      return {
        type: ErrorType.VALIDATION,
        message: `الحقل "${field}" لا يمكن أن يكون فارغاً`,
        field,
      };
    }
  }

  return null;
}

/**
 * Validate numeric range
 */
export function validateNumericRange(
  value: number,
  min?: number,
  max?: number,
  fieldName: string = 'القيمة'
): AppError | null {
  if (min !== undefined && value < min) {
    return {
      type: ErrorType.VALIDATION,
      message: `${fieldName} يجب أن يكون أكبر من أو يساوي ${min}`,
    };
  }

  if (max !== undefined && value > max) {
    return {
      type: ErrorType.VALIDATION,
      message: `${fieldName} يجب أن يكون أقل من أو يساوي ${max}`,
    };
  }

  return null;
}

/**
 * Validate date range
 */
export function validateDateRange(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  fieldName: string = 'التاريخ'
): AppError | null {
  if (minDate && date < minDate) {
    return {
      type: ErrorType.VALIDATION,
      message: `${fieldName} لا يمكن أن يكون قبل ${formatShortDate(minDate)}`,
    };
  }

  if (maxDate && date > maxDate) {
    return {
      type: ErrorType.VALIDATION,
      message: `${fieldName} لا يمكن أن يكون بعد ${formatShortDate(maxDate)}`,
    };
  }

  return null;
}

// ======================
// Success Messages
// ======================

export interface SuccessMessage {
  title: string;
  description?: string;
}

/**
 * Get success message for common operations
 */
export function getSuccessMessage(operation: 'create' | 'update' | 'delete', entity?: string): SuccessMessage {
  const entityName = entity || 'البيانات';

  switch (operation) {
    case 'create':
      return {
        title: 'تمت الإضافة بنجاح',
        description: `تم إضافة ${entityName} بنجاح`,
      };
    case 'update':
      return {
        title: 'تم التحديث بنجاح',
        description: `تم تحديث ${entityName} بنجاح`,
      };
    case 'delete':
      return {
        title: 'تم الحذف بنجاح',
        description: `تم حذف ${entityName} بنجاح`,
      };
    default:
      return {
        title: 'تمت العملية بنجاح',
      };
  }
}

// ======================
// Legacy-Compatible Functions
// (Consolidated from error-handler.ts)
// ======================

/**
 * Simple error result for toast notifications
 * Legacy interface maintained for backward compatibility with use-async-operation.ts
 */
export interface ErrorResult {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}

/**
 * Legacy-compatible error handler that accepts any error type
 * Returns simple ErrorResult for toast notifications
 *
 * @param error - Any error type (Firebase, standard Error, or unknown)
 * @returns ErrorResult with title, description, and variant
 */
export function handleFirebaseErrorSimple(error: unknown): ErrorResult {
  const appError = handleError(error);
  return {
    title: getErrorTitle(appError),
    description: appError.message,
    variant: getErrorVariant(appError),
  };
}

/**
 * Legacy-compatible error logger with context-first signature
 * Wraps the main logError function for backward compatibility
 *
 * @param context - Context string (e.g., 'PaymentsPage.handleSubmit')
 * @param error - Error object
 * @param additionalData - Any additional data to log
 */
export function logErrorSimple(
  context: string,
  error: unknown,
  additionalData?: Record<string, any>
): void {
  const appError = handleError(error);
  logError(appError, { ...additionalData, context });
}
