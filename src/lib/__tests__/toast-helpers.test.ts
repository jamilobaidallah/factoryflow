import {
    showSuccessToast,
    showErrorToast,
    showWarningToast,
    showInfoToast,
    showLoadingToast,
    showARAPUpdateToast,
    showDeleteToast,
    showCreateToast,
    showUpdateToast,
    showValidationErrorToast,
    showNetworkErrorToast,
    showPermissionErrorToast
} from '../toast-helpers';
import { toast } from '@/hooks/use-toast';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
    toast: jest.fn(),
}));

describe('Toast Helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('showSuccessToast', () => {
        it('should call toast with success styling', () => {
            showSuccessToast({ title: 'Success', description: 'Operation completed' });

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '✅ Success',
                    description: 'Operation completed',
                    duration: 3000,
                    className: 'border-green-200 bg-green-50',
                })
            );
        });

        it('should use custom duration', () => {
            showSuccessToast({ title: 'Success', duration: 5000 });

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    duration: 5000,
                })
            );
        });
    });

    describe('showErrorToast', () => {
        it('should call toast with error styling', () => {
            showErrorToast({ title: 'Error', description: 'Something went wrong' });

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '❌ Error',
                    description: 'Something went wrong',
                    duration: 5000,
                    variant: 'destructive',
                })
            );
        });
    });

    describe('showWarningToast', () => {
        it('should call toast with warning styling', () => {
            showWarningToast({ title: 'Warning', description: 'Be careful' });

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '⚠️ Warning',
                    description: 'Be careful',
                    duration: 4000,
                    className: 'border-yellow-200 bg-yellow-50 text-yellow-900',
                })
            );
        });
    });

    describe('showInfoToast', () => {
        it('should call toast with info styling', () => {
            showInfoToast({ title: 'Info', description: 'FYI' });

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'ℹ️ Info',
                    description: 'FYI',
                    duration: 3000,
                    className: 'border-blue-200 bg-blue-50 text-blue-900',
                })
            );
        });
    });

    describe('showLoadingToast', () => {
        it('should call toast with infinite duration', () => {
            showLoadingToast({ title: 'Loading', description: 'Please wait' });

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '⏳ Loading',
                    description: 'Please wait',
                    duration: Infinity,
                    className: 'border-gray-200 bg-gray-50',
                })
            );
        });
    });

    describe('showARAPUpdateToast', () => {
        it('should show success toast when successful', () => {
            showARAPUpdateToast(true, 'Balance updated');

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '✅ تم تحديث الذمم',
                    description: 'Balance updated',
                })
            );
        });

        it('should show warning toast when not successful', () => {
            showARAPUpdateToast(false, 'Could not update');

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '⚠️ تنبيه',
                    description: 'Could not update',
                })
            );
        });
    });

    describe('showDeleteToast', () => {
        it('should show delete success without AR/AP update', () => {
            showDeleteToast('العميل');

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '✅ تم الحذف',
                    description: 'تم حذف العميل بنجاح',
                })
            );
        });

        it('should show delete success with AR/AP update', () => {
            showDeleteToast('الدفعة', true);

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '✅ تم الحذف',
                    description: 'تم حذف الدفعة وتحديث الرصيد في دفتر الأستاذ',
                })
            );
        });
    });

    describe('showCreateToast', () => {
        it('should show create success with default message', () => {
            showCreateToast('العميل');

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '✅ تمت الإضافة بنجاح',
                    description: 'تم إضافة العميل بنجاح',
                })
            );
        });

        it('should show create success with custom message', () => {
            showCreateToast('العميل', 'تم إضافة العميل مع رصيد افتتاحي');

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    description: 'تم إضافة العميل مع رصيد افتتاحي',
                })
            );
        });
    });

    describe('showUpdateToast', () => {
        it('should show update success', () => {
            showUpdateToast('المنتج');

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '✅ تم التحديث بنجاح',
                    description: 'تم تحديث المنتج بنجاح',
                })
            );
        });
    });

    describe('showValidationErrorToast', () => {
        it('should show validation error', () => {
            showValidationErrorToast('الاسم');

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '❌ خطأ في البيانات',
                    description: 'الحقل "الاسم" مطلوب',
                })
            );
        });
    });

    describe('showNetworkErrorToast', () => {
        it('should show network error', () => {
            showNetworkErrorToast();

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '❌ خطأ في الاتصال',
                    description: 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى',
                })
            );
        });
    });

    describe('showPermissionErrorToast', () => {
        it('should show permission error', () => {
            showPermissionErrorToast();

            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '❌ خطأ في الصلاحيات',
                    description: 'ليس لديك صلاحية للقيام بهذا الإجراء',
                })
            );
        });
    });
});
