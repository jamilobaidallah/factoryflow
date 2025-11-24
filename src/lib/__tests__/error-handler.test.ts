/**
 * Unit Tests for Error Handlers
 */

import {
  handleFirebaseError,
  handleCRUDError,
  validateRequiredFields,
  createSuccessMessage,
} from '../error-handler';
import { FirebaseError } from 'firebase/app';

describe('Error Handlers', () => {
  describe('handleFirebaseError', () => {
    it('should handle Firebase permission denied error', () => {
      const error = new FirebaseError('permission-denied', 'Permission denied');
      const result = handleFirebaseError(error);

      expect(result.title).toBe('خطأ');
      expect(result.description).toBe('ليس لديك صلاحية للقيام بهذا الإجراء');
      expect(result.variant).toBe('destructive');
    });

    it('should handle Firebase not-found error', () => {
      const error = new FirebaseError('not-found', 'Not found');
      const result = handleFirebaseError(error);

      expect(result.description).toBe('لم يتم العثور على البيانات المطلوبة');
    });

    it('should handle unknown Firebase error codes', () => {
      const error = new FirebaseError('unknown-error', 'Unknown error');
      const result = handleFirebaseError(error);

      expect(result.description).toBe('Unknown error');
    });

    it('should handle generic Error objects', () => {
      const error = new Error('Generic error message');
      const result = handleFirebaseError(error);

      expect(result.description).toBe('Generic error message');
    });

    it('should handle unknown error types', () => {
      const error = { some: 'unknown error' };
      const result = handleFirebaseError(error);

      expect(result.description).toBe('حدث خطأ غير متوقع');
    });
  });

  describe('handleCRUDError', () => {
    it('should format create operation errors', () => {
      const error = new Error('Test error');
      const result = handleCRUDError('create', 'المدفوعة', error);

      expect(result.title).toBe('خطأ');
      expect(result.description).toContain('إضافة');
      expect(result.description).toContain('المدفوعة');
    });

    it('should format delete operation errors', () => {
      const error = new Error('Test error');
      const result = handleCRUDError('delete', 'الشيك', error);

      expect(result.description).toContain('حذف');
      expect(result.description).toContain('الشيك');
    });

    it('should format update operation errors', () => {
      const error = new Error('Test error');
      const result = handleCRUDError('update', 'العميل', error);

      expect(result.description).toContain('تحديث');
      expect(result.description).toContain('العميل');
    });

    it('should format read operation errors', () => {
      const error = new Error('Test error');
      const result = handleCRUDError('read', 'البيانات', error);

      expect(result.description).toContain('قراءة');
      expect(result.description).toContain('البيانات');
    });
  });

  describe('validateRequiredFields', () => {
    it('should return null for valid data', () => {
      const data = { name: 'Test', amount: '100' };
      const fields = [
        { field: 'name', label: 'الاسم' },
        { field: 'amount', label: 'المبلغ' },
      ];

      const result = validateRequiredFields(data, fields);
      expect(result).toBeNull();
    });

    it('should detect missing fields', () => {
      const data = { name: 'Test', amount: '' };
      const fields = [
        { field: 'name', label: 'الاسم' },
        { field: 'amount', label: 'المبلغ' },
      ];

      const result = validateRequiredFields(data, fields);
      expect(result).not.toBeNull();
      expect(result?.description).toContain('المبلغ');
      expect(result?.description).toContain('مطلوب');
    });

    it('should detect fields with only whitespace', () => {
      const data = { name: '   ', amount: '100' };
      const fields = [{ field: 'name', label: 'الاسم' }];

      const result = validateRequiredFields(data, fields);
      expect(result).not.toBeNull();
    });

    it('should detect undefined fields', () => {
      const data = { amount: '100' };
      const fields = [{ field: 'name', label: 'الاسم' }];

      const result = validateRequiredFields(data, fields);
      expect(result).not.toBeNull();
    });
  });

  describe('createSuccessMessage', () => {
    it('should create success message for create operation', () => {
      const result = createSuccessMessage('create', 'مدفوعة');

      expect(result.title).toBe('تمت الإضافة بنجاح');
      expect(result.description).toContain('مدفوعة');
    });

    it('should create success message for update operation', () => {
      const result = createSuccessMessage('update', 'شيك');

      expect(result.title).toBe('تم التحديث بنجاح');
      expect(result.description).toContain('شيك');
    });

    it('should create success message for delete operation', () => {
      const result = createSuccessMessage('delete', 'عميل');

      expect(result.title).toBe('تم الحذف');
      expect(result.description).toContain('عميل');
    });

    it('should include additional message when provided', () => {
      const result = createSuccessMessage(
        'create',
        'مدفوعة',
        'تم تحديث الرصيد أيضاً'
      );

      expect(result.description).toBe('تم تحديث الرصيد أيضاً');
    });
  });
});
