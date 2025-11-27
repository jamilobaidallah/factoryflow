/**
 * Unit Tests for Error Handling System
 */

import { FirebaseError } from 'firebase/app';
import { z } from 'zod';
import {
  ErrorType,
  handleError,
  handleFirebaseError,
  handleValidationError,
  handleNetworkError,
  handleUnknownError,
  getErrorTitle,
  getErrorVariant,
  validateRequiredFields,
  validateNumericRange,
  validateDateRange,
  getSuccessMessage,
  retryOperation,
  logError,
  AppError,
} from '../error-handling';

describe('Error Handling System', () => {
  describe('Firebase Error Handling', () => {
    it('should handle permission-denied error', () => {
      const firebaseError = new FirebaseError(
        'permission-denied',
        'Permission denied'
      );

      const result = handleFirebaseError(firebaseError);
      expect(result.type).toBe(ErrorType.PERMISSION);
      expect(result.message).toContain('صلاحية');
    });

    it('should handle not-found error', () => {
      const firebaseError = new FirebaseError('not-found', 'Not found');

      const result = handleFirebaseError(firebaseError);
      expect(result.type).toBe(ErrorType.NOT_FOUND);
      expect(result.message).toContain('غير موجودة');
    });

    it('should handle network errors', () => {
      const firebaseError = new FirebaseError(
        'auth/network-request-failed',
        'Network failed'
      );

      const result = handleFirebaseError(firebaseError);
      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.message).toContain('الإنترنت');
    });

    it('should handle duplicate errors', () => {
      const firebaseError = new FirebaseError(
        'already-exists',
        'Already exists'
      );

      const result = handleFirebaseError(firebaseError);
      expect(result.type).toBe(ErrorType.DUPLICATE);
      expect(result.message).toContain('موجودة مسبقاً');
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle Zod validation errors', () => {
      const schema = z.object({
        name: z.string().min(1, 'الاسم مطلوب'),
        age: z.number().positive('العمر يجب أن يكون موجباً'),
      });

      try {
        schema.parse({ name: '', age: -5 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const result = handleValidationError(error);
          expect(result.type).toBe(ErrorType.VALIDATION);
          expect(result.message).toBeTruthy();
          expect(result.field).toBeTruthy();
        }
      }
    });

    it('should extract field name from error path', () => {
      const schema = z.object({
        email: z.string().email('البريد الإلكتروني غير صحيح'),
      });

      try {
        schema.parse({ email: 'invalid' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const result = handleValidationError(error);
          expect(result.field).toBe('email');
        }
      }
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network errors', () => {
      const networkError = new TypeError('fetch failed');

      const result = handleNetworkError(networkError);
      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.message).toContain('الإنترنت');
    });
  });

  describe('Unknown Error Handling', () => {
    it('should handle Error instances', () => {
      const error = new Error('Something went wrong');

      const result = handleUnknownError(error);
      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBeTruthy();
      expect(result.details).toBe('Something went wrong');
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';

      const result = handleUnknownError(error);
      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBeTruthy();
    });
  });

  describe('Main Error Handler', () => {
    it('should route Firebase errors', () => {
      const error = new FirebaseError('permission-denied', 'Permission denied');

      const result = handleError(error);
      expect(result.type).toBe(ErrorType.PERMISSION);
    });

    it('should route Zod errors', () => {
      const schema = z.string();
      try {
        schema.parse(123);
      } catch (error) {
        const result = handleError(error);
        expect(result.type).toBe(ErrorType.VALIDATION);
      }
    });

    it('should handle custom app errors', () => {
      const customError = {
        type: ErrorType.DUPLICATE,
        message: 'Duplicate entry',
      };

      const result = handleError(customError);
      expect(result.type).toBe(ErrorType.DUPLICATE);
    });
  });

  describe('Error UI Helpers', () => {
    describe('getErrorTitle', () => {
      it('should return correct title for validation errors', () => {
        const error = {
          type: ErrorType.VALIDATION,
          message: 'Test',
        };

        expect(getErrorTitle(error)).toBe('خطأ في البيانات');
      });

      it('should return correct title for permission errors', () => {
        const error = {
          type: ErrorType.PERMISSION,
          message: 'Test',
        };

        expect(getErrorTitle(error)).toBe('غير مصرح');
      });

      it('should return correct title for duplicate errors', () => {
        const error = {
          type: ErrorType.DUPLICATE,
          message: 'Test',
        };

        expect(getErrorTitle(error)).toBe('بيانات مكررة');
      });
    });

    describe('getErrorVariant', () => {
      it('should return default for validation errors', () => {
        const error = {
          type: ErrorType.VALIDATION,
          message: 'Test',
        };

        expect(getErrorVariant(error)).toBe('default');
      });

      it('should return destructive for other errors', () => {
        const error = {
          type: ErrorType.FIREBASE,
          message: 'Test',
        };

        expect(getErrorVariant(error)).toBe('destructive');
      });
    });
  });

  describe('Data Validation Helpers', () => {
    describe('validateRequiredFields', () => {
      it('should pass for complete data', () => {
        const data = {
          name: 'John',
          email: 'test@example.com',
        };

        const result = validateRequiredFields(data, ['name', 'email']);
        expect(result).toBeNull();
      });

      it('should fail for missing field', () => {
        const data = {
          name: 'John',
        };

        const result = validateRequiredFields(data, ['name', 'email']);
        expect(result).not.toBeNull();
        expect(result?.type).toBe(ErrorType.VALIDATION);
      });

      it('should fail for empty string', () => {
        const data = {
          name: '',
          email: 'test@example.com',
        };

        const result = validateRequiredFields(data, ['name', 'email']);
        expect(result).not.toBeNull();
      });

      it('should fail for whitespace-only string', () => {
        const data = {
          name: '   ',
          email: 'test@example.com',
        };

        const result = validateRequiredFields(data, ['name', 'email']);
        expect(result).not.toBeNull();
      });
    });

    describe('validateNumericRange', () => {
      it('should pass for value in range', () => {
        const result = validateNumericRange(50, 0, 100);
        expect(result).toBeNull();
      });

      it('should fail for value below min', () => {
        const result = validateNumericRange(-5, 0, 100);
        expect(result).not.toBeNull();
        expect(result?.type).toBe(ErrorType.VALIDATION);
      });

      it('should fail for value above max', () => {
        const result = validateNumericRange(150, 0, 100);
        expect(result).not.toBeNull();
      });

      it('should work without min', () => {
        const result = validateNumericRange(50, undefined, 100);
        expect(result).toBeNull();
      });

      it('should work without max', () => {
        const result = validateNumericRange(50, 0, undefined);
        expect(result).toBeNull();
      });
    });

    describe('validateDateRange', () => {
      it('should pass for date in range', () => {
        const date = new Date('2025-06-01');
        const minDate = new Date('2025-01-01');
        const maxDate = new Date('2025-12-31');

        const result = validateDateRange(date, minDate, maxDate);
        expect(result).toBeNull();
      });

      it('should fail for date before min', () => {
        const date = new Date('2024-12-01');
        const minDate = new Date('2025-01-01');

        const result = validateDateRange(date, minDate);
        expect(result).not.toBeNull();
      });

      it('should fail for date after max', () => {
        const date = new Date('2026-01-01');
        const maxDate = new Date('2025-12-31');

        const result = validateDateRange(date, undefined, maxDate);
        expect(result).not.toBeNull();
      });
    });
  });

  describe('Success Messages', () => {
    it('should return correct message for create operation', () => {
      const result = getSuccessMessage('create', 'العميل');
      expect(result.title).toContain('الإضافة');
      expect(result.description).toContain('العميل');
    });

    it('should return correct message for update operation', () => {
      const result = getSuccessMessage('update', 'العميل');
      expect(result.title).toContain('التحديث');
      expect(result.description).toContain('العميل');
    });

    it('should return correct message for delete operation', () => {
      const result = getSuccessMessage('delete', 'العميل');
      expect(result.title).toContain('الحذف');
      expect(result.description).toContain('العميل');
    });

    it('should use default entity name', () => {
      const result = getSuccessMessage('create');
      expect(result.description).toContain('البيانات');
    });

    it('should handle unknown operation with default message', () => {
      const result = getSuccessMessage('unknown' as any);
      expect(result.title).toContain('تمت العملية بنجاح');
    });
  });

  describe('Network Error in Main Handler', () => {
    it('should route fetch TypeError to network handler', () => {
      const error = new TypeError('Failed to fetch');
      const result = handleError(error);
      expect(result.type).toBe(ErrorType.NETWORK);
    });
  });

  describe('Additional Error Title Cases', () => {
    it('should return correct title for firebase errors', () => {
      const error: AppError = { type: ErrorType.FIREBASE, message: 'Test' };
      expect(getErrorTitle(error)).toBe('خطأ في النظام');
    });

    it('should return correct title for network errors', () => {
      const error: AppError = { type: ErrorType.NETWORK, message: 'Test' };
      expect(getErrorTitle(error)).toBe('خطأ في الاتصال');
    });

    it('should return correct title for not found errors', () => {
      const error: AppError = { type: ErrorType.NOT_FOUND, message: 'Test' };
      expect(getErrorTitle(error)).toBe('غير موجود');
    });

    it('should return correct title for unknown errors', () => {
      const error: AppError = { type: ErrorType.UNKNOWN, message: 'Test' };
      expect(getErrorTitle(error)).toBe('خطأ');
    });
  });

  describe('Retry Operation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const resultPromise = retryOperation(operation);
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const networkError = new FirebaseError('unavailable', 'Service unavailable');
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success');

      const resultPromise = retryOperation(operation, { maxAttempts: 3, delayMs: 100 });

      // Advance timers to trigger retry
      await jest.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const networkError = new FirebaseError('unavailable', 'Service unavailable');
      const operation = jest.fn().mockRejectedValue(networkError);

      let thrownError: any;
      const resultPromise = retryOperation(operation, { maxAttempts: 2, delayMs: 100 })
        .catch(e => { thrownError = e; });

      // Advance timers for all retries
      await jest.advanceTimersByTimeAsync(500);
      await resultPromise;

      expect(thrownError).toBeDefined();
      expect(thrownError.type).toBe(ErrorType.NETWORK);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const validationError = {
        type: ErrorType.VALIDATION,
        message: 'Invalid data',
      };
      const operation = jest.fn().mockRejectedValue(validationError);

      await expect(
        retryOperation(operation, { maxAttempts: 3 })
      ).rejects.toMatchObject({
        type: ErrorType.VALIDATION,
      });

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff when enabled', async () => {
      const networkError = new FirebaseError('unavailable', 'Service unavailable');
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success');

      const resultPromise = retryOperation(operation, {
        maxAttempts: 3,
        delayMs: 100,
        backoff: true,
      });

      // First retry after 100ms
      await jest.advanceTimersByTimeAsync(100);
      // Second retry after 200ms (exponential)
      await jest.advanceTimersByTimeAsync(200);

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use linear delay when backoff is disabled', async () => {
      const networkError = new FirebaseError('unavailable', 'Service unavailable');
      const operation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success');

      const resultPromise = retryOperation(operation, {
        maxAttempts: 3,
        delayMs: 100,
        backoff: false,
      });

      // Retry after 100ms (no exponential increase)
      await jest.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(result).toBe('success');
    });
  });

  describe('Error Logging', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
      });
    });

    it('should log errors in development mode', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error: AppError = {
        type: ErrorType.FIREBASE,
        message: 'Test error',
      };

      logError(error, { action: 'test' }, 'user123');

      expect(consoleSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
      consoleSpy.mockRestore();
    });

    it('should not log in production mode', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error: AppError = {
        type: ErrorType.FIREBASE,
        message: 'Test error',
      };

      logError(error);

      expect(consoleSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalNodeEnv;
      consoleSpy.mockRestore();
    });
  });

  describe('Additional Firebase Error Cases', () => {
    it('should handle unauthenticated as permission error', () => {
      const firebaseError = new FirebaseError('unauthenticated', 'Not authenticated');
      const result = handleFirebaseError(firebaseError);
      expect(result.type).toBe(ErrorType.PERMISSION);
    });

    it('should handle unavailable as network error', () => {
      const firebaseError = new FirebaseError('unavailable', 'Service unavailable');
      const result = handleFirebaseError(firebaseError);
      expect(result.type).toBe(ErrorType.NETWORK);
    });

    it('should fallback to FIREBASE type for unknown codes', () => {
      const firebaseError = new FirebaseError('internal', 'Internal error');
      const result = handleFirebaseError(firebaseError);
      expect(result.type).toBe(ErrorType.FIREBASE);
    });
  });
});
