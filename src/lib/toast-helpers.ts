/**
 * Enhanced Toast Notification Helpers
 *
 * Provides convenient helper functions for showing beautiful toast notifications
 * with icons and consistent styling
 */

import { toast } from "@/hooks/use-toast";

interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

/**
 * Show success toast with checkmark icon
 */
export function showSuccessToast({ title, description, duration = 3000 }: ToastOptions) {
  toast({
    title: `✅ ${title}`,
    description,
    duration,
    className: "border-green-200 bg-green-50",
  });
}

/**
 * Show error toast with error icon
 */
export function showErrorToast({ title, description, duration = 5000 }: ToastOptions) {
  toast({
    title: `❌ ${title}`,
    description,
    duration,
    variant: "destructive",
  });
}

/**
 * Show warning toast with warning icon
 */
export function showWarningToast({ title, description, duration = 4000 }: ToastOptions) {
  toast({
    title: `⚠️ ${title}`,
    description,
    duration,
    className: "border-yellow-200 bg-yellow-50 text-yellow-900",
  });
}

/**
 * Show info toast with info icon
 */
export function showInfoToast({ title, description, duration = 3000 }: ToastOptions) {
  toast({
    title: `ℹ️ ${title}`,
    description,
    duration,
    className: "border-blue-200 bg-blue-50 text-blue-900",
  });
}

/**
 * Show loading toast
 */
export function showLoadingToast({ title, description }: Omit<ToastOptions, 'duration'>) {
  return toast({
    title: `⏳ ${title}`,
    description,
    duration: Infinity, // Manual dismiss
    className: "border-gray-200 bg-gray-50",
  });
}

/**
 * Show toast for AR/AP update
 */
export function showARAPUpdateToast(success: boolean, message: string) {
  if (success) {
    showSuccessToast({
      title: "تم تحديث الذمم",
      description: message,
    });
  } else {
    showWarningToast({
      title: "تنبيه",
      description: message,
    });
  }
}

/**
 * Show toast for deletion
 */
export function showDeleteToast(entityName: string, hasARAPUpdate: boolean = false) {
  showSuccessToast({
    title: "تم الحذف",
    description: hasARAPUpdate
      ? `تم حذف ${entityName} وتحديث الرصيد في دفتر الأستاذ`
      : `تم حذف ${entityName} بنجاح`,
  });
}

/**
 * Show toast for creation
 */
export function showCreateToast(entityName: string, additionalMessage?: string) {
  showSuccessToast({
    title: "تمت الإضافة بنجاح",
    description: additionalMessage || `تم إضافة ${entityName} بنجاح`,
  });
}

/**
 * Show toast for update
 */
export function showUpdateToast(entityName: string) {
  showSuccessToast({
    title: "تم التحديث بنجاح",
    description: `تم تحديث ${entityName} بنجاح`,
  });
}

/**
 * Show validation error toast
 */
export function showValidationErrorToast(fieldName: string) {
  showErrorToast({
    title: "خطأ في البيانات",
    description: `الحقل "${fieldName}" مطلوب`,
  });
}

/**
 * Show network error toast
 */
export function showNetworkErrorToast() {
  showErrorToast({
    title: "خطأ في الاتصال",
    description: "تحقق من اتصالك بالإنترنت وحاول مرة أخرى",
  });
}

/**
 * Show permission error toast
 */
export function showPermissionErrorToast() {
  showErrorToast({
    title: "خطأ في الصلاحيات",
    description: "ليس لديك صلاحية للقيام بهذا الإجراء",
  });
}
