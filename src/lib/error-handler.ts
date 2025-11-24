/**
 * Error Handling Utilities
 *
 * Provides consistent error handling and user-friendly error messages
 * across the application.
 */

import { FirebaseError } from 'firebase/app';

export interface ErrorResult {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}

/**
 * Firebase error codes to Arabic error messages
 */
const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'permission-denied': 'ليس لديك صلاحية للقيام بهذا الإجراء',
  'not-found': 'لم يتم العثور على البيانات المطلوبة',
  'already-exists': 'البيانات موجودة مسبقاً',
  'unauthenticated': 'يجب تسجيل الدخول للمتابعة',
  'unavailable': 'الخدمة غير متاحة حالياً، يرجى المحاولة لاحقاً',
  'cancelled': 'تم إلغاء العملية',
  'deadline-exceeded': 'انتهت مهلة العملية',
  'invalid-argument': 'البيانات المدخلة غير صحيحة',
  'resource-exhausted': 'تم تجاوز حد الاستخدام',
};

/**
 * Convert Firebase error to user-friendly Arabic message
 *
 * @param error - Error object
 * @returns ErrorResult with title and description
 */
export function handleFirebaseError(error: unknown): ErrorResult {
  if (error instanceof FirebaseError) {
    const message = FIREBASE_ERROR_MESSAGES[error.code] || error.message;

    return {
      title: 'خطأ',
      description: message,
      variant: 'destructive',
    };
  }

  if (error instanceof Error) {
    return {
      title: 'خطأ',
      description: error.message,
      variant: 'destructive',
    };
  }

  return {
    title: 'خطأ',
    description: 'حدث خطأ غير متوقع',
    variant: 'destructive',
  };
}

/**
 * Handle errors during CRUD operations
 *
 * @param operation - Operation type ('create', 'read', 'update', 'delete')
 * @param entityName - Name of entity (e.g., 'المدفوعة', 'الشيك')
 * @param error - Error object
 * @returns ErrorResult
 */
export function handleCRUDError(
  operation: 'create' | 'read' | 'update' | 'delete',
  entityName: string,
  error: unknown
): ErrorResult {
  const operationText = {
    create: 'إضافة',
    read: 'قراءة',
    update: 'تحديث',
    delete: 'حذف',
  };

  const baseError = handleFirebaseError(error);

  return {
    title: 'خطأ',
    description: `حدث خطأ أثناء ${operationText[operation]} ${entityName}: ${baseError.description}`,
    variant: 'destructive',
  };
}

/**
 * Log error to console with context
 *
 * @param context - Context string (e.g., 'PaymentsPage.handleSubmit')
 * @param error - Error object
 * @param additionalData - Any additional data to log
 */
export function logError(
  context: string,
  error: unknown,
  additionalData?: Record<string, any>
): void {
  console.error(`[${context}] Error:`, error);

  if (additionalData) {
    console.error(`[${context}] Additional data:`, additionalData);
  }

  // In production, you could send this to an error tracking service
  // like Sentry, LogRocket, etc.
}

/**
 * Validate required fields and return error if invalid
 *
 * @param data - Object with field values
 * @param requiredFields - Array of required field names
 * @returns ErrorResult if validation fails, null if valid
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: Array<{ field: string; label: string }>
): ErrorResult | null {
  for (const { field, label } of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return {
        title: 'خطأ في البيانات',
        description: `الحقل "${label}" مطلوب`,
        variant: 'destructive',
      };
    }
  }

  return null;
}

/**
 * Create success message
 *
 * @param operation - Operation type
 * @param entityName - Entity name
 * @param additionalMessage - Optional additional message
 * @returns Success result
 */
export function createSuccessMessage(
  operation: 'create' | 'update' | 'delete',
  entityName: string,
  additionalMessage?: string
): { title: string; description: string } {
  const operationText = {
    create: 'تمت الإضافة بنجاح',
    update: 'تم التحديث بنجاح',
    delete: 'تم الحذف',
  };

  return {
    title: operationText[operation],
    description: additionalMessage || `تم ${operation === 'create' ? 'إضافة' : operation === 'update' ? 'تحديث' : 'حذف'} ${entityName} بنجاح`,
  };
}

/**
 * Wrap async function with error handling
 *
 * @param fn - Async function to wrap
 * @param context - Context for logging
 * @param onError - Optional error handler
 * @returns Wrapped function
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string,
  onError?: (error: ErrorResult) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorResult = handleFirebaseError(error);
      logError(context, error);

      if (onError) {
        onError(errorResult);
      }

      throw error;
    }
  }) as T;
}
